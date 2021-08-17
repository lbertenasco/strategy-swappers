// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '../Swapper.sol';
import './TradeFactoryAccessManager.sol';

interface ITradeFactorySwapperHandler {
  event SyncStrategySwapperSet(address indexed _strategy, address _swapper);
  event AsyncStrategySwapperSet(address indexed _strategy, address _swapper);
  event SwapperAdded(address _swapper);
  event SwapperRemoved(address _swapper);

  function strategySyncSwapper(address _strategy) external view returns (address _swapper);

  function strategyAsyncSwapper(address _strategy) external view returns (address _swapper);

  function swappers() external view returns (address[] memory _swappersList);

  function isSwapper(address _swapper) external view returns (bool);

  function swapperStrategies(address _swapper) external view returns (address[] memory _strategies);

  function setStrategySyncSwapper(address _strategy, address _swapper) external;

  function setStrategyAsyncSwapper(address _strategy, address _swapper) external;

  function addSwapper(address _swapper) external;

  function addSwappers(address[] memory __swappers) external;

  function removeSwapper(address _swapper) external;

  function removeSwappers(address[] memory __swappers) external;
}

abstract contract TradeFactorySwapperHandler is ITradeFactorySwapperHandler, TradeFactoryAccessManager {
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant SWAPPER_ADDER = keccak256('SWAPPER_ADDER');
  bytes32 public constant SWAPPER_SETTER = keccak256('SWAPPER_SETTER');

  // swappers list
  EnumerableSet.AddressSet internal _swappers;
  // swapper -> strategy list (useful to know if we can safely deprecate a swapper)
  mapping(address => EnumerableSet.AddressSet) internal _swapperStrategies;
  // strategy -> async swapper
  mapping(address => address) public override strategyAsyncSwapper;
  // strategy -> sync swapper
  mapping(address => address) public override strategySyncSwapper;

  constructor(address _swapperAdder, address _swapperSetter) {
    _setRoleAdmin(SWAPPER_ADDER, MASTER_ADMIN);
    _setRoleAdmin(SWAPPER_SETTER, MASTER_ADMIN);
    _setupRole(SWAPPER_ADDER, _swapperAdder);
    _setupRole(SWAPPER_SETTER, _swapperSetter);
  }

  function isSwapper(address _swapper) external view override returns (bool) {
    return _swappers.contains(_swapper);
  }

  function swappers() external view override returns (address[] memory _swappersList) {
    _swappersList = new address[](_swappers.length());
    for (uint256 i = 0; i < _swappers.length(); i++) {
      _swappersList[i] = _swappers.at(i);
    }
  }

  function swapperStrategies(address _swapper) external view override returns (address[] memory _strategies) {
    _strategies = new address[](_swapperStrategies[_swapper].length());
    for (uint256 i = 0; i < _swapperStrategies[_swapper].length(); i++) {
      _strategies[i] = _swapperStrategies[_swapper].at(i);
    }
  }

  function setStrategySyncSwapper(address _strategy, address _swapper) external override onlyRole(SWAPPER_SETTER) {
    // we check that swapper being added is async
    require(ISwapper(_swapper).SWAPPER_TYPE() == ISwapper.SwapperType.SYNC, 'TF: not sync swapper');
    // we check that swapper is not already added
    require(_swappers.contains(_swapper), 'TradeFactory: invalid swapper');
    // remove strategy from previous swapper if any
    if (strategySyncSwapper[_strategy] != address(0)) _swapperStrategies[strategySyncSwapper[_strategy]].remove(_strategy);
    // set new strategy's sync swapper
    strategySyncSwapper[_strategy] = _swapper;
    // add strategy into new swapper
    _swapperStrategies[_swapper].add(_strategy);
    emit SyncStrategySwapperSet(_strategy, _swapper);
  }

  function setStrategyAsyncSwapper(address _strategy, address _swapper) external override onlyRole(SWAPPER_SETTER) {
    // we check that swapper being added is async
    require(ISwapper(_swapper).SWAPPER_TYPE() == ISwapper.SwapperType.ASYNC, 'TF: not async swapper');
    // we check that swapper is not already added
    require(_swappers.contains(_swapper), 'TradeFactory: invalid swapper');
    // remove strategy from previous swapper if any
    if (strategyAsyncSwapper[_strategy] != address(0)) _swapperStrategies[strategyAsyncSwapper[_strategy]].remove(_strategy);
    // set new strategy's async swapper
    strategyAsyncSwapper[_strategy] = _swapper;
    // add strategy into new swapper
    _swapperStrategies[_swapper].add(_strategy);
    emit AsyncStrategySwapperSet(_strategy, _swapper);
  }

  function _addSwapper(address _swapper) internal {
    require(_swapper != address(0), 'TF: zero address');
    require(_swappers.add(_swapper), 'TF: swapper already added');
    emit SwapperAdded(_swapper);
  }

  function addSwapper(address _swapper) external override onlyRole(SWAPPER_ADDER) {
    _addSwapper(_swapper);
  }

  function addSwappers(address[] memory __swappers) external override onlyRole(SWAPPER_ADDER) {
    for (uint256 i = 0; i < __swappers.length; i++) {
      _addSwapper(__swappers[i]);
    }
  }

  function _removeSwapper(address _swapper) internal {
    require(_swappers.remove(_swapper), 'TF: swapper not added');
    // TODO: SHOULD NOT BE ABLE TO REMOVE SWAPPER IF SWAPPER IS ASSIGNED TO STRAT
    emit SwapperRemoved(_swapper);
  }

  function removeSwapper(address _swapper) external override onlyRole(SWAPPER_ADDER) {
    _removeSwapper(_swapper);
  }

  function removeSwappers(address[] memory __swappers) external override onlyRole(SWAPPER_ADDER) {
    for (uint256 i = 0; i < __swappers.length; i++) {
      _removeSwapper(__swappers[i]);
    }
  }
}
