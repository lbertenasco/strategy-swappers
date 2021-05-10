// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@lbertenasco/contract-utils/interfaces/utils/ICollectableDust.sol';

interface ICollectableDustWithTokensManagement is ICollectableDust {}

abstract contract CollectableDustWithTokensManagement is ICollectableDustWithTokensManagement {
  using SafeERC20 for IERC20;

  mapping(address => uint256) internal _tokensUnderManagement;

  function _addTokenUnderManagement(address _token, uint256 _amount) internal {
    require(
      _tokensUnderManagement[_token] + _amount <= IERC20(_token).balanceOf(address(this)),
      'CollectableDust: cant manage more than balance'
    );
    _tokensUnderManagement[_token] += _amount;
  }

  function _subTokenUnderManagement(address _token, uint256 _amount) internal {
    require(_tokensUnderManagement[_token] >= _amount, 'CollectableDust: subtracting more than managed');
    _tokensUnderManagement[_token] -= _amount;
  }

  function _sendDust(
    address _to,
    address _token,
    uint256 _amount
  ) internal {
    require(_to != address(0), 'CollectableDust: zero address');
    require(_amount <= IERC20(_token).balanceOf(address(this)) - _tokensUnderManagement[_token], 'CollectableDust: taking more than dust');
    IERC20(_token).safeTransfer(_to, _amount);
    emit DustSent(_to, _token, _amount);
  }
}
