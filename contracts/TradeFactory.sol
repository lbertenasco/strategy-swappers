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
    address _owner,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external returns (uint256 _id);

  function cancelPending(uint256 _id) external;

  function cancelAllPendingOfOwner(address _owner) external;

  function changePendingSwapsSwapperOfOwner(address _owner, string memory _swapper) external;

  function execute(uint256 _id) external returns (uint256 _receivedAmount);

  function expire(uint256 _id) external returns (uint256 _returnedAmount);
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
    require(_owner != address(0), 'TradeFactory: zero address'); // check that is a strategy ?
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

  // only owner of trade
  function _cancelPending(uint256 _id) internal {
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    Trade memory _trade = pendingTradesById[_id];
    _removePendingTrade(_trade._owner, _id);
    emit TradeCanceled(_id);
  }

  function _cancelAllPendingOfOwner(address _owner) internal {
    require(_pendingTradesByOwner[_owner].length() > 0, 'TradeFactory: no trades pending from user');
    uint256[] memory _pendingOwnerIds = new uint256[](_pendingTradesByOwner[_owner].length());
    for (uint256 i = 0; i < _pendingTradesByOwner[_owner].length(); i++) {
      _pendingOwnerIds[i] = _pendingTradesByOwner[_owner].at(i);
    }
    for (uint256 i = 0; i < _pendingOwnerIds.length; i++) {
      _removePendingTrade(_owner, _pendingOwnerIds[i]);
    }
    emit TradesOfOwnerCanceled(_owner, _pendingOwnerIds);
  }

  function _removePendingTrade(address _owner, uint256 _id) internal {
    _pendingTradesByOwner[_owner].remove(_id);
    _pendingTradesIds.remove(_id);
    delete pendingTradesById[_id];
  }

  function _changePendingSwapsSwapperOfOwner(address _owner, string memory _swapper) internal {
    (bool _existsSwapper, address _swapperAddress) = SwapperRegistry(swapperRegistry).isSwapper(_swapper);
    require(!_existsSwapper, 'TradeFactory: invalid swapper');
    uint256[] memory _ids = new uint256[](_pendingTradesByOwner[_owner].length());
    for (uint256 i = 0; i < _pendingTradesByOwner[_owner].length(); i++) {
      pendingTradesById[_pendingTradesByOwner[_owner].at(i)]._swapper = _swapperAddress;
      _ids[i] = _pendingTradesByOwner[_owner].at(i);
    }
    emit TradesOfOwnerChangedSwapper(_owner, _ids, _swapper);
  }

  // only mechanics
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

  function _expire(uint256 _id) internal returns (uint256 _returnedAmount) {
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    Trade memory _trade = pendingTradesById[_id];
    require(_trade._deadline <= block.timestamp, 'TradeFactory: swap not expired');
    IERC20(_trade._tokenIn).safeTransfer(_trade._owner, _trade._amountIn);
    _returnedAmount = _trade._amountIn;
    _removePendingTrade(_trade._owner, _id);
    emit TradeExpired(_id);
  }

  function _enableSwapperToken(address _swapper, address _token) internal {
    IERC20(_token).safeApprove(_swapper, type(uint256).max);
    _approvedTokensBySwappers[_swapper].add(_token);
    emit SwapperAndTokenEnabled(_swapper, _token);
  }
}
