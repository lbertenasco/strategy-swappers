// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '@lbertenasco/contract-utils/contracts/utils/Governable.sol';
import '@lbertenasco/contract-utils/contracts/utils/CollectableDust.sol';

interface ISwapper {
  event Swapped(address _receiver, address _tokenIn, address _tokenOut, uint256 _amountIn, uint256 _maxSlippage, uint256 _receivedAmount);

  function SLIPPAGE_PRECISION() external view returns (uint256);

  function TRADE_FACTORY() external view returns (address);

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

  uint256 public immutable override SLIPPAGE_PRECISION = 10000; // 1 is 0.0001%, 1_000 is 0.1%
  address public immutable override TRADE_FACTORY;

  constructor(address _governor, address _tradeFactory) Governable(_governor) {
    require(_tradeFactory != address(0), 'Swapper: zero address');
    TRADE_FACTORY = _tradeFactory;
  }

  modifier onlyTradeFactory() {
    require(msg.sender == TRADE_FACTORY, 'Swapper: not trade factory');
    _;
  }

  function _assertPreSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal pure {
    require(_receiver != address(0), 'Swapper: zero address');
    require(_tokenIn != address(0) && _tokenOut != address(0), 'Swapper: zero address');
    require(_amountIn > 0, 'Swapper: zero amount');
    require(_maxSlippage > 0, 'Swapper: zero slippage');
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
    IERC20(_tokenIn).safeTransferFrom(TRADE_FACTORY, address(this), _amountIn);
    _receivedAmount = _executeSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _data);
    emit Swapped(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage, _receivedAmount);
  }

  function sendDust(
    address _to,
    address _token,
    uint256 _amount
  ) external virtual override onlyGovernor {
    _sendDust(_to, _token, _amount);
  }
}
