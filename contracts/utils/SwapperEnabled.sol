// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../TradeFactory.sol';

interface ISwapperEnabled {
  event TradeFactorySet(address indexed _tradeFactory);
  event SwapperSet(string indexed _swapper);

  function tradeFactory() external returns (address _tradeFactory);

  function swapper() external returns (string memory _swapper);

  function setSwapper(string calldata _swapper, bool _migrateSwaps) external;

  function setTradeFactory(address _tradeFactory) external;

  function setSwapperCheckpoint(uint256 _checkpoint) external;

  function createTrade(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external returns (uint256 _id);

  function cancelPendingTrades(uint256[] calldata _pendingTrades) external;
}

/*
 * SwapperEnabled Abstract
 */
abstract contract SwapperEnabled is ISwapperEnabled {
  using SafeERC20 for IERC20;

  address public override tradeFactory;
  string public override swapper;

  constructor(address _tradeFactory) {
    _setTradeFactory(_tradeFactory);
  }

  // onlyMultisig:
  function _setTradeFactory(address _tradeFactory) internal {
    tradeFactory = _tradeFactory;
    emit TradeFactorySet(_tradeFactory);
  }

  // onlyStrategist or multisig:
  function _setSwapper(string calldata _swapper, bool _migrateSwaps) internal {
    swapper = _swapper;
    if (_migrateSwaps) {
      ITradeFactory(tradeFactory).changePendingTradesSwapper(_swapper);
    }
    emit SwapperSet(_swapper);
  }

  // onlyMultisig or internal use:
  function _createTrade(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) internal returns (uint256 _id) {
    return _createTrade(swapper, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }

  function _createTrade(
    string memory _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) internal returns (uint256 _id) {
    IERC20(_tokenIn).safeIncreaseAllowance(tradeFactory, _amountIn);
    return ITradeFactory(tradeFactory).create(_swapper, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }

  // onlyMultisig:
  function _setSwapperCheckpoint(uint256 _checkpoint) internal {
    // TODO Create setSwapperCheckpoint on TradeFactory
    // ITradeFactory(tradeFactory).setSwapperCheckpoint(_checkpoint);
  }

  // onlyStrategist or multisig:
  function _cancelPendingTrades(uint256[] calldata _pendingTrades) internal {
    for (uint256 i; i < _pendingTrades.length; i++) {
      _cancelPendingTrade(_pendingTrades[i]);
    }
  }

  function _cancelPendingTrade(uint256 _pendingTradeId) internal {
    (, , , address _tokenIn, , uint256 _amountIn, , ) = ITradeFactory(tradeFactory).pendingTradesById(_pendingTradeId);
    IERC20(_tokenIn).safeDecreaseAllowance(tradeFactory, _amountIn);
    ITradeFactory(tradeFactory).cancelPending(_pendingTradeId);
  }

  function _tradeFactoryAllowance(address _token) internal view returns (uint256 _allowance) {
    return IERC20(_token).allowance(address(this), tradeFactory);
  }
}
