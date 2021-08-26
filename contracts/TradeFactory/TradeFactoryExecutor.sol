// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '@lbertenasco/contract-utils/contracts/utils/Machinery.sol';

import '../utils/ITrade.sol';
import './TradeFactoryPositionsHandler.sol';

interface ITradeFactoryExecutor {
  event SyncTradeExecuted(
    address indexed _strategy,
    address indexed _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes _data,
    uint256 _receivedAmount
  );

  event AsyncTradeExecuted(uint256 indexed _id, uint256 _receivedAmount);

  event AsyncTradeExpired(uint256 indexed _id);

  event SwapperAndTokenEnabled(address indexed _swapper, address _token);

  error OngoingTrade();

  error ExpiredTrade();

  function execute(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata _data
  ) external returns (uint256 _receivedAmount);

  function execute(uint256 _id, bytes calldata _data) external returns (uint256 _receivedAmount);

  function executeMultiple(uint256[] calldata _ids, bytes calldata _data)
    external
    returns (uint256[] memory _receivedAmountsIn, uint256[] memory _receivedAmountsOut);

  function expire(uint256 _id) external returns (uint256 _freedAmount);
}

abstract contract TradeFactoryExecutor is ITradeFactoryExecutor, TradeFactoryPositionsHandler, Machinery {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableSet for EnumerableSet.AddressSet;

  constructor(address _mechanicsRegistry) Machinery(_mechanicsRegistry) {}

  // Machinery
  function setMechanicsRegistry(address _mechanicsRegistry) external virtual override onlyRole(MASTER_ADMIN) {
    _setMechanicsRegistry(_mechanicsRegistry);
  }

  function execute(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata _data
  ) external override onlyRole(STRATEGY) returns (uint256 _receivedAmount) {
    address _strategy = msg.sender; // not really needed but improves readability
    address _swapper = strategySyncSwapper[_strategy];
    if (_tokenIn == address(0) || _tokenOut == address(0)) revert CommonErrors.ZeroAddress();
    if (_amountIn == 0) revert CommonErrors.ZeroAmount();
    if (_maxSlippage == 0) revert CommonErrors.ZeroSlippage();
    IERC20(_tokenIn).safeTransferFrom(_strategy, _swapper, _amountIn);
    _receivedAmount = ISwapper(_swapper).swap(_strategy, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _data);
    emit SyncTradeExecuted(_strategy, _swapper, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _data, _receivedAmount);
  }

  // TradeFactoryExecutor
  function execute(uint256 _id, bytes calldata _data) external override onlyMechanic returns (uint256 _receivedAmount) {
    if (!_pendingTradesIds.contains(_id)) revert InvalidTrade();
    Trade memory _trade = pendingTradesById[_id];
    if (block.timestamp > _trade._deadline) revert ExpiredTrade();
    if (!_swappers.contains(_trade._swapper)) revert InvalidSwapper();
    IERC20(_trade._tokenIn).safeTransferFrom(_trade._strategy, _trade._swapper, _trade._amountIn);
    _receivedAmount = ISwapper(_trade._swapper).swap(
      _trade._strategy,
      _trade._tokenIn,
      _trade._tokenOut,
      _trade._amountIn,
      _trade._maxSlippage,
      _data
    );

    _removePendingTrade(_trade._strategy, _id);
    emit AsyncTradeExecuted(_id, _receivedAmount);
  }

  function executeMultiple(uint256[] calldata _ids, bytes calldata _data)
    external
    override
    onlyMechanic
    returns (uint256[] memory _receivedAmountIn, uint256[] memory _receivedAmountOut)
  {
    require(_ids.length > 0, 'TradeFactory: no ids');

    // address[] _strategies = new address[](_ids.length);
    ITrade.Trade[] memory _trades = new ITrade.Trade[](_ids.length);
    require(_pendingTradesIds.contains(_ids[0]), 'TradeFactory: trade not pending');
    require(block.timestamp <= pendingTradesById[_ids[0]]._deadline, 'TradeFactory: trade has expired');
    address _swapper = pendingTradesById[_ids[0]]._swapper;
    require(_swappers.contains(_swapper), 'TradeFactory: invalid swapper');
    // address _tokenIn = pendingTradesById[_ids[0]]._tokenIn;
    // address _tokenOut = pendingTradesById[_ids[0]]._tokenOut;
    // uint256 _amountIn = pendingTradesById[_ids[0]]._amountIn;
    _trades[0] = pendingTradesById[_ids[0]];

    // skips index 0
    for (uint256 i = 1; i < _ids.length; i++) {
      require(_pendingTradesIds.contains(_ids[i]), 'TradeFactory: trade not pending');
      ITrade.Trade memory _trade = pendingTradesById[_ids[i]];
      require(_trade._swapper == _swapper, 'TradeFactory: invalid swapper');
      require(block.timestamp <= _trade._deadline, 'TradeFactory: trade has expired');
      // if (!_approvedTokensBySwappers[_trade._swapper].contains(_trade._tokenIn)) {
      //   _enableSwapperToken(_trade._swapper, _trade._tokenIn);
      // }
      IERC20(_trade._tokenIn).safeTransferFrom(_trade._strategy, _trade._swapper, _trade._amountIn);
      // _strategies[i] = _trade._strategy;
      _trades[i] = _trade;
    }

    (_receivedAmountIn, _receivedAmountOut) = ISwapper(_swapper).swapMultiple(_trades, _data);

    for (uint256 i; i < _ids.length; i++) {
      _removePendingTrade(_trades[i]._strategy, _ids[i]);
    }
    // emit AsyncTradesExecuted(_ids, _receivedAmountIn, _receivedAmountOut);
  }

  function expire(uint256 _id) external override onlyMechanic returns (uint256 _freedAmount) {
    if (!_pendingTradesIds.contains(_id)) revert InvalidTrade();
    Trade memory _trade = pendingTradesById[_id];
    if (_trade._deadline < block.timestamp) revert OngoingTrade();
    _freedAmount = _trade._amountIn;
    // TODO Check: not entirely sure all ERC20 support same _from & _to on transfer. might brick on some tokens :/
    // We have to take tokens from strategy, to decrease the allowance, and send them back to strategy.
    IERC20(_trade._tokenIn).safeTransferFrom(_trade._strategy, _trade._strategy, _trade._amountIn);
    // // Send tokens back to strategy
    // IERC20(_trade._tokenIn).safeTransfer(_trade._strategy, _trade._amountIn);
    // Remove trade
    _removePendingTrade(_trade._strategy, _id);
    emit AsyncTradeExpired(_id);
  }
}
