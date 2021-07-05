// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import 'hardhat/console.sol';
import '../SwapperRegistry.sol';

interface ITradeFactoryPositionsHandler {
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

  function pendingTradesIds() external view returns (uint256[] memory _pendingIds);

  function pendingTradesIds(address _owner) external view returns (uint256[] memory _pendingIds);

  function swapperSafetyCheckpoint(address) external view returns (uint256);

  function SWAPPER_REGISTRY() external view returns (address);

  function setSwapperSafetyCheckpoint(uint256 _checkpoint) external;

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
}

abstract contract TradeFactoryPositionsHandler is ITradeFactoryPositionsHandler {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;

  uint256 private _tradeCounter = 1;

  mapping(uint256 => Trade) public override pendingTradesById;

  mapping(address => uint256) public override swapperSafetyCheckpoint;

  EnumerableSet.UintSet internal _pendingTradesIds;

  mapping(address => EnumerableSet.UintSet) internal _pendingTradesByOwner;

  address public immutable override SWAPPER_REGISTRY;

  constructor(address _swapperRegistry) {
    SWAPPER_REGISTRY = _swapperRegistry;
  }

  modifier onlyStrategy {
    require(msg.sender == msg.sender, 'TradeFactory: not a strategy'); // TODO:
    _;
  }

  function pendingTradesIds() external view override returns (uint256[] memory _pendingIds) {
    _pendingIds = new uint256[](_pendingTradesIds.length());
    for (uint256 i; i < _pendingTradesIds.length(); i++) {
      _pendingIds[i] = _pendingTradesIds.at(i);
    }
  }

  function pendingTradesIds(address _owner) external view override returns (uint256[] memory _pendingIds) {
    _pendingIds = new uint256[](_pendingTradesByOwner[_owner].length());
    for (uint256 i; i < _pendingTradesByOwner[_owner].length(); i++) {
      _pendingIds[i] = _pendingTradesByOwner[_owner].at(i);
    }
  }

  function create(
    string memory _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external override onlyStrategy returns (uint256 _id) {
    _id = _create(_swapper, msg.sender, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }

  function cancelPending(uint256 _id) external override onlyStrategy {
    require(pendingTradesById[_id]._owner == msg.sender, 'TradeFactory: does not own trade');
    _cancelPending(_id);
  }

  function cancelAllPending() external override onlyStrategy returns (uint256[] memory _canceledTradesIds) {
    _canceledTradesIds = _cancelAllPendingOfOwner(msg.sender);
  }

  function changePendingTradesSwapper(string memory _swapper) external override onlyStrategy returns (uint256[] memory _changedSwapperIds) {
    _changedSwapperIds = _changePendingTradesSwapperOfOwner(msg.sender, _swapper);
  }

  function setSwapperSafetyCheckpoint(uint256 _checkpoint) external override onlyStrategy {
    require(_checkpoint <= block.timestamp, 'TradeFactory: invalid checkpoint');
    swapperSafetyCheckpoint[msg.sender] = _checkpoint;
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
    (bool _existsSwapper, address _swapperAddress, uint256 _swapperInitialization) = SwapperRegistry(SWAPPER_REGISTRY).isSwapper(_swapper);
    require(_existsSwapper, 'TradeFactory: invalid swapper');
    require(_swapperInitialization <= swapperSafetyCheckpoint[_owner], 'TradeFactory: initialization greater than checkpoint');
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
    _tradeCounter += 1;
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

  function _cancelPending(uint256 _id) internal {
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    Trade memory _trade = pendingTradesById[_id];
    _removePendingTrade(_trade._owner, _id);
    emit TradeCanceled(_id);
  }

  function _cancelAllPendingOfOwner(address _owner) internal returns (uint256[] memory _canceledTradesIds) {
    require(_pendingTradesByOwner[_owner].length() > 0, 'TradeFactory: no trades pending from user');
    _canceledTradesIds = new uint256[](_pendingTradesByOwner[_owner].length());
    for (uint256 i; i < _pendingTradesByOwner[_owner].length(); i++) {
      _canceledTradesIds[i] = _pendingTradesByOwner[_owner].at(i);
    }
    for (uint256 i; i < _canceledTradesIds.length; i++) {
      _removePendingTrade(_owner, _canceledTradesIds[i]);
    }
    emit TradesOfOwnerCanceled(_owner, _canceledTradesIds);
  }

  function _removePendingTrade(address _owner, uint256 _id) internal {
    _pendingTradesByOwner[_owner].remove(_id);
    _pendingTradesIds.remove(_id);
    delete pendingTradesById[_id];
  }

  function _changePendingTradesSwapperOfOwner(address _owner, string memory _swapper) internal returns (uint256[] memory _changedSwapperIds) {
    (bool _existsSwapper, address _swapperAddress, uint256 _swapperInitialization) = SwapperRegistry(SWAPPER_REGISTRY).isSwapper(_swapper);
    require(!_existsSwapper, 'TradeFactory: invalid swapper');
    require(_swapperInitialization <= swapperSafetyCheckpoint[_owner], 'TradeFactory: initialization greater than checkpoint');
    _changedSwapperIds = new uint256[](_pendingTradesByOwner[_owner].length());
    for (uint256 i; i < _pendingTradesByOwner[_owner].length(); i++) {
      pendingTradesById[_pendingTradesByOwner[_owner].at(i)]._swapper = _swapperAddress;
      _changedSwapperIds[i] = _pendingTradesByOwner[_owner].at(i);
    }
    emit TradesOfOwnerChangedSwapper(_owner, _changedSwapperIds, _swapper);
  }
}
