import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { contract, given, then, when } from '../../utils/bdd';
import { abi as swapperABI } from '../../../artifacts/contracts/Swapper.sol/ISwapper.json';
import { smockit, smoddit, MockContract, ModifiableContractFactory, ModifiableContract } from '@eth-optimism/smock';
import { constants, evm, wallet } from '../../utils';
import { BigNumber, utils, Wallet } from 'ethers';
import Web3 from 'web3';
import moment from 'moment';

contract('TradeFactoryPositionsHandler', () => {
  let deployer: SignerWithAddress;
  let masterAdmin: SignerWithAddress;
  let strategy: SignerWithAddress;
  let swapperAdder: SignerWithAddress;
  let swapperSetter: SignerWithAddress;
  let strategyAdder: SignerWithAddress;
  let tradesModifier: SignerWithAddress;
  let positionsHandlerFactory: ModifiableContractFactory;
  let positionsHandler: ModifiableContract;
  let asyncSwapper: MockContract;

  const MASTER_ADMIN_ROLE: string = new Web3().utils.soliditySha3('MASTER_ADMIN') as string;
  const STRATEGY_ROLE: string = new Web3().utils.soliditySha3('STRATEGY') as string;
  const STRATEGY_ADDER_ROLE: string = new Web3().utils.soliditySha3('STRATEGY_ADDER') as string;
  const TRADES_MODIFIER_ROLE: string = new Web3().utils.soliditySha3('TRADES_MODIFIER') as string;

  before(async () => {
    [deployer, masterAdmin, swapperAdder, swapperSetter, strategyAdder, tradesModifier, strategy] = await ethers.getSigners();
    positionsHandlerFactory = await smoddit(
      'contracts/mock/TradeFactory/TradeFactoryPositionsHandler.sol:TradeFactoryPositionsHandlerMock',
      strategy
    );
  });

  beforeEach(async () => {
    await evm.reset();
    positionsHandler = await positionsHandlerFactory.deploy(
      masterAdmin.address,
      swapperAdder.address,
      swapperSetter.address,
      strategyAdder.address,
      tradesModifier.address
    );
    asyncSwapper = await smockit(swapperABI);
    await positionsHandler.connect(swapperAdder).addSwappers([asyncSwapper.address]);
    await positionsHandler.connect(swapperSetter).setStrategyAsyncSwapper(strategy.address, asyncSwapper.address);
    await positionsHandler.connect(strategyAdder).grantRole(STRATEGY_ROLE, strategy.address);
  });

  describe('constructor', () => {
    when('strategy adder is zero address', () => {
      then('tx is reverted with message');
    });
    when('trades modifier is zero address', () => {
      then('tx is reverted with message');
    });
    when('all arguments are valid', () => {
      then('strategy adder is set');
      then('trades modifier is set');
      then('admin role of strategy is strategy adder', async () => {
        expect(await positionsHandler.getRoleAdmin(STRATEGY_ROLE)).to.equal(STRATEGY_ADDER_ROLE);
      });
      then('admin role of strategy admin is master admin', async () => {
        expect(await positionsHandler.getRoleAdmin(STRATEGY_ADDER_ROLE)).to.equal(MASTER_ADMIN_ROLE);
      });
      then('admin role of trades modifier is master admin', async () => {
        expect(await positionsHandler.getRoleAdmin(TRADES_MODIFIER_ROLE)).to.equal(MASTER_ADMIN_ROLE);
      });
    });
  });

  describe('pendingTradesIds()', () => {
    when('there are no pending trades', () => {
      then('returns empty array', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.be.empty;
      });
    });
    when('there are pending trades', () => {
      let tradeId: BigNumber;
      given(async () => {
        const tx = await create({
          tokenIn: wallet.generateRandomAddress(),
          tokenOut: wallet.generateRandomAddress(),
          amountIn: utils.parseEther('100'),
          maxSlippage: 1000,
          deadline: moment().add('30', 'minutes').unix(),
        });
        tradeId = tx.id;
      });
      then('returns array of ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.eql([tradeId]);
      });
    });
  });

  describe('pendingTradesIds(address)', () => {
    when('strategy doesnt have pending trades', () => {
      then('returns empty array', async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](wallet.generateRandomAddress())).to.be.empty;
      });
    });
    when('strategy has pending trades', () => {
      let tradeId: BigNumber;
      given(async () => {
        const tx = await create({
          tokenIn: wallet.generateRandomAddress(),
          tokenOut: wallet.generateRandomAddress(),
          amountIn: utils.parseEther('100'),
          maxSlippage: 1000,
          deadline: moment().add('30', 'minutes').unix(),
        });
        tradeId = tx.id;
      });
      then('returns array of ids', async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.eql([tradeId]);
      });
    });
  });

  describe('create', () => {
    let swapper: MockContract;
    const tokenIn = wallet.generateRandomAddress();
    const tokenOut = wallet.generateRandomAddress();
    const amountIn = utils.parseEther('100');
    const maxSlippage = 1000;
    const deadline = moment().add('30', 'minutes').unix();
    given(async () => {
      swapper = await smockit(swapperABI);
      await positionsHandler.connect(swapperAdder).addSwappers([swapper.address]);
      await positionsHandler.connect(swapperSetter).setStrategyAsyncSwapper(strategy.address, swapper.address);
    });
    when('strategy is not registered', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(deployer).create(tokenIn, tokenOut, amountIn, maxSlippage, deadline)).to.be.revertedWith(
          `AccessControl: account ${deployer.address.toLowerCase()} is missing role ${STRATEGY_ROLE.toLowerCase()}`
        );
      });
    });
    when('strategy doesnt have async swapper assigned', () => {
      let newRandomStrategy: Wallet;
      given(async () => {
        newRandomStrategy = await wallet.generateRandom();
        await positionsHandler.connect(strategyAdder).grantRole(STRATEGY_ROLE, newRandomStrategy.address);
      });
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(newRandomStrategy).create(tokenIn, tokenOut, amountIn, maxSlippage, deadline)).to.be.revertedWith(
          'InvalidSwapper()'
        );
      });
    });
    when('token in is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(constants.ZERO_ADDRESS, tokenOut, amountIn, maxSlippage, deadline)).to.be.revertedWith(
          'ZeroAddress()'
        );
      });
    });
    when('token out is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(tokenIn, constants.ZERO_ADDRESS, amountIn, maxSlippage, deadline)).to.be.revertedWith(
          'ZeroAddress()'
        );
      });
    });
    when('amount in is zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(tokenIn, tokenOut, constants.ZERO, maxSlippage, deadline)).to.be.revertedWith('ZeroAmount()');
      });
    });
    when('max slippage is set to zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(tokenIn, tokenOut, amountIn, constants.ZERO, deadline)).to.be.revertedWith('ZeroSlippage()');
      });
    });
    when('deadline is equal or less than current timestamp', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(tokenIn, tokenOut, amountIn, maxSlippage, constants.ZERO_ADDRESS)).to.be.revertedWith(
          'InvalidDeadline()'
        );
      });
    });
    when('all data is correct', () => {
      let createTx: TransactionResponse;
      let tradeId: BigNumber;
      given(async () => {
        ({ tx: createTx, id: tradeId } = await create({
          tokenIn,
          tokenOut,
          amountIn,
          maxSlippage,
          deadline,
        }));
      });
      then('trade gets added to pending trades', async () => {
        const pendingTrade = await positionsHandler.pendingTradesById(tradeId);
        expect(pendingTrade._id).to.equal(BigNumber.from('1'));
        expect(pendingTrade._strategy).to.equal(strategy.address);
        expect(pendingTrade._swapper).to.equal(swapper.address);
        expect(pendingTrade._tokenIn).to.equal(tokenIn);
        expect(pendingTrade._tokenOut).to.equal(tokenOut);
        expect(pendingTrade._amountIn).to.equal(amountIn);
        expect(pendingTrade._maxSlippage).to.equal(maxSlippage);
        expect(pendingTrade._deadline).to.equal(deadline);
      });
      then('trade id gets added to pending trades by strategy', async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.eql([tradeId]);
      });
      then('trade id gets added to pending trades ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.eql([tradeId]);
      });
      then('trade counter gets increased', async () => {
        expect(await positionsHandler.callStatic.create(tokenIn, tokenOut, amountIn, maxSlippage, deadline)).to.be.equal(tradeId.add(1));
      });
      then('emits event', async () => {
        await expect(createTx)
          .to.emit(positionsHandler, 'TradeCreated')
          .withArgs(tradeId, strategy.address, swapper.address, tokenIn, tokenOut, amountIn, maxSlippage, deadline);
      });
    });
  });

  describe('cancelPendingTrades', () => {
    given(async () => {
      await positionsHandler.create(
        wallet.generateRandomAddress(),
        wallet.generateRandomAddress(),
        utils.parseEther('100'),
        1000,
        moment().add('30', 'minutes').unix()
      );
    });
    // TODO: only strategy
    when('pending trade does not exist', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.cancelPendingTrades([BigNumber.from('12')])).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('trying to cancel trades not owned', () => {
      let randomStrategy: Wallet;
      given(async () => {
        randomStrategy = await wallet.generateRandom();
        await positionsHandler.connect(strategyAdder).grantRole(STRATEGY_ROLE, randomStrategy.address);
      });
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(randomStrategy).cancelPendingTrades([1])).to.be.revertedWith('NotAuthorized()');
      });
    });
    when('trying to cancel trades not owned', () => {
      then('tx is reverted with reason');
    });
    when('pending trade exists', () => {
      let cancelTx: TransactionResponse;
      given(async () => {
        cancelTx = await positionsHandler.cancelPendingTrades([1]);
      });
      then('removes trade from trades', async () => {
        expect((await positionsHandler.pendingTradesById(1))._id).to.equal(0);
      });
      then(`removes trade from pending strategy's trade`, async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trade from pending trades ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(cancelTx).to.emit(positionsHandler, 'TradesCanceled').withArgs(strategy.address, [1]);
      });
    });
  });

  describe('changePendingTradesSwapper', () => {
    given(async () => {
      await positionsHandler.create(
        wallet.generateRandomAddress(),
        wallet.generateRandomAddress(),
        utils.parseEther('100'),
        1000,
        moment().add('30', 'minutes').unix()
      );
    });
    // ONLY TRADE MODIFIER
    when('setting sync swapper', () => {
      let syncSwapper: MockContract;
      given(async () => {
        syncSwapper = await smockit(swapperABI);
        syncSwapper.smocked.SWAPPER_TYPE.will.return.with(1);
      });
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(tradesModifier).changePendingTradesSwapper([1], syncSwapper.address)).to.be.revertedWith(
          'NotAsyncSwapper()'
        );
      });
    });
    when('swapper is not added', () => {
      let randomAsyncSwapper: MockContract;
      given(async () => {
        randomAsyncSwapper = await smockit(swapperABI);
        randomAsyncSwapper.smocked.SWAPPER_TYPE.will.return.with(0);
      });
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(tradesModifier).changePendingTradesSwapper([1], randomAsyncSwapper.address)).to.be.revertedWith(
          'InvalidSwapper()'
        );
      });
    });
    when('any of the trades is not pending', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(tradesModifier).changePendingTradesSwapper([99, 1], asyncSwapper.address)).to.be.revertedWith(
          'InvalidTrade()'
        );
      });
    });
    when('arguments are valid', () => {
      let randomAsyncSwapper: MockContract;
      let changeTx: TransactionResponse;
      given(async () => {
        randomAsyncSwapper = await smockit(swapperABI);
        randomAsyncSwapper.smocked.SWAPPER_TYPE.will.return.with(0);
        await positionsHandler.connect(swapperAdder).addSwappers([randomAsyncSwapper.address]);
        await create({
          tokenIn: wallet.generateRandomAddress(),
          tokenOut: wallet.generateRandomAddress(),
          amountIn: utils.parseEther('100'),
          maxSlippage: 1000,
          deadline: moment().add('30', 'minutes').unix(),
        });
        changeTx = await positionsHandler.connect(tradesModifier).changePendingTradesSwapper([1, 2], randomAsyncSwapper.address);
      });
      then('changes pending trades swappers', async () => {
        expect((await positionsHandler.pendingTradesById(1))._swapper).to.equal(randomAsyncSwapper.address);
        expect((await positionsHandler.pendingTradesById(2))._swapper).to.equal(randomAsyncSwapper.address);
      });
      then('emits event', async () => {
        await expect(changeTx).to.emit(positionsHandler, 'TradesSwapperChanged').withArgs([1, 2], randomAsyncSwapper.address);
      });
    });
  });

  describe('mergePendingTrades', () => {
    const tokenIn = wallet.generateRandomAddress();
    const tokenOut = wallet.generateRandomAddress();
    const amountIn1 = utils.parseEther('100');
    const amountIn2 = utils.parseEther('0.23958');
    const amountIn3 = utils.parseEther('12.74958');
    const maxSlippage = 1000;
    const deadline = moment().add('30', 'minutes').unix();
    given(async () => {
      await create({
        tokenIn,
        tokenOut,
        amountIn: amountIn1,
        maxSlippage,
        deadline,
      });
    });
    when('anchor trade does not exist', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(tradesModifier).mergePendingTrades(99, [1])).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('any of the trades to merge do not exist', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(tradesModifier).mergePendingTrades(1, [99])).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('merging trades from different strategies', () => {
      given(async () => {
        const randomStrategy = await wallet.generateRandom();
        await positionsHandler.connect(strategyAdder).grantRole(STRATEGY_ROLE, randomStrategy.address);
        await positionsHandler.connect(swapperSetter).setStrategyAsyncSwapper(randomStrategy.address, asyncSwapper.address);
        await positionsHandler
          .connect(randomStrategy)
          .create(
            wallet.generateRandomAddress(),
            wallet.generateRandomAddress(),
            utils.parseEther('100'),
            1000,
            moment().add('30', 'minutes').unix()
          );
      });
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.connect(tradesModifier).mergePendingTrades(1, [2])).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('arguments are vallid', () => {
      let mergeTx: TransactionResponse;
      given(async () => {
        await create({
          tokenIn,
          tokenOut,
          amountIn: amountIn2,
          maxSlippage,
          deadline,
        });
        await create({
          tokenIn,
          tokenOut,
          amountIn: amountIn3,
          maxSlippage,
          deadline,
        });
        mergeTx = await positionsHandler.connect(tradesModifier).mergePendingTrades(1, [2, 3]);
      });
      then('anchor trade amount in its the aggregation of merged trades', async () => {
        expect((await positionsHandler.pendingTradesById(1))._amountIn).to.be.equal(amountIn1.add(amountIn2).add(amountIn3));
      });
      then('all merged trades are removed from pending trades by strategy', async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.not.include([2, 3]);
      });
      then('all merged trades are removed from pending trades by id', async () => {
        expect((await positionsHandler['pendingTradesById(uint256)'](2))._swapper).to.equal(constants.ZERO_ADDRESS);
      });
      then('all merged trades are removed from pending trades array', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.not.include([2, 3]);
      });
      then('emits event', async () => {
        await expect(mergeTx).to.emit(positionsHandler, 'TradesMerged').withArgs(1, [2, 3]);
      });
    });
  });

  describe('_removePendingTrade', () => {
    when('pending trade exists', () => {
      let tradeId: BigNumber;
      given(async () => {
        ({ id: tradeId } = await create({
          tokenIn: wallet.generateRandomAddress(),
          tokenOut: wallet.generateRandomAddress(),
          amountIn: utils.parseEther('100'),
          maxSlippage: 1000,
          deadline: moment().add('30', 'minutes').unix(),
        }));
        await positionsHandler.removePendingTrade(strategy.address, tradeId);
      });
      then('removes trade from trades', async () => {
        expect((await positionsHandler.pendingTradesById(tradeId))._id).to.equal(0);
      });
      then(`removes trade from pending strategy's trade`, async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trade from pending trades ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.be.empty;
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
    maxSlippage: number;
    deadline: number;
  }): Promise<{ tx: TransactionResponse; id: BigNumber }> {
    const tx = await positionsHandler.connect(strategy).create(tokenIn, tokenOut, amountIn, maxSlippage, deadline);
    const txReceipt = await tx.wait();
    const parsedEvent = positionsHandler.interface.parseLog(txReceipt.logs[0]);
    return { tx, id: parsedEvent.args._id };
  }
});
