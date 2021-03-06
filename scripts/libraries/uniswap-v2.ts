import { BigNumber } from '@ethersproject/bignumber';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { abi as IUniswapV2Factory } from '@uniswap/v2-core/build/IUniswapV2Factory.json';
import { abi as IUniswapV2Router02 } from '@uniswap/v2-periphery/build/IUniswapV2Router02.json';
import { ethers } from 'hardhat';
import constants from '../../test/utils/constants';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export type SwapParams = {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  uniswapV2Router: string;
  uniswapV2Factory: string;
  hopTokensToTest?: string[];
};

export type SwapResponse = {
  data: string;
  amountOut: BigNumber;
  path: string[];
};

export const getBestPathEncoded = async (swapParams: SwapParams): Promise<SwapResponse> => {
  swapParams.hopTokensToTest = swapParams.hopTokensToTest ?? [];

  const factory = await ethers.getContractAt(IUniswapV2Factory, swapParams.uniswapV2Factory);
  const router = await ethers.getContractAt(IUniswapV2Router02, swapParams.uniswapV2Router);

  let maxPath: string[] = [];
  let maxOut: BigNumber = BigNumber.from('0');

  if ((await factory.getPair(swapParams.tokenIn, swapParams.tokenOut)) != constants.ZERO_ADDRESS) {
    maxPath = [swapParams.tokenIn, swapParams.tokenOut];
    [, maxOut] = await router.getAmountsOut(swapParams.amountIn, maxPath);
  }

  for (let i = 0; i < swapParams.hopTokensToTest.length; i++) {
    if (
      (await factory.getPair(swapParams.tokenIn, swapParams.hopTokensToTest[i])) != constants.ZERO_ADDRESS &&
      (await factory.getPair(swapParams.hopTokensToTest[i], swapParams.tokenOut)) != constants.ZERO_ADDRESS
    ) {
      const hopPath = [swapParams.tokenIn, swapParams.hopTokensToTest[i], swapParams.tokenOut];
      const amountsOut = await router.getAmountsOut(swapParams.amountIn, hopPath);
      const hopOut = amountsOut[amountsOut.length - 1];
      if (hopOut.gt(maxOut)) {
        maxOut = hopOut;
        maxPath = hopPath;
      }
    }
  }
  return {
    data: ethers.utils.defaultAbiCoder.encode(['address[]'], [maxPath]),
    amountOut: maxOut,
    path: maxPath,
  };
};

export default {
  getBestPathEncoded,
};
