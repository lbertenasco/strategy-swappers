// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './OTCPool/OTCPool.sol';
import './Swapper.sol';

interface IOTCSwapper is ISwapper {
  function getTotalAmountOut(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn
  ) external view returns (uint256 _amountOut);
}

abstract contract OTCSwapper is IOTCSwapper, Swapper {
  using SafeERC20 for IERC20;

  address immutable otcPool;

  constructor(address _otcPool) {
    otcPool = _otcPool;
  }

  function getTotalAmountOut(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn
  ) external view virtual override returns (uint256 _amountOut) {
    _amountOut = _getTotalAmountOut(_tokenIn, _tokenOut, _amountIn);
  }

  function _getTotalAmountOut(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn
  ) internal view virtual returns (uint256 _amountOut);

  // only trade factory ?
  function swap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) external override(ISwapper, Swapper) returns (uint256 _receivedAmount) {
    _assertPreSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage);
    IERC20(_tokenIn).safeTransferFrom(msg.sender, address(this), _amountIn);
    _receivedAmount = _executeOTCSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage);
    emit Swapped(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _receivedAmount);
  }

  // todo: only trade factory ?
  function _executeOTCSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal returns (uint256 _receivedAmount) {
    uint256 _usedBySwapper;

    (_receivedAmount, _usedBySwapper) = IOTCPool(otcPool).takeOffer(_tokenIn, _tokenOut, _amountIn);

    // Buy what's missing from fallback swapper
    if (_usedBySwapper < _amountIn) {
      uint256 _toBuyFromFallbackSwapper = _amountIn - _usedBySwapper;

      _receivedAmount += _executeSwap(_receiver, _tokenIn, _tokenOut, _toBuyFromFallbackSwapper, _maxSlippage);
    }
  }
}