// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '@lbertenasco/contract-utils/contracts/utils/CollectableDust.sol';
import '@lbertenasco/contract-utils/contracts/utils/Governable.sol';

interface ISwapperRegistry {
  event SwapperAdded(address indexed _swapper, string _name);
  event SwapperRemoved(address indexed _swapper);

  function swappers() external view returns (address[] memory _swappersAddresses);

  function swapperNames() external view returns (string[] memory _swappersNames);

  function approvedTokensBySwappers(address _swapper) external view returns (address[] memory _tokens);

  function isSwapper(address _swapper) external view returns (bool);

  function isSwapper(string memory _swapper) external view returns (bool _isSwapper, address _swapperAddress);

  function addSwapper(string memory _name, address _swapper) external;

  function removeSwapper(address _swapper) external;
}

contract SwapperRegistry is ISwapperRegistry, CollectableDust, Governable {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.AddressSet;

  mapping(address => string) public nameByAddress;
  mapping(string => address) public swapperByName;
  mapping(address => uint256) public initializationByAddress;
  EnumerableSet.AddressSet internal _swappers;

  mapping(address => EnumerableSet.AddressSet) internal _approvedTokensBySwappers;

  constructor(address _governance) Governable(_governance) {}

  modifier onlySwapper {
    require(_swappers.contains(msg.sender), 'SwapperRegistry: swapper not registered');
    _;
  }

  function swappers() external view override returns (address[] memory _swappersAddresses) {
    _swappersAddresses = new address[](_swappers.length());
    for (uint256 i = 0; i < _swappers.length(); i++) {
      _swappersAddresses[i] = _swappers.at(i);
    }
  }

  function swapperNames() external view override returns (string[] memory _swappersNames) {
    _swappersNames = new string[](_swappers.length());
    for (uint256 i = 0; i < _swappers.length(); i++) {
      _swappersNames[i] = nameByAddress[_swappers.at(i)];
    }
  }

  function approvedTokensBySwappers(address _swapper) external view override returns (address[] memory _tokens) {
    _tokens = new address[](_approvedTokensBySwappers[_swapper].length());
    for (uint256 i = 0; i < _approvedTokensBySwappers[_swapper].length(); i++) {
      _tokens[i] = _approvedTokensBySwappers[_swapper].at(i);
    }
  }

  function isSwapper(address _swapper) external view override returns (bool) {
    return _swappers.contains(_swapper);
  }

  function isSwapper(string memory _swapper) external view override returns (bool _isSwapper, address _swapperAddress) {
    _swapperAddress = swapperByName[_swapper];
    _isSwapper = _swapperAddress != address(0);
  }

  function addSwapper(string memory _name, address _swapper) external virtual override onlyGovernor {
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

  function removeSwapper(address _swapper) external virtual override onlyGovernor {
    _removeSwapper(_swapper);
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

  function setPendingGovernor(address _pendingGovernor) external override onlyGovernor {
    _setPendingGovernor(_pendingGovernor);
  }

  function acceptGovernor() external override onlyPendingGovernor {
    _acceptGovernor();
  }

  function sendDust(
    address _to,
    address _token,
    uint256 _amount
  ) external virtual override onlyGovernor {
    _sendDust(_to, _token, _amount);
  }
}
