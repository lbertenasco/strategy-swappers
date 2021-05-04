// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import './SwapperRegistry.sol';
import './Swapper.sol';

interface ITradeFactory {
  struct Trade {
    uint256 _id;
    address _owner;
    address _swapper;
    address _tokenIn;
    address _tokenOut;
    uint256 _amountIn;
    uint256 _maxSlippage;
    uint256 _deadline;
  }

  event TradeCreated(
    uint256 indexed _id,
    address _owner,
    address _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  );

  event TradeCanceled(uint256 indexed _id);

  event TradesOfOwnerCanceled(address indexed _owner, uint256[] _ids);

  event TradesOfOwnerChangedSwapper(address indexed _owner, uint256[] _ids, string _newSwapper);

  event TradeExpired(uint256 indexed _id);

  event TradeExecuted(uint256 indexed _id, uint256 _receivedAmount);

  event SwapperAndTokenEnabled(address indexed _swapper, address _token);

  function pendingTradesById(uint256)
    external
    view
    returns (
      uint256 _id,
      address _owner,
      address _swapper,
      address _tokenIn,
      address _tokenOut,
      uint256 _amountIn,
      uint256 _maxSlippage,
      uint256 _deadline
    );

  function swapperRegistry() external view returns (address);

  function create(
    string memory _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external returns (uint256 _id);

  function cancelPending(uint256 _id) external;

  function cancelAllPending() external returns (uint256[] memory _canceledTradesIds);

  function changePendingTradesSwapper(string memory _swapper) external returns (uint256[] memory _changedSwapperIds);

  function execute(uint256 _id) external returns (uint256 _receivedAmount);

  function expire(uint256 _id) external returns (uint256 _freedAmount);
}

abstract contract TradeFactory is ITradeFactory {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableSet for EnumerableSet.AddressSet;

  uint256 internal _tradeCounter = 0;

  mapping(uint256 => Trade) public override pendingTradesById;

  EnumerableSet.UintSet internal _pendingTradesIds;

  mapping(address => EnumerableSet.UintSet) internal _pendingTradesByOwner;

  mapping(address => EnumerableSet.AddressSet) internal _approvedTokensBySwappers;

  address public override swapperRegistry; // immutable ?

  constructor(address _swapperRegistry) {
    swapperRegistry = _swapperRegistry;
  }

  // only strategy ?
  function create(
    string memory _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external override returns (uint256 _id) {
    _id = _create(_swapper, msg.sender, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }

  function _create(
    string memory _swapper,
    address _owner,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) internal returns (uint256 _id) {
    (bool _existsSwapper, address _swapperAddress) = SwapperRegistry(swapperRegistry).isSwapper(_swapper);
    require(!_existsSwapper, 'TradeFactory: invalid swapper');
    require(_owner != address(0), 'TradeFactory: zero address');
    require(_tokenIn != address(0) && _tokenOut != address(0), 'TradeFactory: zero address');
    require(_amountIn > 0, 'TradeFactory: zero amount');
    require(_maxSlippage > 0, 'TradeFactory: zero slippage');
    require(_deadline > block.timestamp, 'TradeFactory: deadline too soon');
    _id = _tradeCounter;
    Trade memory _trade = Trade(_tradeCounter, _owner, _swapperAddress, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
    pendingTradesById[_trade._id] = _trade;
    _pendingTradesByOwner[_owner].add(_trade._id);
    _pendingTradesIds.add(_trade._id);
    emit TradeCreated(
      _trade._id,
      _trade._owner,
      _trade._swapper,
      _trade._tokenIn,
      _trade._tokenOut,
      _trade._amountIn,
      _trade._maxSlippage,
      _trade._deadline
    );
  }

  // only mechanic or strategy ?
  // only owner of trade ?
  function cancelPending(uint256 _id) external override {
    _cancelPending(_id);
  }

  // only owner of trade
  function _cancelPending(uint256 _id) internal {
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    Trade memory _trade = pendingTradesById[_id];
    _removePendingTrade(_trade._owner, _id);
    emit TradeCanceled(_id);
  }

  // only strategy ?
  function cancelAllPending() external override returns (uint256[] memory _canceledTradesIds) {
    _canceledTradesIds = _cancelAllPendingOfOwner(msg.sender);
  }

  function _cancelAllPendingOfOwner(address _owner) internal returns (uint256[] memory _canceledTradesIds) {
    require(_pendingTradesByOwner[_owner].length() > 0, 'TradeFactory: no trades pending from user');
    _canceledTradesIds = new uint256[](_pendingTradesByOwner[_owner].length());
    for (uint256 i = 0; i < _pendingTradesByOwner[_owner].length(); i++) {
      _canceledTradesIds[i] = _pendingTradesByOwner[_owner].at(i);
    }
    for (uint256 i = 0; i < _canceledTradesIds.length; i++) {
      _removePendingTrade(_owner, _canceledTradesIds[i]);
    }
    emit TradesOfOwnerCanceled(_owner, _canceledTradesIds);
  }

  function _removePendingTrade(address _owner, uint256 _id) internal {
    _pendingTradesByOwner[_owner].remove(_id);
    _pendingTradesIds.remove(_id);
    delete pendingTradesById[_id];
  }

  // only strategy ?
  function changePendingTradesSwapper(string memory _swapper) external override returns (uint256[] memory _changedSwapperIds) {
    _changedSwapperIds = _changePendingTradesSwapperOfOwner(msg.sender, _swapper);
  }

  function _changePendingTradesSwapperOfOwner(address _owner, string memory _swapper) internal returns (uint256[] memory _changedSwapperIds) {
    (bool _existsSwapper, address _swapperAddress) = SwapperRegistry(swapperRegistry).isSwapper(_swapper);
    require(!_existsSwapper, 'TradeFactory: invalid swapper');
    _changedSwapperIds = new uint256[](_pendingTradesByOwner[_owner].length());
    for (uint256 i = 0; i < _pendingTradesByOwner[_owner].length(); i++) {
      pendingTradesById[_pendingTradesByOwner[_owner].at(i)]._swapper = _swapperAddress;
      _changedSwapperIds[i] = _pendingTradesByOwner[_owner].at(i);
    }
    emit TradesOfOwnerChangedSwapper(_owner, _changedSwapperIds, _swapper);
  }

  // only mechanics
  function execute(uint256 _id) external override returns (uint256 _receivedAmount) {
    _receivedAmount = _execute(_id);
  }

  function _execute(uint256 _id) internal returns (uint256 _receivedAmount) {
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    Trade memory _trade = pendingTradesById[_id];
    require(_trade._deadline >= block.timestamp, 'TradeFactory: trade has expired');
    if (!_approvedTokensBySwappers[_trade._swapper].contains(_trade._tokenIn)) {
      _enableSwapperToken(_trade._swapper, _trade._tokenIn);
    }
    _receivedAmount = ISwapper(_trade._swapper).swap(_trade._owner, _trade._tokenIn, _trade._tokenOut, _trade._amountIn, _trade._maxSlippage);
    _removePendingTrade(_trade._owner, _id);
    emit TradeExecuted(_id, _receivedAmount);
  }

  // only mechanics
  function expire(uint256 _id) external override returns (uint256 _freedAmount) {
    _freedAmount = _expire(_id);
  }

  function _expire(uint256 _id) internal returns (uint256 _freedAmount) {
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    Trade memory _trade = pendingTradesById[_id];
    require(_trade._deadline <= block.timestamp, 'TradeFactory: swap not expired');
    _freedAmount = _trade._amountIn;
    _removePendingTrade(_trade._owner, _id);
    emit TradeExpired(_id);
  }

  function _enableSwapperToken(address _swapper, address _token) internal {
    IERC20(_token).safeApprove(_swapper, type(uint256).max);
    _approvedTokensBySwappers[_swapper].add(_token);
    emit SwapperAndTokenEnabled(_swapper, _token);
  }
}
