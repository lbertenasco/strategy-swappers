// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './UniswapSwapper.sol';

interface IYearnOTCAndUniswapSwapper is IUniswapSwapper {}

// TODO: Adapt for ETH (in-out trades the OTC part)

contract YearnOTCAndUniswapSwapper is IYearnOTCAndUniswapSwapper, UniswapSwapper {
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
  ) internal view returns (uint256 _amountOut) {
    _amountOut = IUniswapV2Router02(UNISWAP).getAmountsOut(_amountIn, _getPath(_tokenIn, _tokenOut))[0];
  }

  function executeSwap(
    uint256 _id,
    uint256 _providedAmount,
    address[] memory _path
  ) external onlyMechanic isPendingSwap(_id) returns (uint256 _receivedAmount) {
    Swap storage _swapInformation = _checkPreExecuteSwap(_id);

    // Take in from swapper
    uint256 _totalOutNeeded = _getTotalAmountOut(_swapInformation.amountIn, _swapInformation.tokenIn, _swapInformation.tokenOut);
    IERC20(_swapInformation.tokenOut).safeTransferFrom(msg.sender, address(this), _providedAmount);

    // Send what should be sent to swapper
    uint256 _rewardedIn = _getTotalAmountOut(_providedAmount, _swapInformation.tokenOut, _swapInformation.tokenIn);
    IERC20(_swapInformation.tokenIn).safeTransfer(msg.sender, _rewardedIn);

    // Buy what's missing from uniswap
    if (_providedAmount < _totalOutNeeded) {
      uint256 _toBuyFromUniswap = _swapInformation.amountIn - _rewardedIn;

      _receivedAmount = _executeUniswap(
        _swapInformation.from,
        _swapInformation.tokenIn,
        _swapInformation.tokenOut,
        _toBuyFromUniswap,
        _swapInformation.maxSlippage
      );
    }

    _deletePendingSwap(_swapInformation);
  }
}
