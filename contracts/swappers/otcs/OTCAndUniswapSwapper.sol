// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../../OTCSwapper.sol';
import '../UniswapSwapper.sol';

interface IOTCAndUniswapSwapper is IOTCSwapper, IUniswapSwapper {}

contract OTCAndUniswapSwapper is IOTCAndUniswapSwapper, OTCSwapper, UniswapSwapper {
  using SafeERC20 for IERC20;

  constructor(
    address _otcPool,
    address _uniswap,
    address _mechanicsRegistry,
    address _weth,
    uint256 _slippagePrecision
  ) OTCSwapper(_otcPool) UniswapSwapper(_uniswap, _mechanicsRegistry, _weth, _slippagePrecision) {}

  function _getTotalAmountOut(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn
  ) internal view override returns (uint256 _amountOut) {
    _amountOut = IUniswapV2Router02(UNISWAP).getAmountsOut(_amountIn, _getPath(_tokenIn, _tokenOut))[0];
  }
}
