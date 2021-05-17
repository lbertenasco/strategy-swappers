// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../Swapper.sol';

contract SwapperMock is Swapper {

  event MyInternalExecuteSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  );
  
  constructor(address _governor, address _tradeFactory) Swapper(_governor, _tradeFactory) {}

  function modifierOnlyTradeFactory() external onlyTradeFactory { }

  function assertPreSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) external {
    _assertPreSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage);
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal override returns (uint256 _receivedAmount) {
    emit MyInternalExecuteSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage);
    _receivedAmount = 1_000;
  }
}
