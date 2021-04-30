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

  function executeOTCSwap(uint256 _id) external returns (uint256 _receivedAmount);
}

// TODO: Adapt for ETH (in-out trades the OTC part)

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

  function executeOTCSwap(uint256 _id) external override onlyMechanic isPendingSwap(_id) returns (uint256 _receivedAmount) {
    Swap storage _swapInformation = _checkPreExecuteSwap(_id);

    uint256 _usedBySwapper;

    (_receivedAmount, _usedBySwapper) = IOTCPool(otcPool).takeOffer(
      _swapInformation.tokenIn,
      _swapInformation.tokenOut,
      _swapInformation.amountIn
    );

    // Buy what's missing from uniswap
    if (_usedBySwapper < _swapInformation.amountIn) {
      uint256 _toBuyFromFallbackSwapper = _swapInformation.amountIn - _usedBySwapper;

      _receivedAmount += _executeSwap(
        _swapInformation.from,
        _swapInformation.tokenIn,
        _swapInformation.tokenOut,
        _toBuyFromFallbackSwapper,
        _swapInformation.maxSlippage
      );
    }

    _deletePendingSwap(_swapInformation);
  }
}
