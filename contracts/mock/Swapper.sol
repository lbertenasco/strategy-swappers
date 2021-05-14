// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../Swapper.sol';

contract SwapperMock is Swapper {
  
  constructor(address _governor, address _tradeFactory) Swapper(_governor, _tradeFactory) {}

  function modifierOnlyTradeFactory() external onlyTradeFactory { }

  function assetPreSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) external {
    _assertPreSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage);
  }

  function _executeSwap(
    address,
    address _tokenIn,
    address,
    uint256 _amountIn,
    uint256
  ) internal override returns (uint256 _receivedAmount) {
    IERC20(_tokenIn).transfer(address(0), _amountIn);
    _receivedAmount = 1_000;
  }
}
