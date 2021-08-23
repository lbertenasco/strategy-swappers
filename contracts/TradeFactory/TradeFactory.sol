// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '@lbertenasco/contract-utils/contracts/utils/CollectableDust.sol';

import './TradeFactoryPositionsHandler.sol';
import './TradeFactoryExecutor.sol';

interface ITradeFactory is ITradeFactoryExecutor, ITradeFactoryPositionsHandler {}

contract TradeFactory is TradeFactoryExecutor, CollectableDust, ITradeFactory {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;
  using EnumerableSet for EnumerableSet.AddressSet;

  constructor(
    address _masterAdmin,
    address _swapperAdder,
    address _swapperSetter,
    address _strategyAdder,
    address _mechanicsRegistry
  )
    TradeFactoryAccessManager(_masterAdmin)
    TradeFactoryPositionsHandler(_strategyAdder)
    TradeFactorySwapperHandler(_swapperAdder, _swapperSetter)
    TradeFactoryExecutor(_mechanicsRegistry)
  {}

  // Collectable Dust
  function sendDust(
    address _to,
    address _token,
    uint256 _amount
  ) external virtual override onlyRole(MASTER_ADMIN) {
    _sendDust(_to, _token, _amount);
  }
}
