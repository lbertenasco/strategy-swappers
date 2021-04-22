// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './StrategySwapper.sol';

interface IYearnOTCAndUniswapSwapper is IStrategySwapper {
  function UNISWAP() external view returns (address);
}

contract YearnOTCAndUniswapSwapper is IYearnOTCAndUniswapSwapper, StrategySwapper {
  using SafeERC20 for IERC20;

  address public immutable override UNISWAP;

  constructor(
    address _uniswap,
    address _mechanicsRegistry,
    address _weth,
    uint256 _slippagePrecision
  ) StrategySwapper(_mechanicsRegistry, _weth, _slippagePrecision) {
    UNISWAP = _uniswap;
  }

  function _getMinAmountOut(
    uint256 _amountIn,
    uint256 _maxSlippage,
    address[] memory _path
  ) internal view returns (uint256 _minAmountOut) {
    uint256 _amountOut = _getTotalAmountOut(_amountIn, _path);
    _minAmountOut = _amountOut - ((_amountOut * _maxSlippage) / SLIPPAGE_PRECISION / 100);
  }

  function _getTotalAmountOut(uint256 _amountIn, address[] memory _path) internal view returns (uint256 _amountOut) {
    _amountOut = IUniswapV2Router02(UNISWAP).getAmountsOut(_amountIn, _path)[0];
  }

  function executeSwap(
    uint256 _id,
    uint256 _providedAmount,
    address[] memory _path
  ) external onlyMechanic isPendingSwap(_id) returns (uint256 _receivedAmount) {
    Swap storage _swapInformation = _checkPreExecuteSwap(_id);

    // Take in from swapper
    uint256 _totalOutNeeded = _getTotalAmountOut(_swapInformation.amountIn, _path);
    IERC20(_swapInformation.tokenIn).safeTransferFrom(msg.sender, address(this), _providedAmount);

    // Send what should be sent to swapper
    uint256 _rewardedIn = _getTotalAmountOut(_providedAmount, _path); // reverse path
    IERC20(_swapInformation.tokenIn).safeTransfer(msg.sender, _rewardedIn);

    // Buy what's missing from uniswap
    if (_providedAmount < _totalOutNeeded) {
      uint256 _toBuyFromUniswap = _swapInformation.amountIn - _rewardedIn;

      IERC20(_path[0]).safeApprove(UNISWAP, 0);
      IERC20(_path[0]).safeApprove(UNISWAP, _toBuyFromUniswap);

      _receivedAmount = IUniswapV2Router02(UNISWAP).swapExactTokensForTokens(
        _toBuyFromUniswap,
        _getMinAmountOut(_toBuyFromUniswap, _swapInformation.maxSlippage, _path),
        _path,
        _swapInformation.from,
        _swapInformation.deadline
      )[0];
    }

    _deletePendingSwap(_swapInformation);
  }
}
