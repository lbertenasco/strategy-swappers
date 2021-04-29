// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import './StrategySwapper.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

interface IYearnOTCSwapper is IStrategySwapper {
  function executeOTCSwap(uint256 _id, uint256 _providedAmount) external returns (uint256 _receivedAmount);
}

// TODO: Adapt for ETH (in-out trades the OTC part)

abstract contract YearnOTCSwapper is IYearnOTCSwapper, StrategySwapper {
  using SafeERC20 for IERC20;

  function _getTotalAmountOut(
    uint256 _amountIn,
    address _tokenIn,
    address _tokenOut
  ) internal view virtual returns (uint256 _amountOut);

  function executeOTCSwap(uint256 _id, uint256 _providedAmount)
    external
    override
    onlyMechanic
    isPendingSwap(_id)
    returns (uint256 _receivedAmount)
  {
    Swap storage _swapInformation = _checkPreExecuteSwap(_id);

    // Take in from swapper
    uint256 _totalOutNeeded = _getTotalAmountOut(_swapInformation.amountIn, _swapInformation.tokenIn, _swapInformation.tokenOut);
    IERC20(_swapInformation.tokenOut).safeTransferFrom(msg.sender, address(this), _providedAmount);

    // Send what should be sent to swapper
    uint256 _rewardedIn = _getTotalAmountOut(_providedAmount, _swapInformation.tokenOut, _swapInformation.tokenIn);
    IERC20(_swapInformation.tokenIn).safeTransfer(msg.sender, _rewardedIn);

    // Buy what's missing from uniswap
    if (_providedAmount < _totalOutNeeded) {
      uint256 _toBuyFromFallbackSwapper = _swapInformation.amountIn - _rewardedIn;

      _receivedAmount = _executeSwap(
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
