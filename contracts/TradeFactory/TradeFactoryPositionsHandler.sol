// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

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

  function setStrategySwapperAndChangePending(
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
  bytes32 public constant STRATEGY_ADMIN = keccak256('STRATEGY_ADMIN');

  uint256 private _tradeCounter = 1;

  mapping(uint256 => Trade) public override pendingTradesById;

  EnumerableSet.UintSet internal _pendingTradesIds;

  mapping(address => EnumerableSet.UintSet) internal _pendingTradesByOwner;

  constructor() {
    _setRoleAdmin(STRATEGY, STRATEGY_ADMIN);
    _setRoleAdmin(STRATEGY_ADMIN, MASTER_ADMIN);
    _setupRole(STRATEGY_ADMIN, governor);
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
    require(strategySwapper[msg.sender] != address(0), 'TF: no strategy swapper');
    require(ISwapper(strategySwapper[msg.sender]).SWAPPER_TYPE() == ISwapper.SwapperType.ASYNC, 'TF: not async swapper');
    require(_tokenIn != address(0) && _tokenOut != address(0), 'TradeFactory: zero address');
    require(_amountIn > 0, 'TradeFactory: zero amount');
    require(_maxSlippage > 0, 'TradeFactory: zero slippage');
    require(block.timestamp < _deadline, 'TradeFactory: deadline too soon');
    _id = _tradeCounter;
    Trade memory _trade = Trade(_tradeCounter, msg.sender, strategySwapper[msg.sender], _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
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
    require(_pendingTradesIds.contains(_id), 'TradeFactory: trade not pending');
    require(pendingTradesById[_id]._strategy == msg.sender, 'TradeFactory: does not own trade');
    Trade memory _trade = pendingTradesById[_id];
    _removePendingTrade(_trade._strategy, _id);
    emit TradeCanceled(msg.sender, _id);
  }

  function cancelAllPending() external override onlyRole(STRATEGY) returns (uint256[] memory _canceledTradesIds) {
    require(_pendingTradesByOwner[msg.sender].length() > 0, 'TradeFactory: no trades pending from strategy');
    _canceledTradesIds = new uint256[](_pendingTradesByOwner[msg.sender].length());
    for (uint256 i; i < _pendingTradesByOwner[msg.sender].length(); i++) {
      _canceledTradesIds[i] = _pendingTradesByOwner[msg.sender].at(i);
    }
    for (uint256 i; i < _canceledTradesIds.length; i++) {
      _removePendingTrade(msg.sender, _canceledTradesIds[i]);
    }
    emit TradesCanceled(msg.sender, _canceledTradesIds);
  }

  function setStrategySwapperAndChangePending(
    address _strategy,
    address _swapper,
    bool _migrateSwaps
  ) external override onlyRole(SWAPPER_SETTER) returns (uint256[] memory _changedSwapperIds) {
    this.setStrategySwapper(_strategy, _swapper);
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
    require(_swappers.contains(_swapper), 'TradeFactory: invalid swapper');
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
