// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../../../OTCSwapper.sol';
import '../UniswapV2Swapper.sol';

interface IOTCAndUniswapV2Swapper is IOTCSwapper, IUniswapV2Swapper {}

contract OTCAndUniswapV2Swapper is IOTCAndUniswapV2Swapper, OTCSwapper, UniswapV2Swapper {
  using SafeERC20 for IERC20;

  constructor(
    address _otcPool,
    address _governor,
    address _tradeFactory,
    address _weth,
    address _uniswapFactory,
    address _uniswapRouter
  ) OTCSwapper(_otcPool) UniswapV2Swapper(_governor, _tradeFactory, _weth, _uniswapFactory, _uniswapRouter) {}

  function _getTotalAmountOut(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn
  ) internal view override returns (uint256 _amountOut) {
    (, _amountOut) = _getPathAndAmountOut(_tokenIn, _tokenOut, _amountIn);
  }
}
