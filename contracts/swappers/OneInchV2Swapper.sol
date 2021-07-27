// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../Swapper.sol';

interface IAggregationExecutor {
  function callBytes(bytes calldata data) external payable; // 0xd9c45357
}

interface IOneInchExchange {
  struct SwapDescription {
    IERC20 srcToken;
    IERC20 dstToken;
    address srcReceiver;
    address dstReceiver;
    uint256 amount;
    uint256 minReturnAmount;
    uint256 flags;
    bytes permit;
  }

  event Swapped(address sender, IERC20 srcToken, IERC20 dstToken, address dstReceiver, uint256 spentAmount, uint256 returnAmount);

  receive() external payable;

  function unoswapWithPermit(
    IERC20 srcToken,
    uint256 amount,
    uint256 minReturn,
    bytes32[] calldata pools,
    bytes calldata permit
  ) external payable returns (uint256 returnAmount);

  function unoswap(
    IERC20 srcToken,
    uint256 amount,
    uint256 minReturn,
    bytes32[] calldata
  ) external payable returns (uint256 returnAmount);

  function discountedSwap(
    IAggregationExecutor caller,
    SwapDescription calldata desc,
    bytes calldata data
  )
    external
    payable
    returns (
      uint256 returnAmount,
      uint256 gasLeft,
      uint256 chiSpent
    );

  function swap(
    IAggregationExecutor caller,
    SwapDescription calldata desc,
    bytes calldata data
  ) external payable returns (uint256 returnAmount, uint256 gasLeft);
}

interface IOneInchSwapper is IAggregationExecutor, ISwapper {
  function AGGREGATION_ROUTER_V3() external view returns (address);

  function parts() external view returns (uint256);

  function flags() external view returns (uint256);

  function setParts(uint256 _parts) external;

  function setFlags(uint256 _flags) external;
}

contract OneInchV2Swapper is IOneInchSwapper, Swapper {
  using SafeERC20 for IERC20;

  address public immutable override AGGREGATION_ROUTER_V3;
  uint256 public override parts;
  uint256 public override flags;

  constructor(
    address _governor,
    address _tradeFactory,
    address _aggregationRouter,
    uint256 _parts,
    uint256 _flags
  ) Swapper(_governor, _tradeFactory) {
    require(_parts > 0, 'Swapper: Parts should be non zero');
    AGGREGATION_ROUTER_V3 = _aggregationRouter;
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
  ) internal view returns (uint256 _minAmountOut) {
    return 1;
  }

  function callBytes(bytes calldata data) external payable override {}

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata _data
  ) internal override returns (uint256 _receivedAmount) {
    // uint256 _minAmountOut = _getMinAmountOut(_tokenIn, _tokenOut, _amountIn, _maxSlippage);
    // CallDescription[] memory _callDescriptions = new CallDescription[](0);
    // bytes memory _permit;
    // IERC20(_tokenIn).safeApprove(ONE_INCH, 0);
    // IERC20(_tokenIn).safeApprove(ONE_INCH, _amountIn);
    // _receivedAmount = IOneInchExchange(ONE_INCH).swap(
    //   IOneInchCaller(address(this)),
    //   IOneInchExchange.SwapDescription({
    //     srcToken: IERC20(_tokenIn),
    //     dstToken: IERC20(_tokenOut),
    //     srcReceiver: address(0),
    //     dstReceiver: _receiver,
    //     amount: _amountIn,
    //     minReturnAmount: _minAmountOut,
    //     guaranteedAmount: 0,
    //     flags: 0,
    //     referrer: address(0),
    //     permit: _permit
    //   }),
    //   _callDescriptions
    // );
  }
}
