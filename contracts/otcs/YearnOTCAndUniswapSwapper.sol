// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../YearnOTCSwapper.sol';
import '../UniswapSwapper.sol';

interface IYearnOTCAndUniswapSwapper is IYearnOTCSwapper, IUniswapSwapper {}

contract YearnOTCAndUniswapSwapper is IYearnOTCAndUniswapSwapper, YearnOTCSwapper, UniswapSwapper {
  using SafeERC20 for IERC20;

  constructor(
    address _uniswap,
    address _mechanicsRegistry,
    address _weth,
    uint256 _slippagePrecision
  ) UniswapSwapper(_uniswap, _mechanicsRegistry, _weth, _slippagePrecision) {}

  function _getTotalAmountOut(
    uint256 _amountIn,
    address _tokenIn,
    address _tokenOut
  ) internal view override returns (uint256 _amountOut) {
    _amountOut = IUniswapV2Router02(UNISWAP).getAmountsOut(_amountIn, _getPath(_tokenIn, _tokenOut))[0];
  }
}
