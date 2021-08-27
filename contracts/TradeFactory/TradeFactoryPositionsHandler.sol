// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import './ITradeFactoryPositionsHandler.sol';
import './TradeFactorySwapperHandler.sol';
import '../Swapper.sol';

abstract contract TradeFactoryPositionsHandler is ITradeFactoryPositionsHandler, TradeFactorySwapperHandler {
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant STRATEGY = keccak256('STRATEGY');
  bytes32 public constant STRATEGY_ADDER = keccak256('STRATEGY_ADDER');
  bytes32 public constant TRADES_MODIFIER = keccak256('TRADES_MODIFIER');

  uint256 private _tradeCounter = 1;

  mapping(uint256 => Trade) public override pendingTradesById;

  EnumerableSet.UintSet internal _pendingTradesIds;

  mapping(address => EnumerableSet.UintSet) internal _pendingTradesByOwner;

  constructor(address _strategyAdder, address _tradesModifier) {
    if (_strategyAdder == address(0) || _tradesModifier == address(0)) revert CommonErrors.ZeroAddress();
    _setRoleAdmin(STRATEGY, STRATEGY_ADDER);
    _setRoleAdmin(STRATEGY_ADDER, MASTER_ADMIN);
    _setupRole(STRATEGY_ADDER, _strategyAdder);
    _setRoleAdmin(TRADES_MODIFIER, MASTER_ADMIN);
    _setupRole(TRADES_MODIFIER, _tradesModifier);
  }

  function pendingTradesIds() external view override returns (uint256[] memory _pendingIds) {
    _pendingIds = _pendingTradesIds.values();
  }

  function pendingTradesIds(address _strategy) external view override returns (uint256[] memory _pendingIds) {
    _pendingIds = _pendingTradesByOwner[_strategy].values();
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

  function cancelPendingTrades(uint256[] calldata _ids) external override onlyRole(STRATEGY) {
    for (uint256 i; i < _ids.length; i++) {
      if (!_pendingTradesIds.contains(_ids[i])) revert InvalidTrade();
      if (pendingTradesById[_ids[i]]._strategy != msg.sender) revert CommonErrors.NotAuthorized();
      _removePendingTrade(msg.sender, _ids[i]);
    }
    emit TradesCanceled(msg.sender, _ids);
  }

  // onlyStrategyHandler or master admin ?
  function changePendingTradesSwapper(uint256[] calldata _ids, address _swapper) external override onlyRole(TRADES_MODIFIER) {
    if (ISwapper(_swapper).SWAPPER_TYPE() != ISwapper.SwapperType.ASYNC) revert NotAsyncSwapper();
    if (!_swappers.contains(_swapper)) revert InvalidSwapper();
    for (uint256 i; i < _ids.length; i++) {
      if (!_pendingTradesIds.contains(_ids[i])) revert InvalidTrade();
      pendingTradesById[_ids[i]]._swapper = _swapper;
    }
    emit TradesSwapperChanged(_ids, _swapper);
  }

  function mergePendingTrades(uint256 _anchorTradeId, uint256[] calldata _toMergeIds) external override onlyRole(TRADES_MODIFIER) {
    Trade storage _anchorTrade = pendingTradesById[_anchorTradeId];
    for (uint256 i; i < _toMergeIds.length; i++) {
      Trade storage _trade = pendingTradesById[_toMergeIds[i]];
      if (
        _anchorTrade._id == _trade._id ||
        _anchorTrade._strategy != _trade._strategy ||
        _anchorTrade._tokenIn != _trade._tokenIn ||
        _anchorTrade._tokenOut != _trade._tokenOut
      ) revert InvalidTrade();
      _anchorTrade._amountIn += _trade._amountIn;
      _removePendingTrade(_trade._strategy, _trade._id);
    }
    emit TradesMerged(_anchorTradeId, _toMergeIds);
  }

  function _removePendingTrade(address _strategy, uint256 _id) internal {
    _pendingTradesByOwner[_strategy].remove(_id);
    _pendingTradesIds.remove(_id);
    delete pendingTradesById[_id];
  }
}
