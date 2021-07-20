import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { BigNumber, constants, Contract, utils, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';
import { erc20, evm, fixtures, uniswap } from '../../utils';
import { contract, given, then, when } from '../../utils/bdd';
import { expect } from 'chai';

// Unil sushiswap swapper mainnet is sepparated from polygon one
contract.skip('TradeFactory', () => {
  let governor: SignerWithAddress;
  let mechanic: SignerWithAddress;
  let strategy: SignerWithAddress;
  let hodler: SignerWithAddress;

  let tokenIn: Contract;
  let tokenOut: Contract;

  let mechanicsRegistry: Contract;
  let machinery: Contract;

  let swapperRegistry: Contract;
  let tradeFactory: Contract;

  let uniswapV2Factory: Contract;
  let uniswapV2Router02: Contract;
  let uniswapPairAddress: string;

  const amountIn = utils.parseEther('10');
  const maxSlippage = 10_000; // 1%
  const INITIAL_LIQUIDITY = utils.parseEther('100000');

  before('create fixture loader', async () => {
    [governor, mechanic, strategy, hodler] = await ethers.getSigners();
  });

  beforeEach(async () => {
    ({ mechanicsRegistry, machinery } = await fixtures.machineryFixture(mechanic.address));

    ({ swapperRegistry, tradeFactory, uniswapV2Router02, uniswapV2Factory } = await fixtures.uniswapV2SwapperFixture(
      governor.address,
      mechanicsRegistry.address
    ));

    await tradeFactory.grantRole(await tradeFactory.STRATEGY(), strategy.address);

    tokenIn = await erc20.deploy({
      name: 'TA',
      symbol: 'TA',
      initialAccount: hodler.address,
      initialAmount: constants.MaxUint256,
    });

    tokenOut = await erc20.deploy({
      name: 'TB',
      symbol: 'TB',
      initialAccount: hodler.address,
      initialAmount: constants.MaxUint256,
    });

    await uniswap.addLiquidity({
      liquidityProvider: hodler,
      token0: tokenIn,
      amountA: INITIAL_LIQUIDITY,
      token1: tokenOut,
      amountB: INITIAL_LIQUIDITY,
    });

    uniswapPairAddress = await uniswapV2Factory.getPair(tokenIn.address, tokenOut.address);

    await tokenIn.connect(hodler).transfer(strategy.address, amountIn);
    await tokenIn.connect(strategy).approve(tradeFactory.address, amountIn);
    const { _initialization } = await swapperRegistry['isSwapper(string)']('uniswap-v2');
    await tradeFactory.connect(strategy).setSwapperSafetyCheckpoint(_initialization);
    await tradeFactory
      .connect(strategy)
      .create('uniswap-v2', tokenIn.address, tokenOut.address, amountIn, maxSlippage, moment().add('30', 'minutes').unix());
  });

  describe('trade executed with swapper', () => {
    let executeTx: TransactionResponse;
    let minAmountOut: BigNumber;
    given(async () => {
      const amountOut = BigNumber.from(`${(await uniswapV2Router02.getAmountsOut(amountIn, [tokenIn.address, tokenOut.address]))[0]}`);
      minAmountOut = amountOut.sub(amountOut.mul(maxSlippage).div(10000 / 100));
      executeTx = await tradeFactory.connect(mechanic).execute(1);
    });
    then('tokens in gets taken from strategy', async () => {
      expect(await tokenIn.balanceOf(strategy.address)).to.equal(0);
    });
    then('trades all on uniswap', async () => {
      expect(await tokenIn.balanceOf(uniswapPairAddress)).to.not.equal(INITIAL_LIQUIDITY);
      expect(await tokenOut.balanceOf(uniswapPairAddress)).to.not.equal(INITIAL_LIQUIDITY);
    });
    then('token out gets airdropped to strategy', async () => {
      expect(await tokenOut.balanceOf(strategy.address)).to.be.gte(minAmountOut);
    });
  });
});
