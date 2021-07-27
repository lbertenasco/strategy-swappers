import { BigNumber } from '@ethersproject/bignumber';
import { TransactionResponse, TransactionReceipt } from '@ethersproject/abstract-provider';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { utils } from 'ethers';
import { ethers } from 'hardhat';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { Log } from 'hardhat-deploy/dist/types';
import wallet from '../../test/utils/wallet';

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
  const [ymech] = await ethers.getSigners();
  const dai = await ethers.getContractAt(IERC20_ABI, '0x6b175474e89094c44da98b954eedeac495271d0f');
  const oneinch = await ethers.getContractAt(
    'contracts/swappers/OneInchV2Swapper.sol:IOneInchExchange',
    '0x11111112542D85B3EF69AE05771c2dCCff4fAa26'
  );
  let rawAxiosResponse;
  try {
    rawAxiosResponse = await axios.get(
      `https://api.1inch.exchange/v3.0/${chainId}/swap?fromTokenAddress=${swapParams.tokenIn}&toTokenAddress=${
        swapParams.tokenOut
      }&amount=${swapParams.amountIn.toString()}&fromAddress=${swapParams.fromAddress}&slippage=${swapParams.slippage}&disableEstimate=${
        swapParams.disableEstimate
      }`
    );
  } catch (err) {
    throw new Error(`Status code: ${err.response.data.statusCode}. Message: ${err.response.data.message}`);
  }
  const repsonseData = rawAxiosResponse.data as SwapResponse;
  const parsedTx = await oneinch.interface.parseTransaction(repsonseData.tx);
  console.log('args', utils.formatEther(parsedTx.args.desc.minReturnAmount));
  const initialBalance = await ethers.provider.getBalance(ymech.address);
  await dai.approve(repsonseData.tx.to, utils.parseEther('100'));
  const tx = await ymech.sendTransaction({ to: repsonseData.tx.to, data: repsonseData.tx.data, value: BigNumber.from(repsonseData.tx.value) });
  const finalBalance = await ethers.provider.getBalance(ymech.address);
  console.log('delta balance:', utils.formatEther(finalBalance.sub(initialBalance)), 'eth');
};

export const main = async () => {
  const [ymech] = await ethers.getSigners();
  console.log('ymech addr', ymech.address);
  // await swap(1, {
  //   tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  //   tokenOut: '0x6b175474e89094c44da98b954eedeac495271d0f',
  //   amountIn: utils.parseEther('0.001'),
  //   fromAddress: ymech.address,
  //   slippage: 0.1,
  // });

  await swap(1, {
    tokenIn: '0x6b175474e89094c44da98b954eedeac495271d0f',
    tokenOut: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    amountIn: utils.parseEther('100'),
    fromAddress: ymech.address,
    slippage: 50,
    disableEstimate: true,
  });
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
