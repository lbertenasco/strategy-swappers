// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '../Swapper.sol';

interface ISushiswapPolygonSwapper is ISwapper {
  function WMATIC() external view returns (address);

  function WETH() external view returns (address);

  function UNISWAP_FACTORY() external view returns (address);

  function UNISWAP_ROUTER() external view returns (address);
}

contract SushiswapPolygonSwapper is ISushiswapPolygonSwapper, Swapper {
  using SafeERC20 for IERC20;

  address public immutable override WETH;
  address public immutable override WMATIC;
  address public immutable override UNISWAP_FACTORY;
  address public immutable override UNISWAP_ROUTER;

  constructor(
    address _governor,
    address _tradeFactory,
    address _weth,
    address _wmatic,
    address _uniswapFactory,
    address _uniswapRouter
  ) Swapper(_governor, _tradeFactory) {
    WETH = _weth;
    WMATIC = _wmatic;
    UNISWAP_FACTORY = _uniswapFactory;
    UNISWAP_ROUTER = _uniswapRouter;
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal override returns (uint256 _receivedAmount) {
    (address[] memory _path, uint256 _minAmountOut) = _getMinAmountOutAndPath(_tokenIn, _tokenOut, _amountIn, _maxSlippage);
    IERC20(_path[0]).safeApprove(UNISWAP_ROUTER, 0);
    IERC20(_path[0]).safeApprove(UNISWAP_ROUTER, _amountIn);
    _receivedAmount = IUniswapV2Router02(UNISWAP_ROUTER).swapExactTokensForTokens(
      _amountIn,
      _minAmountOut,
      _path,
      _receiver,
      block.timestamp + 1800
    )[0];
  }

  function _getMinAmountOut(
    uint256 _amountIn,
    uint256 _maxSlippage,
    address[] memory _path
  ) internal view returns (uint256 _minAmountOut) {
    uint256 _amountOut = IUniswapV2Router02(UNISWAP_ROUTER).getAmountsOut(_amountIn, _path)[0];
    _minAmountOut = _amountOut - ((_amountOut * _maxSlippage) / SLIPPAGE_PRECISION / 100);
  }

  function _getMinAmountOutAndPath(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal view returns (address[] memory _path, uint256 _minAmountOut) {
    uint256 _minAmountByDirectPath;
    address[] memory _directPath;
    if (_tokenIn == WMATIC || _tokenOut == WMATIC || IUniswapV2Factory(UNISWAP_FACTORY).getPair(_tokenIn, _tokenOut) != address(0)) {
      _directPath = new address[](2);
      _directPath[0] = _tokenIn;
      _directPath[1] = _tokenOut;
      _minAmountByDirectPath = _getMinAmountOut(_amountIn, _maxSlippage, _directPath);
    }

    uint256 _minAmountByWETHHopPath;
    address[] memory _WETHHopPath;
    if (
      IUniswapV2Factory(UNISWAP_FACTORY).getPair(_tokenIn, WETH) != address(0) &&
      IUniswapV2Factory(UNISWAP_FACTORY).getPair(WETH, _tokenOut) != address(0)
    ) {
      _directPath = new address[](2);
      _WETHHopPath[0] = _tokenIn;
      _WETHHopPath[1] = WETH;
      _WETHHopPath[2] = _tokenOut;
      _minAmountByWETHHopPath = _getMinAmountOut(_amountIn, _maxSlippage, _WETHHopPath);
    }

    uint256 _minAmountByWMATICHopPath;
    address[] memory _WMATICHopPath;
    if (
      IUniswapV2Factory(UNISWAP_FACTORY).getPair(_tokenIn, WMATIC) != address(0) &&
      IUniswapV2Factory(UNISWAP_FACTORY).getPair(WMATIC, _tokenOut) != address(0)
    ) {
      _directPath = new address[](2);
      _WMATICHopPath[0] = _tokenIn;
      _WMATICHopPath[1] = WMATIC;
      _WMATICHopPath[2] = _tokenOut;
      _minAmountByWMATICHopPath = _getMinAmountOut(_amountIn, _maxSlippage, _WMATICHopPath);
    }

    if (
      Math.max(Math.max(_minAmountByDirectPath, _minAmountByWETHHopPath), Math.max(_minAmountByDirectPath, _minAmountByWMATICHopPath)) ==
      _minAmountByDirectPath
    ) {
      return (_directPath, _minAmountByDirectPath);
    }

    if (Math.max(_minAmountByWETHHopPath, _minAmountByWMATICHopPath) == _minAmountByWETHHopPath) {
      return (_WETHHopPath, _minAmountByWETHHopPath);
    }

    return (_WMATICHopPath, _minAmountByWMATICHopPath);
  }
}
