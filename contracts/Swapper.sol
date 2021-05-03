// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './utils/Machinery.sol';

interface ISwapper {
  function WETH() external view returns (address);

  function SLIPPAGE_PRECISION() external view returns (uint256);

  // function pendingSwaps(uint256 _index) external returns (Swap memory);

  // function swapById(uint256 _id) external view returns (Swap memory);

  function swap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) external payable returns (uint256 _receivedAmount);
}

abstract contract Swapper is ISwapper {
  using SafeERC20 for IERC20;

  address public constant ETH = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
  address public immutable override WETH;
  uint256 public immutable override SLIPPAGE_PRECISION;

  constructor(address _weth, uint256 _slippagePrecision) {
    SLIPPAGE_PRECISION = _slippagePrecision;
    WETH = _weth;
  }

  // only trade factory ?
  function swap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) external payable virtual override returns (uint256 _receivedAmount) {
    require(_tokenIn != address(0) && _tokenOut != address(0), 'Swapper: zero address');
    require(_amountIn > 0, 'Swapper: zero amount');
    require(_maxSlippage > 0, 'Swapper: zero slippage');
    if (_tokenIn == ETH) {
      require(_amountIn == msg.value, 'Swapper: missing eth');
    } else {
      IERC20(_tokenIn).safeTransferFrom(msg.sender, address(this), _amountIn);
    }
    return _executeSwap(_receiver, _tokenIn, _tokenOut, _amountIn, _maxSlippage);
    // emit event ?
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal virtual returns (uint256 _receivedAmount);
}
