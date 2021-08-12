// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../Swapper.sol';

interface IUniswapV2Swapper is ISwapper {
  // solhint-disable-next-line func-name-mixedcase
  function WETH() external view returns (address);

  // solhint-disable-next-line func-name-mixedcase
  function UNISWAP_FACTORY() external view returns (address);

  // solhint-disable-next-line func-name-mixedcase
  function UNISWAP_ROUTER() external view returns (address);
}

contract UniswapV2Swapper is IUniswapV2Swapper, Swapper {
  using SafeERC20 for IERC20;

  // solhint-disable-next-line var-name-mixedcase
  SwapperType public constant override SWAPPER_TYPE = SwapperType.SYNC;

  // solhint-disable-next-line var-name-mixedcase
  address public immutable override WETH;
  // solhint-disable-next-line var-name-mixedcase
  address public immutable override UNISWAP_FACTORY;
  // solhint-disable-next-line var-name-mixedcase
  address public immutable override UNISWAP_ROUTER;

  constructor(
    address _governor,
    address _tradeFactory,
    address _weth,
    address _uniswapFactory,
    address _uniswapRouter
  ) Swapper(_governor, _tradeFactory) {
    WETH = _weth;
    UNISWAP_FACTORY = _uniswapFactory;
    UNISWAP_ROUTER = _uniswapRouter;
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata
  ) internal override returns (uint256 _receivedAmount) {
    (address[] memory _path, uint256 _amountOut) = _getPathAndAmountOut(_tokenIn, _tokenOut, _amountIn);
    IERC20(_path[0]).safeApprove(UNISWAP_ROUTER, 0);
    IERC20(_path[0]).safeApprove(UNISWAP_ROUTER, _amountIn);
    _receivedAmount = IUniswapV2Router02(UNISWAP_ROUTER).swapExactTokensForTokens(
      _amountIn,
      _amountOut - ((_amountOut * _maxSlippage) / SLIPPAGE_PRECISION / 100), // slippage calcs
      _path,
      _receiver,
      block.timestamp
    )[0];
  }

  function _getPathAndAmountOut(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn
  ) internal view returns (address[] memory _path, uint256 _amountOut) {
    uint256 _amountOutByDirectPath;
    address[] memory _directPath;

    if (IUniswapV2Factory(UNISWAP_FACTORY).getPair(_tokenIn, _tokenOut) != address(0)) {
      _directPath = new address[](2);
      _directPath[0] = _tokenIn;
      _directPath[1] = _tokenOut;
      _amountOutByDirectPath = IUniswapV2Router02(UNISWAP_ROUTER).getAmountsOut(_amountIn, _directPath)[1];
    }

    uint256 _amountOutByWETHHopPath;
    // solhint-disable-next-line var-name-mixedcase
    address[] memory _WETHHopPath;
    if (
      IUniswapV2Factory(UNISWAP_FACTORY).getPair(_tokenIn, WETH) != address(0) &&
      IUniswapV2Factory(UNISWAP_FACTORY).getPair(WETH, _tokenOut) != address(0)
    ) {
      _WETHHopPath = new address[](3);
      _WETHHopPath[0] = _tokenIn;
      _WETHHopPath[1] = WETH;
      _WETHHopPath[2] = _tokenOut;
      _amountOutByWETHHopPath = IUniswapV2Router02(UNISWAP_ROUTER).getAmountsOut(_amountIn, _WETHHopPath)[2];
    }

    if (_amountOutByDirectPath >= _amountOutByWETHHopPath) return (_directPath, _amountOutByDirectPath);

    return (_WETHHopPath, _amountOutByWETHHopPath);
  }
}
