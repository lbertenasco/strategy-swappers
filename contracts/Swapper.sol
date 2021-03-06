// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '@lbertenasco/contract-utils/contracts/utils/Governable.sol';
import '@lbertenasco/contract-utils/contracts/utils/CollectableDust.sol';

import './libraries/CommonErrors.sol';

interface ISwapper {
  enum SwapperType {
    ASYNC,
    SYNC
  }

  event Swapped(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    uint256 _receivedAmount,
    bytes _data
  );

  // solhint-disable-next-line func-name-mixedcase
  function SLIPPAGE_PRECISION() external view returns (uint256);

  // solhint-disable-next-line func-name-mixedcase
  function TRADE_FACTORY() external view returns (address);

  // solhint-disable-next-line func-name-mixedcase
  function SWAPPER_TYPE() external view returns (SwapperType);

  function swap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata _data
  ) external returns (uint256 _receivedAmount);
}

abstract contract Swapper is ISwapper, Governable, CollectableDust {
  using SafeERC20 for IERC20;

  // solhint-disable-next-line var-name-mixedcase
  uint256 public immutable override SLIPPAGE_PRECISION = 10000; // 1 is 0.0001%, 1_000 is 0.1%

  // solhint-disable-next-line var-name-mixedcase
  address public immutable override TRADE_FACTORY;

  constructor(address _governor, address _tradeFactory) Governable(_governor) {
    if (_tradeFactory == address(0)) revert CommonErrors.ZeroAddress();
    TRADE_FACTORY = _tradeFactory;
  }

  modifier onlyTradeFactory() {
    if (msg.sender != TRADE_FACTORY) revert CommonErrors.NotAuthorized();
    _;
  }

  function _assertPreSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal pure {
    if (_receiver == address(0) || _tokenIn == address(0) || _tokenOut == address(0)) revert CommonErrors.ZeroAddress();
    if (_amountIn == 0) revert CommonErrors.ZeroAmount();
    if (_maxSlippage == 0) revert CommonErrors.ZeroSlippage();
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata _data
  ) internal virtual returns (uint256 _receivedAmount);

  function swap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata _data
  ) external virtual override onlyTradeFactory returns (uint256 _receivedAmount) {
    _assertPreSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage);
    _receivedAmount = _executeSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _data);
    emit Swapped(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _receivedAmount, _data);
  }

  function sendDust(
    address _to,
    address _token,
    uint256 _amount
  ) external virtual override onlyGovernor {
    _sendDust(_to, _token, _amount);
  }
}
