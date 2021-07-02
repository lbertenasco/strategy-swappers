// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '../../TradeFactory/TradeFactoryPositionsHandler.sol';

contract TradeFactoryPositionsHandlerMock is TradeFactoryPositionsHandler {
  constructor(address _swapperRegistry) TradeFactoryPositionsHandler(_swapperRegistry) {}

  function create(
    string memory _swapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _deadline
  ) external override returns (uint256 _id) {
    _id = _create(_swapper, msg.sender, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _deadline);
  }

  function cancelPending(uint256 _id) external override {
    require(pendingTradesById[_id]._owner == msg.sender, 'TradeFactory: does not own trade');
    _cancelPending(_id);
  }

  function cancelAllPending() external override returns (uint256[] memory _canceledTradesIds) {
    _canceledTradesIds = _cancelAllPendingOfOwner(msg.sender);
  }

  function changePendingTradesSwapper(string memory _swapper) external override returns (uint256[] memory _changedSwapperIds) {
    _changedSwapperIds = _changePendingTradesSwapperOfOwner(msg.sender, _swapper);
  }

  function setSwapperSafetyCheckpoint(uint256 _checkpoint) external override {
    _setSwapperSafetyCheckpoint(msg.sender, _checkpoint);
  }
}