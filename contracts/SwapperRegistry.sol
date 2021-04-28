// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

interface ISwapperRegistry {
  event SwapperAdded(address indexed _swapper, string _name);
  event SwapperRemoved(address indexed _swapper);
  event SwapperAndTokenEnabled(address indexed _swapper, address _token);
}

contract SwapperRegistry is ISwapperRegistry {
  // Add the library methods
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.AddressSet;

  mapping(address => string) public nameByAddress;
  mapping(string => address) public swapperByName;
  mapping(address => uint256) public initializationByAddress;
  EnumerableSet.AddressSet internal _swappers;

  mapping(address => EnumerableSet.AddressSet) internal _approvedTokensBySwappers;

  constructor() {
    // TODO: set governance
    // TODO: set collectable dust
  }

  function swappers() external view returns (address[] memory _swappersAddresses) {
    _swappersAddresses = new address[](_swappers.length());
    for (uint256 i = 0; i < _swappers.length(); i++) {
      _swappersAddresses[i] = _swappers.at(i);
    }
  }

  function swapperNames() external view returns (string[] memory _swappersNames) {
    _swappersNames = new string[](_swappers.length());
    for (uint256 i = 0; i < _swappers.length(); i++) {
      _swappersNames[i] = nameByAddress[_swappers.at(i)];
    }
  }

  function approvedTokensBySwappers(address _swapper) external view returns (address[] memory _tokens) {
    _tokens = new address[](_approvedTokensBySwappers[_swapper].length());
    for (uint256 i = 0; i < _approvedTokensBySwappers[_swapper].length(); i++) {
      _tokens[i] = _approvedTokensBySwappers[_swapper].at(i);
    }
  }

  function addSwapper(string memory _name, address _swapper) external virtual {
    // TODO: only governance
    _addSwapper(_name, _swapper);
  }

  function _addSwapper(string memory _name, address _swapper) internal {
    require(bytes(_name).length > 0, 'SwapperRegistry: empty name');
    require(_swapper != address(0), 'SwapperRegistry: zero address');
    require(!_swappers.contains(_swapper), 'SwapperRegistry: swapper already added');
    require(swapperByName[_name] == address(0), 'SwapperRegistry: name taken');
    nameByAddress[_swapper] = _name;
    swapperByName[_name] = _swapper;
    initializationByAddress[_swapper] = block.timestamp;
    _swappers.add(_swapper);
    emit SwapperAdded(_swapper, _name);
  }

  function _removeSwapper(address _swapper) internal {
    require(_swappers.contains(_swapper), 'SwapperRegistry: swapper not added');
    for (uint256 i = 0; i < _approvedTokensBySwappers[_swapper].length(); i++) {
      IERC20(_approvedTokensBySwappers[_swapper].at(i)).safeApprove(_swapper, 0);
    }
    delete _approvedTokensBySwappers[_swapper];
    delete swapperByName[nameByAddress[_swapper]];
    delete nameByAddress[_swapper];
    delete initializationByAddress[_swapper];
    _swappers.remove(_swapper);
    emit SwapperRemoved(_swapper);
  }

  function enableSwapperToken(string memory _name, address _token) external virtual {
    // TODO: only governance or strategy
    _enableSwapperToken(_name, _token);
  }

  function _enableSwapperToken(string memory _name, address _token) internal {
    address _swapper = swapperByName[_name];
    require(_swappers.contains(_swapper), 'SwapperRegistry: swapper not added');
    require(_token != address(0), 'SwapperRegistry: zero address');
    if (!_approvedTokensBySwappers[_swapper].contains(_token)) {
      IERC20(_token).safeApprove(_swapper, type(uint256).max);
      _approvedTokensBySwappers[_swapper].add(_token);
      emit SwapperAndTokenEnabled(_swapper, _token);
    }
  }
}
