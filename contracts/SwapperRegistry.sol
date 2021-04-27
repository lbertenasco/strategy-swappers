// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

interface ISwapperRegistry {
  event SwapperAdded();
  event SwapperNameUpdated();
  event SwapperAddressUpdated();
  event SwapperRemoved();
  event SwapperAndTokenEnabled();
}

contract SwapperRegistry is ISwapperRegistry {
  // Add the library methods
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.AddressSet;

  mapping(address => string) public nameBySwapper;
  mapping(string => address) public swapperByName;
  EnumerableSet.AddressSet internal _swappers;

  mapping(address => mapping(address => bool)) approvedTokensBySwappers;

  constructor() {
    // TODO: set governance
    // TODO: set collectable dust
  }

  function swappers() external {
    // expose address set
  }

  function swapperNames() external {
    // exposes swapper names
  }

  function addSwapper(string memory _name, address _swapper) external virtual {
    // TODO: only governance
    _addSwapper(_name, _swapper);
  }

  function _addSwapper(string memory _name, address _swapper) internal {
    require(bytes(_name).length > 0, '');
    require(_swapper != address(0), '');
    require(!_swappers.contains(_swapper), '');
    nameBySwapper[_swapper] = _name;
    swapperByName[_name] = _swapper;
    _swappers.add(_swapper);
    emit SwapperAdded();
  }

  function updateSwapperName(string memory _name, string memory _newName) external virtual {
    // TODO: only governance
    _updateSwapperName(_name, _newName);
  }

  function _updateSwapperName(string memory _name, string memory _newName) internal {
    require(bytes(_name).length > 0, '');
    require(_swappers.contains(swapperByName[_name]), '');
    swapperByName[_newName] = swapperByName[_name];
    nameBySwapper[swapperByName[_name]] = _newName;
    delete swapperByName[_name];
    emit SwapperNameUpdated();
  }

  function updateSwapperAddress(address _swapper, address _newSwapper) external virtual {
    // TODO: only governance
    _updateSwapperAddress(_swapper, _newSwapper);
  }

  function _updateSwapperAddress(address _swapper, address _newSwapper) internal {
    require(_newSwapper != address(0), '');
    require(_swappers.contains(_swapper), '');
    nameBySwapper[_newSwapper] = nameBySwapper[_swapper];
    swapperByName[nameBySwapper[_swapper]] = _newSwapper;
    _swappers.remove(_swapper);
    _swappers.add(_newSwapper);
    delete nameBySwapper[_swapper];
    emit SwapperAddressUpdated();
  }

  function _removeSwapper(address _swapper) internal {
    require(_swappers.contains(_swapper), '');
    // should we take ALL aproves from that swapper ? (thats gonna be a pin in the ass, but its safer)
    delete swapperByName[nameBySwapper[_swapper]];
    delete nameBySwapper[_swapper];
    _swapers.remove(_swapper);
    emit SwapperRemoved();
  }

  function enableSwapper(string memory _name, address _token) external virtual {
    // TODO: only governance or strategy
    _enableSwapper(_name, _token);
  }

  function _enableSwapper(string memory _name, address _token) internal {
    address _swapper = swapperByName[_name];
    require(_swappers.contains(_swapper), '');
    require(_token != address(0), '');
    if (!approvedTokensBySwappers[_swapper][_token]) {
      IERC20(_token).safeApprove(_swapper, type(uint256).max);
      approvedTokensBySwappers[_swapper][_token] = true;
      emit SwapperAndTokenEnabled();
    }
  }
}
