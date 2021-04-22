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
    address _weth,
    address _mechanicsRegistry,
    uint256 _slippagePrecision
  ) StrategySwapper(_mechanicsRegistry, _weth, _slippagePrecision) {
    UNISWAP = _uniswap;
  }

  function _getMinAmountOut(
    uint256 _amountIn,
    uint256 _maxSlippage,
    address[] memory _path
  ) internal view returns (uint256 _minAmountOut) {
    uint256 _amountOut = IUniswapV2Router02(UNISWAP).getAmountsOut(_amountIn, _path)[0];
    _minAmountOut = _amountOut - ((_amountOut * _maxSlippage) / SLIPPAGE_PRECISION / 100);
  }

  function _getPath(address _tokenIn, address _tokenOut) internal view returns (address[] memory _path) {
    _tokenIn = (_tokenIn == ETH) ? WETH : _tokenIn;
    _tokenIn = (_tokenOut == ETH) ? WETH : _tokenOut;

    if (_tokenOut == WETH) {
      _path = new address[](2);
      _path[0] = _tokenIn;
      _path[1] = _tokenOut;
    } else {
      _path = new address[](3);
      _path[0] = _tokenIn;
      _path[1] = WETH;
      _path[2] = _tokenOut;
    }
  }

  function executeSwap(uint256 _id) external onlyMechanic isPendingSwap(_id) returns (uint256 _receivedAmount) {
    Swap storage _swapInformation = _checkPreExecuteSwap(_id);

    address[] memory _path = _getPath(_swapInformation.tokenIn, _swapInformation.tokenOut);
    uint256 _minAmountOut = _getMinAmountOut(_swapInformation.amountIn, _swapInformation.maxSlippage, _path);

    if (_swapInformation.tokenIn == ETH) {
      _receivedAmount = IUniswapV2Router02(UNISWAP).swapExactETHForTokens{value: _swapInformation.amountIn}(
        _minAmountOut,
        _path,
        _swapInformation.from,
        _swapInformation.deadline
      )[0];
    } else {
      IERC20(_path[0]).safeApprove(UNISWAP, 0);
      IERC20(_path[0]).safeApprove(UNISWAP, _swapInformation.amountIn);

      if (_swapInformation.tokenOut == ETH) {
        _receivedAmount = IUniswapV2Router02(UNISWAP).swapExactTokensForETH(
          _swapInformation.amountIn,
          _minAmountOut,
          _path,
          _swapInformation.from,
          _swapInformation.deadline
        )[0];
      } else {
        _receivedAmount = IUniswapV2Router02(UNISWAP).swapExactTokensForTokens(
          _swapInformation.amountIn,
          _minAmountOut,
          _path,
          _swapInformation.from,
          _swapInformation.deadline
        )[0];
      }
    }

    _deletePendingSwap(_swapInformation);
  }
}
