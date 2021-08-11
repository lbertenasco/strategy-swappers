import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { BigNumber, constants, Contract, utils, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import moment from 'moment';
import { contracts, erc20, evm, fixtures, uniswap } from '../../utils';
import { contract, given, then, when } from '../../utils/bdd';
import { expect } from 'chai';
import uniswapLibrary from '../../../scripts/libraries/uniswap-v2';

contract('TradeFactory', () => {
  let governor: SignerWithAddress;
  let mechanic: SignerWithAddress;
  let strategy: SignerWithAddress;
  let hodler: SignerWithAddress;
  let swapperSetter: SignerWithAddress;

  let tokenIn: Contract;
  let tokenOut: Contract;

  let mechanicsRegistry: Contract;
  let machinery: Contract;
  let tradeFactory: Contract;

  let uniswapV2Factory: Contract;
  let uniswapV2Router02: Contract;
  let uniswapV2Swapper: Contract;
  let uniswapPairAddress: string;

  const amountIn = utils.parseEther('10');
  const maxSlippage = 10_000; // 1%
  const INITIAL_LIQUIDITY = utils.parseEther('100000');

  before('create fixture loader', async () => {
    [governor, mechanic, strategy, hodler, swapperSetter] = await ethers.getSigners();
  });

  beforeEach(async () => {
    ({ mechanicsRegistry, machinery } = await fixtures.machineryFixture(mechanic.address));

    ({ tradeFactory, uniswapV2Swapper, uniswapV2Router02, uniswapV2Factory } = await fixtures.uniswapV2AsyncSwapperFixture(
      governor.address,
      mechanicsRegistry.address
    ));

    await tradeFactory.grantRole(await tradeFactory.STRATEGY(), strategy.address);
    await tradeFactory.connect(governor).grantRole(await tradeFactory.STRATEGY(), strategy.address);
    await tradeFactory.connect(governor).grantRole(await tradeFactory.SWAPPER_SETTER(), swapperSetter.address);
    await tradeFactory.connect(governor).setStrategySwapper(strategy.address, uniswapV2Swapper.address);

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
    await tradeFactory.connect(strategy).create(tokenIn.address, tokenOut.address, amountIn, maxSlippage, moment().add('30', 'minutes').unix());
  });

  describe('trade executed with swapper', () => {
    let minAmountOut: BigNumber;
    given(async () => {
      const data = await uniswapLibrary.getBestPathEncoded({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: amountIn,
        uniswapV2Factory: uniswapV2Factory.address,
        uniswapV2Router: uniswapV2Router02.address,
      });
      // We can do this since ratio is 1 = 1
      minAmountOut = amountIn.sub(amountIn.mul(maxSlippage).div(10000 / 100));
      await tradeFactory.connect(mechanic).execute(1, data);
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
