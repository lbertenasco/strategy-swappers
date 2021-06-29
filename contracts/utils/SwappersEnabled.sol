// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './SwapperEnabled.sol';

interface IAtomicSwapperEnabled {
  event AtomicSwapperSet(string indexed _atomicSwapper);

  function atomicSwapper() external returns (string memory _atomicSwapper);

  function setAtomicSwapper(string calldata _atomicSwapper) external;

  function executeTrade(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) external returns (uint256 _amountOut);
}

/*
 * SwappersEnabled Abstract
 */
abstract contract SwappersEnabled is SwapperEnabled, IAtomicSwapperEnabled {
  using SafeERC20 for IERC20;

  string public override atomicSwapper;

  constructor(address _tradeFactory) SwapperEnabled(_tradeFactory) {}

  // onlyStrategist or multisig:
  function _setAtomicSwapper(string calldata _atomicSwapper) internal {
    atomicSwapper = _atomicSwapper;
    emit AtomicSwapperSet(_atomicSwapper);
  }

  // onlyMultisig or internal use:
  function _executeTrade(
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal returns (uint256 _amountOut) {
    return _executeTrade(atomicSwapper, _tokenIn, _tokenOut, _amountIn, _maxSlippage);
  }

  function _executeTrade(
    string memory _atomicSwapper,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal returns (uint256 _amountOut) {
    IERC20(_tokenIn).safeIncreaseAllowance(tradeFactory, _amountIn);
    return ITradeFactoryPositionsHandler(tradeFactory).execute(_atomicSwapper, _tokenIn, _tokenOut, _amountIn, _maxSlippage);
  }
}
