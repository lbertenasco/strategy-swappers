import { BigNumber } from '@ethersproject/bignumber';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import qs from 'qs';
import { utils } from 'ethers';
import { ethers, network } from 'hardhat';
import wallet from '../../test/utils/wallet';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import evm from '../../test/utils/evm';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const API_URL: { [chainId: number]: string } = {
  1: 'api.0x.org',
  137: 'polygon.api.0x.org',
};

export type QuoteRequest = {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount?: BigNumber | string;
  buyAmount?: BigNumber | string;
  sippagePercentage?: number;
  gasPrice?: BigNumber | string;
  takerAddress?: string;
  excludeSources?: string[];
  includeSources?: string[];
  skipValidation?: boolean;
  intentOnFilling?: boolean;
  buyTokenPercentageFee?: number;
  affiliateAddress?: string;
};

export type QuoteResponse = {
  chainId: number;
  price: string;
  guaranteedPrice: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  estimatedGas: string;
  gasPrice: string;
  protocolFee: string;
  minimumProtocolFee: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  buyAmount: string;
  sellAmount: string;
  sources: any[];
  orders: any[];
  allowanceTarget: string;
  sellTokenToEthRate: string;
  buyTokenToEthRate: string;
};

async function getQuote(quoteRequest: QuoteRequest): Promise<QuoteResponse> {
  if (BigNumber.isBigNumber(quoteRequest.sellAmount)) quoteRequest.sellAmount = quoteRequest.sellAmount.toString();
  if (BigNumber.isBigNumber(quoteRequest.buyAmount)) quoteRequest.buyAmount = quoteRequest.buyAmount.toString();
  if (BigNumber.isBigNumber(quoteRequest.gasPrice)) quoteRequest.gasPrice = quoteRequest.gasPrice.toString();

  let response: any;
  try {
    console.log(API_URL[quoteRequest.chainId]);
    response = await axios.get(`https://${API_URL[quoteRequest.chainId]}/swap/v1/quote?${qs.stringify(quoteRequest)}`);
  } catch (err) {
    console.log(err.response.data);
    throw new Error(`Error code: ${err.response.data.code}. Reason: ${err.response.data.reason}`);
  }
  return response.data as QuoteResponse;
}

async function realMainnetTrade() {
  const submitter = await wallet.impersonate('0xba12222222228d8ba445958a75a0704d566bf2c8'); // WETH holder
  const AMOUNT = utils.parseEther('10');
  const zxResponse = await getQuote({
    chainId: 1,
    sellToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    buyToken: '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
    takerAddress: submitter._address,
    sellAmount: AMOUNT,
    skipValidation: true,
    sippagePercentage: 1,
  });
  console.log(zxResponse);
  const tokenToSell = await ethers.getContractAt(IERC20_ABI, zxResponse.sellTokenAddress);
  const tokenToBuy = await ethers.getContractAt(IERC20_ABI, zxResponse.buyTokenAddress);
  const preBalance = await tokenToBuy.balanceOf(submitter._address);
  await tokenToSell.connect(submitter).approve(zxResponse.allowanceTarget, AMOUNT, {
    gasPrice: 0,
  });
  console.log('approved token to sell');
  await submitter.sendTransaction({
    to: zxResponse.to,
    data: zxResponse.data,
    gasPrice: 0,
  });
  const postBalance = await tokenToBuy.balanceOf(submitter._address);
  console.log('delta ETH', utils.formatEther(postBalance.sub(preBalance)));
}

async function realPolyTrade() {
  const [submitter] = await ethers.getSigners();
  const zxResponse = await getQuote({
    chainId: 137,
    sellToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC (PoS)
    buyToken: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', // DAI (PoS)
    sellAmount: utils.parseEther('0.01'),
    takerAddress: submitter.address,
    skipValidation: true,
    sippagePercentage: 0.01,
  });
  console.log(zxResponse);
  const tokenToSell = await ethers.getContractAt(IERC20_ABI, zxResponse.sellTokenAddress);
  const tokenToBuy = await ethers.getContractAt(IERC20_ABI, zxResponse.buyTokenAddress);
  const preBalance = await tokenToBuy.balanceOf(submitter.address);
  await tokenToSell.connect(submitter).approve(zxResponse.allowanceTarget, utils.parseEther('0.01'));
  console.log('approved token to sell');
  await submitter.sendTransaction({ to: zxResponse.to, data: zxResponse.data });
  const postBalance = await tokenToBuy.balanceOf(submitter.address);
  console.log('delta', utils.formatEther(postBalance.sub(preBalance)));
}

realMainnetTrade()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
