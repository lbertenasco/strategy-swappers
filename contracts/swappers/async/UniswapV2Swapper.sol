// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../../Swapper.sol';

interface IUniswapV2Swapper is ISwapper {
  // solhint-disable-next-line func-name-mixedcase
  function WETH() external view returns (address);

  // solhint-disable-next-line func-name-mixedcase
  function UNISWAP_FACTORY() external view returns (address);

  // solhint-disable-next-line func-name-mixedcase
  function UNISWAP_ROUTER() external view returns (address);
}

contract UniswapV2Swapper is IUniswapV2Swapper, Swapper {
  using SafeERC20 for IERC20;

  // solhint-disable-next-line var-name-mixedcase
  SwapperType public override SWAPPER_TYPE = SwapperType.ASYNC;

  // solhint-disable-next-line var-name-mixedcase
  address public immutable override WETH;
  // solhint-disable-next-line var-name-mixedcase
  address public immutable override UNISWAP_FACTORY;
  // solhint-disable-next-line var-name-mixedcase
  address public immutable override UNISWAP_ROUTER;

  constructor(
    address _governor,
    address _tradeFactory,
    address _weth,
    address _uniswapFactory,
    address _uniswapRouter
  ) Swapper(_governor, _tradeFactory) {
    WETH = _weth;
    UNISWAP_FACTORY = _uniswapFactory;
    UNISWAP_ROUTER = _uniswapRouter;
  }

  function _executeSwap(
    address _receiver,
    address _tokenIn,
    address _tokenOut,
    uint256 _amountIn,
    uint256 _maxSlippage,
    bytes calldata _data
  ) internal override returns (uint256 _receivedAmount) {
    address[] memory _path = abi.decode(_data, (address[]));
    if (_tokenIn != _path[0] || _tokenOut != _path[_path.length - 1]) revert CommonErrors.IncorrectSwapInformation();
    uint256 _amountOut = IUniswapV2Router02(UNISWAP_ROUTER).getAmountsOut(_amountIn, _path)[_path.length - 1];
    IERC20(_path[0]).approve(UNISWAP_ROUTER, 0);
    IERC20(_path[0]).approve(UNISWAP_ROUTER, _amountIn);
    _receivedAmount = IUniswapV2Router02(UNISWAP_ROUTER).swapExactTokensForTokens(
      _amountIn,
      _amountOut - ((_amountOut * _maxSlippage) / SLIPPAGE_PRECISION / 100), // slippage calcs
      _path,
      _receiver,
      block.timestamp
    )[_path.length - 1];
  }
}
