// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '@lbertenasco/contract-utils/contracts/utils/CollectableDust.sol';
import '@lbertenasco/contract-utils/contracts/utils/Governable.sol';

interface ISwapperRegistry {
  event SwapperAdded(address indexed _swapper, string _name);
  event SwapperDeprecated(address indexed _swapper);

  function deprecatedByAddress(address) external view returns (bool);

  function swappers() external view returns (address[] memory _swappersAddresses);

  function swapperNames() external view returns (string[] memory _swappersNames);

  function activeSwappers() external view returns (address[] memory _activeSwappers);

  function deprecatedSwappers() external view returns (address[] memory _deprecatedSwappers);

  function isSwapper(address _swapper) external view returns (bool);

  function isSwapper(string memory _swapper) external view returns (bool _isSwapper, address _swapperAddress);

  function addSwapper(string memory _name, address _swapper) external;

  function deprecateSwapper(address _swapper) external;
}

contract SwapperRegistry is ISwapperRegistry, CollectableDust, Governable {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.AddressSet;

  mapping(address => string) public nameByAddress;
  mapping(string => address) public swapperByName;
  mapping(address => uint256) public initializationByAddress;
  mapping(address => bool) public override deprecatedByAddress;
  EnumerableSet.AddressSet internal _swappers;

  constructor(address _governance) Governable(_governance) {}

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

  function activeSwappers() external view override returns (address[] memory _activeSwappers) {
    _activeSwappers = new address[](_swappers.length());
    uint256 _totalActive = 0;
    for (uint256 i = 0; i < _swappers.length(); i++) {
      if (!deprecatedByAddress[_swappers.at(i)]) {
        _activeSwappers[_totalActive] = _swappers.at(i);
        _totalActive += 1;
      }
    }
  }

  function deprecatedSwappers() external view override returns (address[] memory _deprecatedSwappers) {
    _deprecatedSwappers = new address[](_swappers.length());
    uint256 _totalDeprecated = 0;
    for (uint256 i = 0; i < _swappers.length(); i++) {
      if (deprecatedByAddress[_swappers.at(i)]) {
        _deprecatedSwappers[_totalDeprecated] = _swappers.at(i);
        _totalDeprecated += 1;
      }
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

  function deprecateSwapper(address _swapper) external virtual override onlyGovernor {
    _deprecateSwapper(_swapper);
  }

  function _deprecateSwapper(address _swapper) internal {
    require(_swappers.contains(_swapper), 'SwapperRegistry: swapper not added');
    deprecatedByAddress[_swapper] = true;
    emit SwapperDeprecated(_swapper);
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
