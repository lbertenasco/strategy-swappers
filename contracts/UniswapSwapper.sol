// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './StrategySwapper.sol';

interface IUniswapSwapper is IStrategySwapper {
  function FEE_PRECISION() external view returns (uint256);

  function UNISWAP() external view returns (address);
}

contract UniswapSwapper is IUniswapSwapper {
  using SafeERC20 for IERC20;

  uint256 public immutable override FEE_PRECISION;
  address public immutable override UNISWAP;

  constructor(address _uniswap, uint256 _feePrecision) {
    UNISWAP = _uniswap;
    FEE_PRECISION = _feePrecision;
  }

  function _getMinAmountOut(
    address[] memory _path,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal view returns (uint256 _minAmountOut) {
    uint256 _amountOut = IUniswapV2Router02(UNISWAP).getAmountsOut(_amountIn, _path)[0];
    _minAmountOut = _amountOut - ((_amountOut * _maxSlippage) / FEE_PRECISION / 100);
  }

  function _swap(
    address _from,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) internal returns (uint256 _receivedAmount) {
    IERC20(_tokenIn).safeTransferFrom(_from, address(this), _amountIn);

    address[] memory _path = new address[](2);
    _path[0] = _tokenIn;
    _path[1] = _tokenOut;

    IERC20(_path[0]).safeApprove(UNISWAP, 0);
    IERC20(_path[0]).safeApprove(UNISWAP, _amountIn);

    _receivedAmount = IUniswapV2Router02(UNISWAP).swapExactTokensForTokens(
      _amountIn,
      _getMinAmountOut(_path, _amountIn, _maxSlippage),
      _path,
      _from,
      _deadline
    )[0];
  }

  function swap(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline,
    bytes[] memory
  ) external override returns (uint256 _receivedAmount) {
    _receivedAmount = _swap(msg.sender, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }

  function claim() external override returns (uint256 _receivedAmount) {}

  function swapAndClaim(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline,
    bytes[] memory
  ) external override returns (uint256 _receivedAmount) {
    _receivedAmount = _swap(msg.sender, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }
}
