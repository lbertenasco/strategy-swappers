// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../../OTCSwapper.sol';
import '../OneInchSwapper.sol';

interface IOTCAndOneInchSwapper is IOTCSwapper, IOneInchSwapper {}

contract OTCAndOneInchSwapper is IOTCAndOneInchSwapper, OTCSwapper, OneInchSwapper {
  using SafeERC20 for IERC20;

  constructor(
    address _otcPool,
    address _oneInch,
    address _weth,
    uint256 _slippagePrecision
  ) OTCSwapper(_otcPool) OneInchSwapper(_oneInch, _weth, _slippagePrecision) {}

  function _getTotalAmountOut(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn
  ) internal view override returns (uint256 _amountOut) {
    uint256 _parts = 1; // should inherit from one inch swapper
    uint256 _flags = 0; // should inherit from one inch swapper
    (_amountOut, ) = IOneSplit(ONE_INCH).getExpectedReturn(IERC20(_tokenIn), IERC20(_tokenOut), _amountIn, _parts, _flags);
  }
}
