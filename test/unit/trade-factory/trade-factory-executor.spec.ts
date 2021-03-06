import { Contract } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { abi as machineryABI } from '@lbertenasco/contract-utils/artifacts/interfaces/utils/IMachinery.sol/IMachinery.json';
import { abi as IERC20ABI } from '../../../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json';
import { abi as swapperABI } from '../../../artifacts/contracts/Swapper.sol/ISwapper.json';
import { abi as otcPoolABI } from '../../../artifacts/contracts/OTCPool.sol/IOTCPool.json';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { contract, given, then, when } from '../../utils/bdd';
import { smockit, smoddit, MockContract, ModifiableContractFactory, ModifiableContract } from '@eth-optimism/smock';
import { constants, erc20, evm, wallet, contracts } from '../../utils';
import { BigNumber, utils, Wallet } from 'ethers';
import moment from 'moment';

contract('TradeFactoryExecutor', () => {
  let masterAdmin: SignerWithAddress;
  let strategy: SignerWithAddress;
  let swapperAdder: SignerWithAddress;
  let swapperSetter: SignerWithAddress;
  let strategyAdder: SignerWithAddress;
  let tradeModifier: SignerWithAddress;
  let tradeSettler: SignerWithAddress;
  let mechanic: SignerWithAddress;
  let machinery: MockContract;
  let asyncSwapper: MockContract;
  let syncSwapper: MockContract;
  let otcPool: MockContract;
  let executorFactory: ModifiableContractFactory;
  let modifiableExecutor: ModifiableContract;
  let executor: Contract;
  let token: Contract;

  before(async () => {
    [masterAdmin, swapperAdder, swapperSetter, strategyAdder, tradeModifier, tradeSettler, strategy, mechanic] = await ethers.getSigners();
    executorFactory = await smoddit('contracts/mock/TradeFactory/TradeFactoryExecutor.sol:TradeFactoryExecutorMock', mechanic);
  });

  beforeEach(async () => {
    await evm.reset();
    machinery = await smockit(machineryABI);
    asyncSwapper = await smockit(swapperABI);
    syncSwapper = await smockit(swapperABI);
    otcPool = await smockit(otcPoolABI);
    modifiableExecutor = await executorFactory.deploy(
      masterAdmin.address,
      swapperAdder.address,
      swapperSetter.address,
      strategyAdder.address,
      tradeModifier.address,
      tradeSettler.address,
      machinery.address
    );
    executor = modifiableExecutor.connect(mechanic);
    token = await erc20.deploy({
      symbol: 'TK',
      name: 'Token',
      initialAccount: strategy.address,
      initialAmount: utils.parseEther('10000'),
    });
    await executor.connect(strategyAdder).grantRole(await executor.STRATEGY(), strategy.address);
    await executor.connect(swapperAdder).addSwappers([asyncSwapper.address, syncSwapper.address]);
    await executor.connect(masterAdmin).setOTCPool(otcPool.address);
    machinery.smocked.isMechanic.will.return.with(true);
    asyncSwapper.smocked.SWAPPER_TYPE.will.return.with(0);
    syncSwapper.smocked.SWAPPER_TYPE.will.return.with(1);
    await executor.connect(swapperSetter).setStrategySyncSwapper(strategy.address, syncSwapper.address);
    await executor.connect(swapperSetter).setStrategyAsyncSwapper(strategy.address, asyncSwapper.address);
  });

  describe('constructor', () => {});

  describe('execute sync', () => {
    const amountIn = utils.parseEther('100');
    const tokenOut = wallet.generateRandomAddress();
    const maxSlippage = BigNumber.from('1000');
    const data = ethers.utils.defaultAbiCoder.encode([], []);
    // TODO: ONLY STRATEGY
    when('token in is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor
            .connect(strategy)
            ['execute(address,address,uint256,uint256,bytes)'](constants.ZERO_ADDRESS, tokenOut, amountIn, maxSlippage, data)
        ).to.be.revertedWith('ZeroAddress()');
      });
    });
    when('token out is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor
            .connect(strategy)
            ['execute(address,address,uint256,uint256,bytes)'](token.address, constants.ZERO_ADDRESS, amountIn, maxSlippage, data)
        ).to.be.revertedWith('ZeroAddress()');
      });
    });
    when('amount in is zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor
            .connect(strategy)
            ['execute(address,address,uint256,uint256,bytes)'](token.address, tokenOut, constants.ZERO, maxSlippage, data)
        ).to.be.revertedWith('ZeroAmount()');
      });
    });
    when('max slippage is zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(
          executor.connect(strategy)['execute(address,address,uint256,uint256,bytes)'](token.address, tokenOut, amountIn, constants.ZERO, data)
        ).to.be.revertedWith('ZeroSlippage()');
      });
    });
    when('is not the first trade being executed of token in & swapper', async () => {
      let executeTx: TransactionResponse;
      let initialStrategyBalance: BigNumber;
      let initialSwapperBalance: BigNumber;
      const receivedAmount = utils.parseEther('92356');
      given(async () => {
        syncSwapper.smocked.swap.will.return.with(receivedAmount);
        initialStrategyBalance = await token.balanceOf(strategy.address);
        initialSwapperBalance = await token.balanceOf(syncSwapper.address);
        await token.connect(strategy).approve(executor.address, amountIn);
        executeTx = await executor
          .connect(strategy)
          ['execute(address,address,uint256,uint256,bytes)'](token.address, tokenOut, amountIn, maxSlippage, data);
      });
      then('approve from strategy to trade factory gets reduced', async () => {
        expect(await token.allowance(strategy.address, syncSwapper.address)).to.be.equal(0);
      });
      then('funds get taken from strategy', async () => {
        expect(await token.balanceOf(strategy.address)).to.equal(initialStrategyBalance.sub(amountIn));
      });
      then('moves funds from strategy to swapper', async () => {
        expect(await token.balanceOf(syncSwapper.address)).to.equal(initialSwapperBalance.add(amountIn));
      });
      then('calls swapper swap with correct data', () => {
        expect(syncSwapper.smocked.swap.calls[0]).to.be.eql([strategy.address, token.address, tokenOut, amountIn, maxSlippage, data]);
      });
      then('emits event', async () => {
        await expect(executeTx)
          .to.emit(executor, 'SyncTradeExecuted')
          .withArgs(strategy.address, syncSwapper.address, token.address, tokenOut, amountIn, maxSlippage, data, receivedAmount);
      });
    });
  });

  describe('execute async', () => {
    let tradeId: BigNumber;
    const amountIn = utils.parseEther('100');
    const deadline = moment().add('30', 'minutes').unix();
    const tokenOut = wallet.generateRandomAddress();
    const maxSlippage = BigNumber.from('1000');
    const data = contracts.encodeParameters([], []);
    given(async () => {
      ({ id: tradeId } = await create({
        tokenIn: token.address,
        tokenOut,
        amountIn,
        maxSlippage,
        deadline,
      }));
    });
    // TODO: Only mechanic
    when('executing a trade thats not pending', () => {
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256,bytes)'](tradeId.add(1), data)).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('trade has expired', () => {
      given(async () => {
        await evm.advanceToTimeAndBlock(deadline + 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256,bytes)'](tradeId, data)).to.be.revertedWith('ExpiredTrade()');
      });
    });
    when('executing a trade where swapper has been removed', () => {
      given(async () => {
        const otherAsyncSwapper = await smockit(swapperABI);
        await executor.connect(swapperAdder).addSwappers([otherAsyncSwapper.address, syncSwapper.address]);
        otherAsyncSwapper.smocked.SWAPPER_TYPE.will.return.with(0);
        await executor.connect(swapperSetter).setStrategyAsyncSwapper(strategy.address, otherAsyncSwapper.address);
        await executor.connect(swapperAdder).removeSwappers([asyncSwapper.address]);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256,bytes)'](tradeId, data)).to.be.revertedWith('InvalidSwapper()');
      });
    });
    when('is not the first trade being executed of token in & swapper', () => {
      let executeTx: TransactionResponse;
      let initialStrategyBalance: BigNumber;
      let initialSwapperBalance: BigNumber;
      const receivedAmount = utils.parseEther('92356');
      given(async () => {
        asyncSwapper.smocked.swap.will.return.with(receivedAmount);
        initialStrategyBalance = await token.balanceOf(strategy.address);
        initialSwapperBalance = await token.balanceOf(asyncSwapper.address);
        executeTx = await executor['execute(uint256,bytes)'](tradeId, data);
      });
      then('approve from strategy to trade factory gets reduced', async () => {
        expect(await token.allowance(strategy.address, asyncSwapper.address)).to.be.equal(0);
      });
      then('funds get taken from strategy', async () => {
        expect(await token.balanceOf(strategy.address)).to.equal(initialStrategyBalance.sub(amountIn));
      });
      then('moves funds from strategy to swapper', async () => {
        expect(await token.balanceOf(asyncSwapper.address)).to.equal(initialSwapperBalance.add(amountIn));
      });
      then('calls swapper swap with correct data', () => {
        expect(asyncSwapper.smocked.swap.calls[0]).to.be.eql([strategy.address, token.address, tokenOut, amountIn, maxSlippage, data]);
      });
      then('removes trades from trades', async () => {
        expect(await executor.pendingTradesById(tradeId))
          .to.haveOwnProperty('_id')
          .to.equal(0);
      });
      then("removes trades from pending strategy's trade", async () => {
        expect(await executor['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trades from pending trades ids', async () => {
        expect(await executor['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(executeTx).to.emit(executor, 'AsyncTradeExecuted').withArgs(tradeId, receivedAmount);
      });
    });
  });

  describe('expire', () => {
    let tradeId: BigNumber;
    const amountIn = utils.parseEther('100');
    given(async () => {
      ({ id: tradeId } = await create({
        tokenIn: token.address,
        tokenOut: wallet.generateRandomAddress(),
        amountIn,
        maxSlippage: 1000,
        deadline: moment().add('30', 'minutes').unix(),
      }));
    });
    // TODO: Only mechanic
    when('expiring a trade thats not pending', () => {
      then('tx is reverted with reason', async () => {
        await expect(executor.expire(tradeId.add(1))).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('trade has not expired', () => {
      then('tx is reverted with reason', async () => {
        await expect(executor.expire(tradeId)).to.be.revertedWith('OngoingTrade()');
      });
    });
    when('trade can be expired', () => {
      let expireTx: TransactionResponse;
      given(async () => {
        await evm.advanceToTimeAndBlock(moment().add('100', 'hours').unix());
        expireTx = await executor.expire(tradeId);
      });
      then('reduces allowance from strategy to trade factory', async () => {
        expect(await token.allowance(strategy.address, executor.address)).to.be.equal(0);
      });
      then('removes trades from trades', async () => {
        expect(await executor.pendingTradesById(tradeId))
          .to.haveOwnProperty('_id')
          .to.equal(0);
      });
      then("removes trades from pending strategy's trade", async () => {
        expect(await executor['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trades from pending trades ids', async () => {
        expect(await executor['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(expireTx).to.emit(executor, 'AsyncTradeExpired').withArgs(tradeId);
      });
    });
  });

  describe('execute async trade against trade', () => {
    let otherStrat: Wallet;
    let tokenOut: Contract;
    let firstTrade: any;
    let secondTrade: any;
    given(async () => {
      otherStrat = await wallet.generateRandom();
      tokenOut = await erc20.deploy({
        symbol: 'TKO',
        name: 'Token out',
        initialAccount: otherStrat.address,
        initialAmount: utils.parseEther('10000'),
      });
      await executor.connect(strategyAdder).grantRole(await executor.STRATEGY(), otherStrat.address);
      await executor.connect(swapperSetter).setStrategyAsyncSwapper(otherStrat.address, asyncSwapper.address);
      // Enable COW for both strategies
      await executor.connect(swapperSetter).setStrategyPermissions(strategy.address, 2);
      await executor.connect(swapperSetter).setStrategyPermissions(otherStrat.address, 2);
      firstTrade = {
        amountIn: utils.parseEther('100'),
        tokenIn: token.address,
        tokenOut: tokenOut.address,
        deadline: moment().add('30', 'minutes').unix(),
        maxSlippage: BigNumber.from('1000'),
      };
      secondTrade = {
        amountIn: utils.parseEther('100'),
        tokenIn: tokenOut.address,
        tokenOut: token.address,
        deadline: moment().add('30', 'minutes').unix(),
        maxSlippage: BigNumber.from('1000'),
      };
      // ID: 1
      await token.connect(strategy).approve(executor.address, firstTrade.amountIn);
      await executor
        .connect(strategy)
        .create(firstTrade.tokenIn, firstTrade.tokenOut, firstTrade.amountIn, firstTrade.maxSlippage, firstTrade.deadline);
      // ID: 2
      await tokenOut.connect(otherStrat).approve(executor.address, secondTrade.amountIn);
      await executor
        .connect(otherStrat)
        .create(secondTrade.tokenIn, secondTrade.tokenOut, secondTrade.amountIn, secondTrade.maxSlippage, secondTrade.deadline);
    });
    when('trades have different token in than token out', () => {
      given(async () => {
        await executor
          .connect(otherStrat)
          .create(wallet.generateRandomAddress(), firstTrade.tokenOut, firstTrade.amountIn, firstTrade.maxSlippage, firstTrade.deadline);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](3, 2, 0, 0)).to.be.revertedWith(
          'InvalidTrade()'
        );
      });
    });
    when('trades have different token out than token in', () => {
      given(async () => {
        await executor
          .connect(otherStrat)
          .create(firstTrade.tokenIn, wallet.generateRandomAddress(), firstTrade.amountIn, firstTrade.maxSlippage, firstTrade.deadline);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](3, 2, 0, 0)).to.be.revertedWith(
          'InvalidTrade()'
        );
      });
    });
    when('first trade has expired', () => {
      given(async () => {
        await executor
          .connect(otherStrat)
          .create(firstTrade.tokenIn, firstTrade.tokenOut, firstTrade.amountIn, firstTrade.maxSlippage, moment().add('1', 'minutes').unix());
        await evm.advanceToTimeAndBlock(moment().add('2', 'minutes').unix());
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](3, 2, 0, 0)).to.be.revertedWith(
          'ExpiredTrade()'
        );
      });
    });
    when('against trade has expired', () => {
      given(async () => {
        await executor
          .connect(otherStrat)
          .create(secondTrade.tokenIn, secondTrade.tokenOut, secondTrade.amountIn, secondTrade.maxSlippage, moment().add('1', 'minutes').unix());
        await evm.advanceToTimeAndBlock(moment().add('2', 'minutes').unix());
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](1, 3, 0, 0)).to.be.revertedWith(
          'ExpiredTrade()'
        );
      });
    });
    when(`first trade's strategy doesnt have COW enabled`, () => {
      given(async () => {
        await executor.connect(swapperSetter).setStrategyPermissions(strategy.address, 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](1, 2, 0, 0)).to.be.revertedWith(
          'NotAuthorized()'
        );
      });
    });
    when(`second trade's strategy doesnt have COW enabled`, () => {
      given(async () => {
        await executor.connect(swapperSetter).setStrategyPermissions(otherStrat.address, 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](1, 2, 0, 0)).to.be.revertedWith(
          'NotAuthorized()'
        );
      });
    });
    // when('anchor trade cant cover for all against trade', () => {
    //   let tradeTx: TransactionResponse;
    //   const rate = utils.parseEther('0.9');
    //   given(async () => {
    //     tradeTx = await executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](1, 2, rate);
    //   });
    //   then('strategy that owns anchor trade gets correct amount of tokens airdropped', async () => {
    //     expect(await tokenOut.balanceOf(strategy.address)).to.equal(utils.parseEther('90'));
    //   });
    //   then('strategy that owns against trade gets correct amount of tokens airdropped', async () => {
    //     expect(await token.balanceOf(otherStrat.address)).to.equal(anchorTrade.amountIn);
    //   });
    //   then('amount in of against trade gets reduced accodingly', async () => {
    //     expect(await executor.pendingTradesById(2))
    //       .to.haveOwnProperty('_amountIn')
    //       .to.equal(utils.parseEther('10'));
    //   });
    //   then('anchor trade gets removed', async () => {
    //     expect(await executor.pendingTradesById(1))
    //       .to.haveOwnProperty('_id')
    //       .to.equal(0);
    //   });
    //   then('emits event with correct information', async () => {
    //     await expect(tradeTx)
    //       .to.emit(executor, 'AsyncTradesMatched')
    //       .withArgs(1, 2, anchorTrade.amountIn, utils.parseEther('90'), utils.parseEther('90'), anchorTrade.amountIn);
    //   });
    // });
    // when('against trade cant fullfil for all anchor trade', () => {
    //   let tradeTx: TransactionResponse;
    //   const rate = utils.parseEther('2');
    //   given(async () => {
    //     tradeTx = await executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](1, 2, rate);
    //   });
    //   then('strategy that owns anchor trade gets correct amount of tokens airdropped', async () => {
    //     expect(await tokenOut.balanceOf(strategy.address)).to.equal(utils.parseEther('100'));
    //   });
    //   then('strategy that owns against trade gets correct amount of tokens airdropped', async () => {
    //     expect(await token.balanceOf(otherStrat.address)).to.equal(utils.parseEther('50'));
    //   });
    //   then('amount in of anchor trade gets reduced accodingly', async () => {
    //     expect(await executor.pendingTradesById(1))
    //       .to.haveOwnProperty('_amountIn')
    //       .to.equal(utils.parseEther('50'));
    //   });
    //   then('against trade gets removed', async () => {
    //     expect(await executor.pendingTradesById(2))
    //       .to.haveOwnProperty('_id')
    //       .to.equal(0);
    //   });
    //   then('emits event with correct information', async () => {
    //     await expect(tradeTx)
    //       .to.emit(executor, 'AsyncTradesMatched')
    //       .withArgs(1, 2, utils.parseEther('50'), utils.parseEther('100'), utils.parseEther('100'), utils.parseEther('50'));
    //   });
    // });
    // when('there is a coincidence of wants', () => {
    //   let tradeTx: TransactionResponse;
    //   const rate = utils.parseEther('1');
    //   given(async () => {
    //     tradeTx = await executor.connect(tradeSettler)['execute(uint256,uint256,uint256,uint256)'](1, 2, rate);
    //   });
    //   then('strategy that owns anchor trade gets correct amount of tokens airdropped', async () => {
    //     expect(await tokenOut.balanceOf(strategy.address)).to.equal(utils.parseEther('100'));
    //   });
    //   then('strategy that owns against trade gets correct amount of tokens airdropped', async () => {
    //     expect(await token.balanceOf(otherStrat.address)).to.equal(utils.parseEther('100'));
    //   });
    //   then('anchor trade gets removed', async () => {
    //     expect(await executor.pendingTradesById(1))
    //       .to.haveOwnProperty('_id')
    //       .to.equal(0);
    //   });
    //   then('against trade gets removed', async () => {
    //     await expect(tradeTx)
    //       .to.emit(executor, 'AsyncTradesMatched')
    //       .withArgs(1, 2, utils.parseEther('100'), utils.parseEther('100'), utils.parseEther('100'), utils.parseEther('100'));
    //   });
    // });
  });

  describe('execute otc', () => {
    const amountIn = utils.parseEther('100');
    const deadline = moment().add('30', 'minutes').unix();
    const tokenOut = wallet.generateRandomAddress();
    const maxSlippage = BigNumber.from('1000');
    const governor = wallet.generateRandomAddress();
    given(async () => {
      otcPool.smocked.governor.will.return.with(governor);
      await executor.connect(swapperSetter).setStrategyPermissions(strategy.address, [1]);
      await create({
        tokenIn: token.address,
        tokenOut,
        amountIn,
        maxSlippage,
        deadline,
      });
    });
    // TODO: Only mechanic
    when('executing a trade that is not pending', () => {
      then('tx is reverted', async () => {
        await expect(executor['execute(uint256[],uint256)']([2], 1)).to.be.reverted;
      });
    });
    when('executing trades with zero rate', () => {
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256[],uint256)']([1], 0)).to.be.revertedWith('ZeroRate()');
      });
    });
    when('some trades being executed have different token in', () => {
      given(async () => {
        const tokenIn = await smockit(IERC20ABI);
        await create({
          tokenIn: tokenIn.address,
          tokenOut,
          amountIn,
          maxSlippage,
          deadline,
        });
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256[],uint256)']([1, 2], 1)).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('some trades being executed have different token out', () => {
      given(async () => {
        await create({
          tokenIn: token.address,
          tokenOut: (await smockit(IERC20ABI)).address,
          amountIn,
          maxSlippage,
          deadline,
        });
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256[],uint256)']([1, 2], 1)).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('a trade has expired', () => {
      given(async () => {
        await evm.advanceToTimeAndBlock(deadline + 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256[],uint256)']([1], 1)).to.be.revertedWith('ExpiredTrade()');
      });
    });
    when('trade strategy did not have OTC enabled', () => {
      given(async () => {
        await executor.connect(swapperSetter).setStrategyPermissions(strategy.address, [0]);
      });
      then('tx is reverted with reason', async () => {
        await expect(executor['execute(uint256[],uint256)']([1], 1)).to.be.revertedWith('NotAuthorized()');
      });
    });
    when('safe transfer to governor reverts', () => {
      given(async () => {
        await token.connect(strategy).approve(executor.address, 0);
      });
      then('tx is reverted', async () => {
        await expect(executor['execute(uint256[],uint256)']([2], 1)).to.be.reverted;
      });
    });
    when.skip('taking funds from otc pool reverts', () => {
      given(async () => {
        otcPool.smocked.take.will.revert.with('take error');
      });
      then('tx is reverted', async () => {
        await expect(executor['execute(uint256[],uint256)']([1], 1)).to.be.revertedWith('take error');
      });
    });
    when('arguments are valid', () => {
      let executeTx: TransactionResponse;
      const rate = utils.parseEther('0.5');
      given(async () => {
        await create({
          tokenIn: token.address,
          tokenOut,
          amountIn,
          maxSlippage,
          deadline,
        });
        executeTx = await executor['execute(uint256[],uint256)']([1, 2], rate);
      });
      then('all funds of trades are sent to otc pool governor', async () => {
        expect(await token.balanceOf(governor)).to.be.equal(amountIn.mul(2));
      });
      then('otc pool take is called correctly', async () => {
        expect(otcPool.smocked.take.calls[0]).to.haveOwnProperty('_wantedToken').to.equal(tokenOut);
        expect(otcPool.smocked.take.calls[0]).to.haveOwnProperty('_amount').to.equal(amountIn.div(2));
        expect(otcPool.smocked.take.calls[0]).to.haveOwnProperty('_receiver').to.equal(strategy.address);
        expect(otcPool.smocked.take.calls[1]).to.haveOwnProperty('_wantedToken').to.equal(tokenOut);
        expect(otcPool.smocked.take.calls[1]).to.haveOwnProperty('_amount').to.equal(amountIn.div(2));
        expect(otcPool.smocked.take.calls[1]).to.haveOwnProperty('_receiver').to.equal(strategy.address);
      });
      then('all trades get removed', async () => {
        expect(await executor.pendingTradesById(1))
          .to.haveOwnProperty('_id')
          .to.equal(0);
        expect(await executor.pendingTradesById(2))
          .to.haveOwnProperty('_id')
          .to.equal(0);
      });
      then('emits event with correct information', async () => {
        await expect(executeTx).to.emit(executor, 'AsyncOTCTradesExecuted').withArgs([1, 2], rate);
      });
    });
  });

  async function create({
    tokenIn,
    tokenOut,
    amountIn,
    maxSlippage,
    deadline,
  }: {
    tokenIn: string;
    tokenOut: string;
    amountIn: BigNumber;
    maxSlippage: BigNumber | number;
    deadline: number;
  }): Promise<{ tx: TransactionResponse; id: BigNumber }> {
    await token.connect(strategy).increaseAllowance(executor.address, amountIn);
    const tx = await executor.connect(strategy).create(tokenIn, tokenOut, amountIn, maxSlippage, deadline);
    const txReceipt = await tx.wait();
    const parsedEvent = executor.interface.parseLog(txReceipt.logs[0]);
    return { tx, id: parsedEvent.args._id };
  }
});
