// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import 'hardhat/console.sol';

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '@lbertenasco/contract-utils/contracts/utils/Machinery.sol';

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

  event AsyncTradesMatched(
    uint256 indexed _anchorTradeId,
    uint256 indexed _againstTradeId,
    uint256 _anchorAmountInConsumed,
    uint256 _anchorAmountOutGot,
    uint256 _againstAmountInConsumed,
    uint256 _againstAmountOutGot
  );

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

  function expire(uint256 _id) external returns (uint256 _freedAmount);
}

abstract contract TradeFactoryExecutor is ITradeFactoryExecutor, TradeFactoryPositionsHandler, Machinery {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant TRADES_SETTLER = keccak256('TRADES_SETTLER');

  constructor(address _tradesSettler, address _mechanicsRegistry) Machinery(_mechanicsRegistry) {
    _setRoleAdmin(TRADES_SETTLER, MASTER_ADMIN);
    _setupRole(TRADES_SETTLER, _tradesSettler);
  }

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
    address _swapper = strategySyncSwapper[msg.sender];
    if (_tokenIn == address(0) || _tokenOut == address(0)) revert CommonErrors.ZeroAddress();
    if (_amountIn == 0) revert CommonErrors.ZeroAmount();
    if (_maxSlippage == 0) revert CommonErrors.ZeroSlippage();
    IERC20(_tokenIn).safeTransferFrom(msg.sender, _swapper, _amountIn);
    _receivedAmount = ISwapper(_swapper).swap(msg.sender, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _data);
    emit SyncTradeExecuted(msg.sender, _swapper, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _data, _receivedAmount);
  }

  // TradeFactoryExecutor
  function execute(uint256 _id, bytes calldata _data) external override onlyMechanic returns (uint256 _receivedAmount) {
    if (!_pendingTradesIds.contains(_id)) revert InvalidTrade();
    Trade storage _trade = pendingTradesById[_id];
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

  function expire(uint256 _id) external override onlyMechanic returns (uint256 _freedAmount) {
    if (!_pendingTradesIds.contains(_id)) revert InvalidTrade();
    Trade storage _trade = pendingTradesById[_id];
    if (block.timestamp < _trade._deadline) revert OngoingTrade();
    _freedAmount = _trade._amountIn;
    // We have to take tokens from strategy, to decrease the allowance
    IERC20(_trade._tokenIn).safeTransferFrom(_trade._strategy, address(this), _trade._amountIn);
    // Send tokens back to strategy
    IERC20(_trade._tokenIn).safeTransfer(_trade._strategy, _trade._amountIn);
    // Remove trade
    _removePendingTrade(_trade._strategy, _id);
    emit AsyncTradeExpired(_id);
  }

  function execute(
    uint256 _anchorTradeId,
    uint256 _againstTradeId,
    uint256 _rateAnchorTokenInToTokenOut
  ) external onlyRole(TRADES_SETTLER) returns (uint256 _receivedAmountAnchorTrade, uint256 _receivedAmountAgainstTrade) {
    Trade storage _anchorTrade = pendingTradesById[_anchorTradeId];
    Trade storage _againstTrade = pendingTradesById[_againstTradeId];
    if (_anchorTrade._tokenIn != _againstTrade._tokenOut || _anchorTrade._tokenOut != _againstTrade._tokenIn) revert InvalidTrade();
    if (block.timestamp > _anchorTrade._deadline || block.timestamp > _againstTrade._deadline) revert ExpiredTrade();

    uint256 _magnitudeAnchorIn = 10**IERC20Metadata(_anchorTrade._tokenIn).decimals();
    uint256 _totalAnchorOut = (_anchorTrade._amountIn * _rateAnchorTokenInToTokenOut) / _magnitudeAnchorIn;

    if (_totalAnchorOut < _againstTrade._amountIn) {
      // Anchor trade gets fully consumed
      IERC20(_anchorTrade._tokenIn).safeTransferFrom(_anchorTrade._strategy, _againstTrade._strategy, _anchorTrade._amountIn);
      // Anchor trade gets fully filled
      IERC20(_anchorTrade._tokenOut).safeTransferFrom(_againstTrade._strategy, _anchorTrade._strategy, _totalAnchorOut);
      // Update against
      _againstTrade._amountIn = _againstTrade._amountIn - _totalAnchorOut;
      // Emit event (before removing trade, since we are using storage)
      emit AsyncTradesMatched(
        _anchorTradeId,
        _againstTradeId,
        _anchorTrade._amountIn, //_anchorAmountInConsumed
        _totalAnchorOut, // _anchorAmountOutGot
        _totalAnchorOut, // _againstAmountInConsumed
        _anchorTrade._amountIn // _againstAmountOutGot
      );
      // Remove anchor (executed)
      _removePendingTrade(_anchorTrade._strategy, _anchorTradeId);
    } else if (_totalAnchorOut > _againstTrade._amountIn) {
      uint256 _magnitudeAnchorOut = 10**IERC20Metadata(_anchorTrade._tokenOut).decimals();
      uint256 _rateAnchorTokenOutToTokenIn = (_magnitudeAnchorIn * _magnitudeAnchorOut) / _rateAnchorTokenInToTokenOut;
      uint256 _totalAgainstOut = (_againstTrade._amountIn * _rateAnchorTokenOutToTokenIn) / _magnitudeAnchorOut;
      // Against trade gets fully consumed
      IERC20(_againstTrade._tokenIn).safeTransferFrom(_againstTrade._strategy, _anchorTrade._strategy, _againstTrade._amountIn);
      // Against trade gets fully filled
      IERC20(_againstTrade._tokenOut).safeTransferFrom(_anchorTrade._strategy, _againstTrade._strategy, _totalAgainstOut);
      // Update anchor
      _anchorTrade._amountIn = _anchorTrade._amountIn - _totalAgainstOut;
      // Emit event (before removing trade, since we are using storage)
      emit AsyncTradesMatched(
        _anchorTradeId,
        _againstTradeId,
        _totalAgainstOut, //_anchorAmountInConsumed
        _againstTrade._amountIn, // _anchorAmountOutGot
        _againstTrade._amountIn, // _againstAmountInConsumed
        _totalAgainstOut // _againstAmountOutGot
      );
      // Remove against (executed)
      _removePendingTrade(_againstTrade._strategy, _againstTradeId);
    } else {
      // Anchor gets consumed
      IERC20(_anchorTrade._tokenIn).safeTransferFrom(_anchorTrade._strategy, _againstTrade._strategy, _anchorTrade._amountIn);
      // Against gets consumed
      IERC20(_againstTrade._tokenIn).safeTransferFrom(_againstTrade._strategy, _anchorTrade._strategy, _againstTrade._amountIn);
      // Emit event (before removing trade, since we are using storage)
      emit AsyncTradesMatched(
        _anchorTradeId,
        _againstTradeId,
        _anchorTrade._amountIn, //_anchorAmountInConsumed
        _totalAnchorOut, // _anchorAmountOutGot
        _againstTrade._amountIn, // _againstAmountInConsumed
        _anchorTrade._amountIn // _againstAmountOutGot
      );
      // Remove anchor (executed)
      _removePendingTrade(_anchorTrade._strategy, _anchorTradeId);
      // Remove against (executed)
      _removePendingTrade(_againstTrade._strategy, _againstTradeId);
    }
  }
}
