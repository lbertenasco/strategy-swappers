// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import './TradeFactorySwapperHandler.sol';
import '../Swapper.sol';

interface ITradeFactoryPositionsHandler {
  struct Trade {
    uint256 _id;
    address _strategy;
    address _swapper;
    address _tokenIn;
    address _tokenOut;
    uint256 _amountIn;
    uint256 _maxSlippage;
    uint256 _deadline;
  }

  event TradeCreated(
    uint256 indexed _id,
    address _strategy,
    address _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  );

  event TradeCanceled(address indexed _strategy, uint256 indexed _id);

  event TradesCanceled(address indexed _strategy, uint256[] _ids);

  event TradesSwapperChanged(address indexed _strategy, uint256[] _ids, address _newSwapper);

  error InvalidTrade();

  error InvalidDeadline();

  function pendingTradesById(uint256)
    external
    view
    returns (
      uint256 _id,
      address _strategy,
      address _swapper,
      address _tokenIn,
      address _tokenOut,
      uint256 _amountIn,
      uint256 _maxSlippage,
      uint256 _deadline
    );

  function pendingTradesIds() external view returns (uint256[] memory _pendingIds);

  function pendingTradesIds(address _strategy) external view returns (uint256[] memory _pendingIds);

  function create(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external returns (uint256 _id);

  function cancelPending(uint256 _id) external;

  function cancelAllPending() external returns (uint256[] memory _canceledTradesIds);

  function setStrategyAsyncSwapperAsAndChangePending(
    address _strategy,
    address _swapper,
    bool _migrateSwaps
  ) external returns (uint256[] memory _changedSwapperIds);

  function changeStrategyPendingTradesSwapper(address _strategy, address _swapper) external returns (uint256[] memory _changedSwapperIds);
}

abstract contract TradeFactoryPositionsHandler is ITradeFactoryPositionsHandler, TradeFactorySwapperHandler {
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant STRATEGY = keccak256('STRATEGY');
  bytes32 public constant STRATEGY_ADDER = keccak256('STRATEGY_ADDER');

  uint256 private _tradeCounter = 1;

  mapping(uint256 => Trade) public override pendingTradesById;

  EnumerableSet.UintSet internal _pendingTradesIds;

  mapping(address => EnumerableSet.UintSet) internal _pendingTradesByOwner;

  constructor(address _strategyAdder) {
    _setRoleAdmin(STRATEGY, STRATEGY_ADDER);
    _setRoleAdmin(STRATEGY_ADDER, MASTER_ADMIN);
    _setupRole(STRATEGY_ADDER, _strategyAdder);
  }

  function pendingTradesIds() external view override returns (uint256[] memory _pendingIds) {
    _pendingIds = new uint256[](_pendingTradesIds.length());
    for (uint256 i; i < _pendingTradesIds.length(); i++) {
      _pendingIds[i] = _pendingTradesIds.at(i);
    }
  }

  function pendingTradesIds(address _strategy) external view override returns (uint256[] memory _pendingIds) {
    _pendingIds = new uint256[](_pendingTradesByOwner[_strategy].length());
    for (uint256 i; i < _pendingTradesByOwner[_strategy].length(); i++) {
      _pendingIds[i] = _pendingTradesByOwner[_strategy].at(i);
    }
  }

  function create(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external override onlyRole(STRATEGY) returns (uint256 _id) {
    if (strategyAsyncSwapper[msg.sender] == address(0)) revert InvalidSwapper();
    if (_tokenIn == address(0) || _tokenOut == address(0)) revert CommonErrors.ZeroAddress();
    if (_amountIn == 0) revert CommonErrors.ZeroAmount();
    if (_maxSlippage == 0) revert CommonErrors.ZeroSlippage();
    if (_deadline <= block.timestamp) revert InvalidDeadline();
    _id = _tradeCounter;
    Trade memory _trade = Trade(
      _tradeCounter,
      msg.sender,
      strategyAsyncSwapper[msg.sender],
      _tokenIn,
      _tokenOut,
      _amountIn,
      _maxSlippage,
      _deadline
    );
    pendingTradesById[_trade._id] = _trade;
    _pendingTradesByOwner[msg.sender].add(_trade._id);
    _pendingTradesIds.add(_trade._id);
    _tradeCounter += 1;
    emit TradeCreated(
      _trade._id,
      _trade._strategy,
      _trade._swapper,
      _trade._tokenIn,
      _trade._tokenOut,
      _trade._amountIn,
      _trade._maxSlippage,
      _trade._deadline
    );
  }

  function cancelPending(uint256 _id) external override onlyRole(STRATEGY) {
    if (!_pendingTradesIds.contains(_id)) revert InvalidTrade();
    if (pendingTradesById[_id]._strategy != msg.sender) revert CommonErrors.NotAuthorized();
    Trade memory _trade = pendingTradesById[_id];
    _removePendingTrade(_trade._strategy, _id);
    emit TradeCanceled(msg.sender, _id);
  }

  function cancelAllPending() external override onlyRole(STRATEGY) returns (uint256[] memory _canceledTradesIds) {
    _canceledTradesIds = new uint256[](_pendingTradesByOwner[msg.sender].length());
    for (uint256 i; i < _pendingTradesByOwner[msg.sender].length(); i++) {
      _canceledTradesIds[i] = _pendingTradesByOwner[msg.sender].at(i);
    }
    for (uint256 i; i < _canceledTradesIds.length; i++) {
      _removePendingTrade(msg.sender, _canceledTradesIds[i]);
    }
    emit TradesCanceled(msg.sender, _canceledTradesIds);
  }

  function setStrategyAsyncSwapperAsAndChangePending(
    address _strategy,
    address _swapper,
    bool _migrateSwaps
  ) external override onlyRole(SWAPPER_SETTER) returns (uint256[] memory _changedSwapperIds) {
    this.setStrategyAsyncSwapper(_strategy, _swapper);
    if (_migrateSwaps) {
      return _changeStrategyPendingTradesSwapper(_strategy, _swapper);
    }
  }

  function changeStrategyPendingTradesSwapper(address _strategy, address _swapper)
    external
    override
    onlyRole(SWAPPER_SETTER)
    returns (uint256[] memory _changedSwapperIds)
  {
    if (!_swappers.contains(_swapper)) revert InvalidSwapper();
    return _changeStrategyPendingTradesSwapper(_strategy, _swapper);
  }

  function _changeStrategyPendingTradesSwapper(address _strategy, address _swapper) internal returns (uint256[] memory _changedSwapperIds) {
    _changedSwapperIds = new uint256[](_pendingTradesByOwner[_strategy].length());
    for (uint256 i; i < _pendingTradesByOwner[_strategy].length(); i++) {
      pendingTradesById[_pendingTradesByOwner[_strategy].at(i)]._swapper = _swapper;
      _changedSwapperIds[i] = _pendingTradesByOwner[_strategy].at(i);
    }
    emit TradesSwapperChanged(_strategy, _changedSwapperIds, _swapper);
  }

  function _removePendingTrade(address _strategy, uint256 _id) internal {
    _pendingTradesByOwner[_strategy].remove(_id);
    _pendingTradesIds.remove(_id);
    delete pendingTradesById[_id];
  }
}
