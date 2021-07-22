import { BigNumber } from '@ethersproject/bignumber';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { utils } from 'ethers';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export type SwapParams = {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  fromAddress: string;
  slippage: number;
  protocols?: string;
  receiver?: string;
  referrer?: string;
  fee?: number;
  gasPrice?: BigNumber;
  burnChi?: boolean;
  complexityLevel?: string;
  connectorTokens?: string;
  allowPartialFill?: boolean;
  disableEstimate?: boolean;
  gasLimit?: BigNumber;
  parts?: number;
  mainRouteParts?: number;
};

type Token = {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  logoURI: string;
};

type SwapPart = {
  name: string;
  part: number;
  fromTokenAddress: string;
  toTokenAddress: string;
};
type SwapProtocol = SwapPart[];
type SwapProtocols = SwapProtocol[];

export type SwapResponse = {
  fromToken: Token;
  toToken: Token;
  fromTokenAmount: BigNumber;
  toTokenAmount: BigNumber;
  protocols: SwapProtocols;
  tx: {
    from: string;
    to: string;
    data: string;
    value: BigNumber;
    gasPrice: BigNumber;
    gas: BigNumber;
  };
};

export const swap = async (chainId: number, swapParams: SwapParams): Promise<void> => {
  const rawAxiosResponse = await axios.get(
    `https://api.1inch.exchange/v3.0/${chainId}/swap?fromTokenAddress=${swapParams.tokenIn}&toTokenAddress=${
      swapParams.tokenOut
    }&amount=${swapParams.amountIn.toString()}&fromAddress=${swapParams.fromAddress}&slippage=${swapParams.slippage}`
  );
  if (rawAxiosResponse.status != 200) throw Error('Some error');
  const repsonseData = rawAxiosResponse.data;
  console.log(repsonseData);
};

swap(137, {
  tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  tokenOut: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
  amountIn: BigNumber.from('69475000000000000'),
  fromAddress: '0xB82193725471dC7bfaAB1a3AB93c7b42963F3265',
  slippage: 1,
})
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
