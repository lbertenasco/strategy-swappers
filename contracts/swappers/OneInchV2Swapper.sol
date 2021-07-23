// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../Swapper.sol';

interface IOneInchCaller {
  struct CallDescription {
    uint256 targetWithMandatory;
    uint256 gasLimit;
    uint256 value;
    bytes data;
  }

  function makeCall(CallDescription memory desc) external;

  function makeCalls(CallDescription[] memory desc) external payable;
}

interface IOneInchExchange {
  struct SwapDescription {
    IERC20 srcToken;
    IERC20 dstToken;
    address srcReceiver;
    address dstReceiver;
    uint256 amount;
    uint256 minReturnAmount;
    uint256 guaranteedAmount;
    uint256 flags;
    address referrer;
    bytes permit;
  }

  function discountedSwap(
    IOneInchCaller caller,
    SwapDescription calldata desc,
    IOneInchCaller.CallDescription[] calldata calls
  ) external payable returns (uint256 returnAmount);

  function swap(
    IOneInchCaller caller,
    SwapDescription calldata desc,
    IOneInchCaller.CallDescription[] calldata calls
  ) external payable returns (uint256 returnAmount);
}

interface IOneInchSwapper is IOneInchCaller, ISwapper {
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

  function makeCall(CallDescription memory desc) external override {}

  function makeCalls(CallDescription[] memory desc) external payable override {}

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
    //     amount: _minAmountOut,
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
