// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
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
  struct Swap {
    uint256 id;
    address from;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 maxSlippage;
    uint256 deadline;
  }

  function FEE_PRECISION() external view returns (uint256);

  function ONE_INCH() external view returns (address);
}

contract OneInchSwapper is IOneInchSwapper {
  using SafeERC20 for IERC20;

  Swap[] pendingSwaps;
  mapping(uint256 => Swap) swapById;
  uint256 public immutable override FEE_PRECISION;
  address public immutable override ONE_INCH;

  constructor(address _oneInch, uint256 _feePrecision) {
    ONE_INCH = _oneInch;
    FEE_PRECISION = _feePrecision;
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
    _minAmountOut = _amountOut - ((_amountOut * _maxSlippage) / FEE_PRECISION / 100);
    return (_minAmountOut, _distribution);
  }

  function _swap(
    address _from,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) internal {
    IERC20(_tokenIn).safeTransferFrom(_from, address(this), _amountIn);
    uint256 _id = 0;
    Swap memory _swapInformation =
      Swap(
        _id, // id
        _from,
        _tokenIn,
        _tokenOut,
        _amountIn,
        _maxSlippage,
        _deadline
      );
    pendingSwaps.push(_swapInformation);
    swapById[_id] = _swapInformation;
  }

  function swap(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external override {
    _swap(msg.sender, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }

  function executeSwap(
    uint256 _id,
    uint256 _parts,
    uint256 _flags
  ) public returns (uint256 _receivedAmount) {
    // requires
    // check deadline
    // only mechanics
    Swap memory _swapInformation = swapById[_id];
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
  }
}
