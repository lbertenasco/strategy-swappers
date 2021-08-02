// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../Swapper.sol';

import 'hardhat/console.sol';

interface IZRXSwapper is ISwapper {
  struct Transformation {
    uint32 _uint32;
    bytes _bytes;
  }

  function ZRX() external view returns (address);
}

contract ZRXSwapper is IZRXSwapper, Swapper {
  using SafeERC20 for IERC20;

  address public immutable override ZRX;

  constructor(
    address _governor,
    address _tradeFactory,
    address _ZRX
  ) Swapper(_governor, _tradeFactory) {
    ZRX = _ZRX;
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256, // Max slippage is used off-chain
    bytes calldata _data
  ) internal override returns (uint256 _receivedAmount) {
    (address inputToken, address outputToken, uint256 inputAmount, , ) = abi.decode(
      _data[4:],
      (address, address, uint256, uint256, Transformation[])
    );

    require(inputToken == _tokenIn && outputToken == _tokenOut && inputAmount == _amountIn, 'Swapper: incorrect swap information');
    IERC20(_tokenIn).safeApprove(ZRX, 0);
    IERC20(_tokenIn).safeApprove(ZRX, _amountIn);
    (bool success, ) = ZRX.call{value: 0}(_data);
    require(success, 'Swapper: ZRX trade reverted');
    IERC20(_tokenOut).safeTransfer(_receiver, IERC20(_tokenOut).balanceOf(address(this)));
  }
}
