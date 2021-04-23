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

  function executeSwap(uint256 _id) external onlyMechanic isPendingSwap(_id) returns (uint256 _receivedAmount) {
    Swap storage _swapInformation = _checkPreExecuteSwap(_id);

    _receivedAmount = _executeUniswap(
      _swapInformation.from,
      _swapInformation.tokenIn,
      _swapInformation.tokenOut,
      _swapInformation.amountIn,
      _swapInformation.maxSlippage
    );

    _deletePendingSwap(_swapInformation);
  }

  function _executeUniswap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal returns (uint256 _receivedAmount) {
    address[] memory _path = _getPath(_tokenIn, _tokenOut);
    uint256 _minAmountOut = _getMinAmountOut(_amountIn, _maxSlippage, _path);

    if (_tokenIn == ETH) {
      _receivedAmount = IUniswapV2Router02(UNISWAP).swapExactETHForTokens{value: _amountIn}(
        _minAmountOut,
        _path,
        _receiver,
        block.timestamp + 1800
      )[0];
    } else {
      IERC20(_path[0]).safeApprove(UNISWAP, 0);
      IERC20(_path[0]).safeApprove(UNISWAP, _amountIn);

      if (_tokenOut == ETH) {
        _receivedAmount = IUniswapV2Router02(UNISWAP).swapExactTokensForETH(_amountIn, _minAmountOut, _path, _receiver, block.timestamp + 1800)[
          0
        ];
      } else {
        _receivedAmount = IUniswapV2Router02(UNISWAP).swapExactTokensForTokens(
          _amountIn,
          _minAmountOut,
          _path,
          _receiver,
          block.timestamp + 1800
        )[0];
      }
    }
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
}
