// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../Swapper.sol';

interface IUniswapV3Swapper is ISwapper {
  function WETH() external view returns (address);

  function UNISWAP_V3_SWAP_ROUTER() external view returns (address);
}

contract UniswapV3Swapper is IUniswapV3Swapper, Swapper {
  using SafeERC20 for IERC20;

  address public immutable override WETH;
  address public immutable override UNISWAP_V3_SWAP_ROUTER;

  constructor(
    address _governor,
    address _tradeFactory,
    address _weth,
    address _uniswap
  ) Swapper(_governor, _tradeFactory) {
    WETH = _weth;
    UNISWAP_V3_SWAP_ROUTER = _uniswap;
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage
  ) internal override returns (uint256 _receivedAmount) {
    address[] memory _path = _getPath(_tokenIn, _tokenOut);
    uint256 _minAmountOut = _getMinAmountOut(_amountIn, _maxSlippage, _path);
    IERC20(_path[0]).safeApprove(UNISWAP_V3_SWAP_ROUTER, 0);
    IERC20(_path[0]).safeApprove(UNISWAP_V3_SWAP_ROUTER, _amountIn);

    _receivedAmount = ISwapRouter(UNISWAP_V3_SWAP_ROUTER).exactInput(
      ISwapRouter.ExactInputParams(
        abi.encodePacked(_tokenIn, uint24(3000), 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, uint24(3000), _tokenOut),
        _receiver,
        block.timestamp,
        _amountIn,
        _minAmountOut
      )
    );
  }

  // function _getBytesPath(
  //   uint256 _amountIn,
  //   uint256 _maxSlippage,
  //   address[] memory _path
  // ) internal view returns (bytes _data) {
  //   return abi.encodePacked(
  //     _tokenIn,
  //     uint24(3000),
  //     0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
  //     uint24(3000),
  //     _tokenOut
  //   );
  // }

  function _getMinAmountOut(
    uint256 _amountIn,
    uint256 _maxSlippage,
    address[] memory _path
  ) internal view returns (uint256 _minAmountOut) {
    uint256 _amountOut = IUniswapV2Router02(UNISWAP_V3_SWAP_ROUTER).getAmountsOut(_amountIn, _path)[0];
    _minAmountOut = _amountOut - ((_amountOut * _maxSlippage) / SLIPPAGE_PRECISION / 100);
  }

  function _getPath(address _tokenIn, address _tokenOut) internal view returns (address[] memory _path) {
    // todo: token in weth
    if (_tokenOut == WETH) {
      _path = new address[](2);
      _path[0] = _tokenIn;
      _path[1] = _tokenOut;
    } else {
      _path = new address[](3);
      _path[0] = _tokenIn;
      _path[1] = WETH;
      _path[2] = _tokenOut;
    }
  }
}
