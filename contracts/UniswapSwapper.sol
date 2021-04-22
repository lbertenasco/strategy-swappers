// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './StrategySwapper.sol';

interface IUniswapSwapper is IStrategySwapper {
  function UNISWAP() external view returns (address);
}

contract UniswapSwapper is IUniswapSwapper, StrategySwapper {
  using SafeERC20 for IERC20;

  address public immutable override UNISWAP;

  constructor(
    address _uniswap,
    address _mechanicsRegistry,
    uint256 _slippagePrecision
  ) StrategySwapper(_mechanicsRegistry, _slippagePrecision) {
    UNISWAP = _uniswap;
  }

  function _getMinAmountOut(
    address[] memory _path,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal view returns (uint256 _minAmountOut) {
    uint256 _amountOut = IUniswapV2Router02(UNISWAP).getAmountsOut(_amountIn, _path)[0];
    _minAmountOut = _amountOut - ((_amountOut * _maxSlippage) / SLIPPAGE_PRECISION / 100);
  }

  function executeSwap(uint256 _id, address[] memory _path) external onlyMechanic isPendingSwap(_id) returns (uint256 _receivedAmount) {
    Swap memory _swapInformation = swapById[_id];
    Swap storage _swapInformation = _checkPreExecuteSwap(_id);

    IERC20(_path[0]).safeApprove(UNISWAP, 0);
    IERC20(_path[0]).safeApprove(UNISWAP, _swapInformation.amountIn);

    _receivedAmount = IUniswapV2Router02(UNISWAP).swapExactTokensForTokens(
      _swapInformation.amountIn,
      _getMinAmountOut(_path, _swapInformation.amountIn, _swapInformation.maxSlippage),
      _path,
      _swapInformation.from,
      _swapInformation.deadline
    )[0];
    _deletePendingSwap(_swapInformation);
  }
}
