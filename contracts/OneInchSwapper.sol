// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import './StrategySwapper.sol';

interface IOneSplit {
  function getExpectedReturn(
    IERC20 fromToken,
    IERC20 destToken,
    uint256 amount,
    uint256 parts,
    uint256 flags
  ) external view returns (uint256 returnAmount, uint256[] memory distribution);

  function getExpectedReturnWithGas(
    IERC20 fromToken,
    IERC20 destToken,
    uint256 amount,
    uint256 parts,
    uint256 flags,
    uint256 destTokenEthPriceTimesGasPrice
  )
    external
    view
    returns (
      uint256 returnAmount,
      uint256 estimateGasAmount,
      uint256[] memory distribution
    );

  function swap(
    IERC20 fromToken,
    IERC20 destToken,
    uint256 amount,
    uint256 minReturn,
    uint256[] memory distribution,
    uint256 flags
  ) external payable returns (uint256 returnAmount);
}

interface IOneInchSwapper is IStrategySwapper {
  function ONE_INCH() external view returns (address);

  function executeSwap(
    uint256 _id,
    uint256 _parts,
    uint256 _flags
  ) external returns (uint256 _receivedAmount);
}

contract OneInchSwapper is IOneInchSwapper, StrategySwapper {
  using SafeERC20 for IERC20;

  address public immutable override ONE_INCH;

  constructor(
    address _oneInch,
    address _mechanicsRegistry,
    uint256 _slippagePrecision
  ) StrategySwapper(_mechanicsRegistry, _slippagePrecision) {
    ONE_INCH = _oneInch;
  }

  function _getMinAmountOut(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _parts,
    uint256 _flags,
    uint256 _maxSlippage
  ) internal view returns (uint256 _minAmountOut, uint256[] memory) {
    (uint256 _amountOut, uint256[] memory _distribution) =
      IOneSplit(ONE_INCH).getExpectedReturn(IERC20(_tokenIn), IERC20(_tokenOut), _amountIn, _parts, _flags);
    _minAmountOut = _amountOut - ((_amountOut * _maxSlippage) / SLIPPAGE_PRECISION / 100);
    return (_minAmountOut, _distribution);
  }

  function executeSwap(
    uint256 _id,
    uint256 _parts,
    uint256 _flags
  ) external override onlyMechanic isPendingSwap(_id) returns (uint256 _receivedAmount) {
    Swap storage _swapInformation = _checkPreExecuteSwap(_id);
    (uint256 _minAmountOut, uint256[] memory _distribution) =
      _getMinAmountOut(
        _swapInformation.tokenIn,
        _swapInformation.tokenOut,
        _swapInformation.amountIn,
        _parts,
        _flags,
        _swapInformation.maxSlippage
      );
    _receivedAmount = IOneSplit(ONE_INCH).swap(
      IERC20(_swapInformation.tokenIn),
      IERC20(_swapInformation.tokenOut),
      _swapInformation.amountIn,
      _minAmountOut,
      _distribution,
      _flags
    );
    IERC20(_swapInformation.tokenOut).safeTransfer(_swapInformation.from, _receivedAmount);
    _deletePendingSwap(_swapInformation);
  }
}
