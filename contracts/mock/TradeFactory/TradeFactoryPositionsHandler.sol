// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../TradeFactory/TradeFactoryPositionsHandler.sol';

contract TradeFactoryPositionsHandlerMock is TradeFactoryPositionsHandler {
  constructor(address _swapperRegistry) TradeFactoryPositionsHandler(_swapperRegistry) {}

  function createWithOwner(
    string memory _swapper,
    address _owner,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external returns (uint256 _id) {
    _id = _create(_swapper, _owner, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }
  
  function setSwapperSafetyCheckpointToAddress(address _address,uint256 _checkpoint) external {
    swapperSafetyCheckpoint[_address] = _checkpoint;
  }
}