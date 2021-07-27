// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/access/AccessControl.sol';
import '@lbertenasco/contract-utils/contracts/utils/Governable.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

interface ITradeFactorySwapperHandler {
  event StrategySwapperSet(address _strategy, address _swapper);
  event SwapperAdded(address _swapper);
  event SwapperRemoved(address _swapper);

  function strategySwapper(address _strategy) external view returns (address _swapper);

  function swappers() external view returns (address[] memory _swappersList);

  function isSwapper(address _swapper) external view returns (bool);

  function swapperStrategies(address _swapper) external view returns (address[] memory _strategies);

  function setStrategySwapper(
    address _strategy,
    address _swapper,
    bool _migrateSwaps
  ) external returns (uint256[] memory _changedSwapperIds);

  function addSwapper(address _swapper) external;

  function removeSwapper(address _swapper) external;
}

abstract contract TradeFactorySwapperHandler is ITradeFactorySwapperHandler, AccessControl, Governable {
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant SWAPPER_SETTER = keccak256('SWAPPER_SETTER');
  bytes32 public constant MASTER_ADMIN = keccak256('MASTER_ADMIN');

  // swappers list
  EnumerableSet.AddressSet internal _swappers;
  // swapper -> strategy list (useful to know if we can safely deprecate a swapper)
  mapping(address => EnumerableSet.AddressSet) internal _swapperStrategies;
  // strategy -> swapper
  mapping(address => address) public override strategySwapper;

  constructor() {
    _setRoleAdmin(SWAPPER_SETTER, MASTER_ADMIN);
    _setupRole(SWAPPER_SETTER, governor);
    _setupRole(MASTER_ADMIN, governor);
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

  function _setStrategySwapper(address _strategy, address _swapper) internal {
    require(_swappers.contains(_swapper), 'TradeFactory: invalid swapper');
    strategySwapper[_strategy] = _swapper;
    emit StrategySwapperSet(_strategy, _swapper);
  }

  function addSwapper(address _swapper) external override onlyRole(SWAPPER_SETTER) {
    require(_swappers.add(_swapper), 'TF: swapper already added');
    emit SwapperAdded(_swapper);
  }

  function removeSwapper(address _swapper) external override onlyRole(SWAPPER_SETTER) {
    require(_swappers.remove(_swapper), 'TF: swapper not added');
    emit SwapperRemoved(_swapper);
  }
}
