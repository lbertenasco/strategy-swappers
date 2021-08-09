// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import 'hardhat/console.sol';

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '../../Swapper.sol';

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
  ) external payable;
}

interface IOneInchSwapper is ISwapper {
  // solhint-disable-next-line func-name-mixedcase
  function ONE_INCH() external view returns (address);

  function parts() external view returns (uint256);

  function flags() external view returns (uint256);

  function setParts(uint256 _parts) external;

  function setFlags(uint256 _flags) external;
}

contract OneInchSwapper is IOneInchSwapper, Swapper {
  using SafeERC20 for IERC20;

  // solhint-disable-next-line var-name-mixedcase
  SwapperType public override SWAPPER_TYPE = SwapperType.SYNC;

  // solhint-disable-next-line var-name-mixedcase
  address public immutable override ONE_INCH;
  uint256 public override parts;
  uint256 public override flags;

  constructor(
    address _governor,
    address _tradeFactory,
    address _oneInch,
    uint256 _parts,
    uint256 _flags
  ) Swapper(_governor, _tradeFactory) {
    require(_parts > 0, 'Swapper: Parts should be non zero');
    ONE_INCH = _oneInch;
    parts = _parts;
    flags = _flags;
  }

  function setParts(uint256 _parts) external override onlyGovernor {
    require(_parts > 0, 'Swapper: Parts should be non zero');
    parts = _parts;
  }

  function setFlags(uint256 _flags) external override onlyGovernor {
    flags = _flags;
  }

  function _getMinAmountOut(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal view returns (uint256 _minAmountOut, uint256[] memory) {
    (uint256 _amountOut, uint256[] memory _distribution) = IOneSplit(ONE_INCH).getExpectedReturn(
      IERC20(_tokenIn),
      IERC20(_tokenOut),
      _amountIn,
      parts,
      flags
    );
    _minAmountOut = _amountOut - ((_amountOut * _maxSlippage) / SLIPPAGE_PRECISION / 100);
    return (_minAmountOut, _distribution);
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata
  ) internal override returns (uint256 _receivedAmount) {
    (uint256 _minAmountOut, uint256[] memory _distribution) = _getMinAmountOut(_tokenIn, _tokenOut, _amountIn, _maxSlippage);
    IERC20(_tokenIn).safeApprove(ONE_INCH, 0);
    IERC20(_tokenIn).safeApprove(ONE_INCH, _amountIn);
    IOneSplit(ONE_INCH).swap(IERC20(_tokenIn), IERC20(_tokenOut), _amountIn, _minAmountOut, _distribution, parts);
    _receivedAmount = IERC20(_tokenOut).balanceOf(address(this));
    IERC20(_tokenOut).safeTransfer(_receiver, _receivedAmount);
  }
}
