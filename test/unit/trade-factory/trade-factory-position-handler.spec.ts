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
  let positionsHandlerFactory: ModifiableContractFactory;
  let positionsHandler: ModifiableContract;
  let defaultSwapperAddress: MockContract;

  const MASTER_ADMIN_ROLE: string = new Web3().utils.soliditySha3('MASTER_ADMIN') as string;
  const STRATEGY_ROLE: string = new Web3().utils.soliditySha3('STRATEGY') as string;
  const STRATEGY_ADDER_ROLE: string = new Web3().utils.soliditySha3('STRATEGY_ADDER') as string;

  before(async () => {
    [deployer, masterAdmin, swapperAdder, swapperSetter, strategyAdder, strategy] = await ethers.getSigners();
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
      strategyAdder.address
    );
    defaultSwapperAddress = await smockit(swapperABI);
    await positionsHandler.connect(swapperAdder).addSwappers([defaultSwapperAddress.address]);
    await positionsHandler.connect(swapperSetter).setStrategyAsyncSwapper(strategy.address, defaultSwapperAddress.address);
    await positionsHandler.connect(strategyAdder).grantRole(STRATEGY_ROLE, strategy.address);
  });

  describe('constructor', () => {
    // TODO: Make it better
    when('all data is valid', () => {
      then('role admin of strategy is strategy admin', async () => {
        expect(await positionsHandler.getRoleAdmin(STRATEGY_ROLE)).to.equal(STRATEGY_ADDER_ROLE);
      });
      then('role admin of strategy admin is master admin', async () => {
        expect(await positionsHandler.getRoleAdmin(STRATEGY_ADDER_ROLE)).to.equal(MASTER_ADMIN_ROLE);
      });
    });
  });

  describe('grantRole', () => {
    when('granting STRATEGY_ROLE', () => {
      const randomStrategy = wallet.generateRandomAddress();
      when('not called from strategy adder', () => {
        let grantRoleTx: Promise<TransactionResponse>;
        given(() => {
          grantRoleTx = positionsHandler.connect(deployer).grantRole(STRATEGY_ROLE, randomStrategy);
        });
        then('tx get reverted with reason', async () => {
          await expect(grantRoleTx).to.be.reverted;
        });
      });
      when('called from strategy adder', () => {
        given(async () => {
          await positionsHandler.connect(strategyAdder).grantRole(STRATEGY_ROLE, randomStrategy);
        });
        then('role gets added to address', async () => {
          expect(await positionsHandler.hasRole(STRATEGY_ROLE, randomStrategy)).to.be.true;
        });
      });
    });
    when('granting STRATEGY_ADDER_ROLE', () => {
      let randomGuy: Wallet;
      beforeEach(async () => {
        randomGuy = await wallet.generateRandom();
      });
      when('not called from master adminx', () => {
        let grantRoleTx: Promise<TransactionResponse>;
        given(() => {
          grantRoleTx = positionsHandler.connect(deployer).grantRole(STRATEGY_ADDER_ROLE, randomGuy.address);
        });
        then('tx get reverted with reason', async () => {
          await expect(grantRoleTx).to.be.reverted;
        });
      });
      when('called from master adminx', () => {
        given(async () => {
          await positionsHandler.connect(masterAdmin).grantRole(STRATEGY_ADDER_ROLE, randomGuy.address);
        });
        then('role gets added to address', async () => {
          expect(await positionsHandler.hasRole(STRATEGY_ADDER_ROLE, randomGuy.address)).to.be.true;
        });
        then('new strategy admin can add strategies', async () => {
          const randomStrategy = wallet.generateRandomAddress();
          await positionsHandler.connect(randomGuy).grantRole(STRATEGY_ROLE, randomStrategy, { gasPrice: 0 });
          expect(await positionsHandler.hasRole(STRATEGY_ROLE, randomStrategy)).to.be.true;
        });
      });
    });
  });

  describe('revokeRole', () => {
    const randomStrategy = wallet.generateRandomAddress();
    when('revoking STRATEGY_ROLE', () => {
      given(async () => {
        await positionsHandler.connect(strategyAdder).grantRole(STRATEGY_ROLE, randomStrategy);
      });
      when('not called from master admin', () => {
        let grantRoleTx: Promise<TransactionResponse>;
        given(() => {
          grantRoleTx = positionsHandler.connect(deployer).revokeRole(STRATEGY_ROLE, randomStrategy);
        });
        then('tx get reverted with reason', async () => {
          await expect(grantRoleTx).to.be.reverted;
        });
      });
      when('called from master admin', () => {
        given(async () => {
          await positionsHandler.connect(strategyAdder).revokeRole(STRATEGY_ROLE, randomStrategy);
        });
        then('role gets removed from address', async () => {
          expect(await positionsHandler.hasRole(STRATEGY_ROLE, randomStrategy)).to.be.false;
        });
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
    when('swapper is not registered', () => {
      let newRandomStrategy: Wallet;
      given(async () => {
        newRandomStrategy = await wallet.generateRandom();
        await positionsHandler.connect(strategyAdder).grantRole(STRATEGY_ROLE, newRandomStrategy.address);
      });
      then('tx is reverted with reason', async () => {
        await expect(
          positionsHandler.connect(newRandomStrategy).create(tokenIn, tokenOut, amountIn, maxSlippage, deadline, { gasPrice: 0 })
        ).to.be.revertedWith('InvalidSwapper()');
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
        const staticDeadline = moment().unix() + 1000;
        await evm.advanceToTimeAndBlock(staticDeadline);
        await expect(positionsHandler.create(tokenIn, tokenOut, amountIn, maxSlippage, staticDeadline)).to.be.revertedWith('InvalidDeadline()');
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

  describe('cancelPending', () => {
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
        await expect(positionsHandler.cancelPending(BigNumber.from('12'))).to.be.revertedWith('InvalidTrade()');
      });
    });
    when('pending trade exists', () => {
      let cancelTx: TransactionResponse;
      given(async () => {
        cancelTx = await positionsHandler.cancelPending(1);
      });
      then('removes trade from trades', async () => {
        expect((await positionsHandler.pendingTradesById(1))._id).to.equal(0);
      });
      then("removes trade from pending strategy's trade", async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trade from pending trades ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(cancelTx).to.emit(positionsHandler, 'TradeCanceled').withArgs(strategy.address, 1);
      });
    });
  });

  describe('cancelAllPending', () => {
    // TODO: only strategy
    when('owner does have pending trades', () => {
      let tradeIds: BigNumber[];
      let cancellAllPendingTx: TransactionResponse;
      given(async () => {
        tradeIds = [];
        tradeIds.push(
          (
            await create({
              tokenIn: wallet.generateRandomAddress(),
              tokenOut: wallet.generateRandomAddress(),
              amountIn: utils.parseEther('100'),
              maxSlippage: 1000,
              deadline: moment().add('30', 'minutes').unix(),
            })
          ).id
        );
        tradeIds.push(
          (
            await create({
              tokenIn: wallet.generateRandomAddress(),
              tokenOut: wallet.generateRandomAddress(),
              amountIn: utils.parseEther('100'),
              maxSlippage: 1000,
              deadline: moment().add('30', 'minutes').unix(),
            })
          ).id
        );
        cancellAllPendingTx = await positionsHandler.cancelAllPending();
      });
      then('removes trades from trades', async () => {
        for (let i = 0; i < tradeIds.length; i++) {
          expect((await positionsHandler.pendingTradesById(tradeIds[i]))._id).to.equal(0);
        }
      });
      then("removes trades from pending strategy's trade", async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trades from pending trades ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(cancellAllPendingTx).to.emit(positionsHandler, 'TradesCanceled').withArgs(strategy.address, tradeIds);
      });
    });
  });

  describe('removePendingTrade', () => {
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
      then("removes trade from pending strategy's trade", async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](strategy.address)).to.be.empty;
      });
      then('removes trade from pending trades ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.be.empty;
      });
    });
  });

  describe('changeStrategyPendingTradesSwapper', () => {
    let tradeIds: BigNumber[];
    given(async () => {
      tradeIds = [];
      tradeIds.push(
        (
          await create({
            tokenIn: wallet.generateRandomAddress(),
            tokenOut: wallet.generateRandomAddress(),
            amountIn: utils.parseEther('100'),
            maxSlippage: 1000,
            deadline: moment().add('30', 'minutes').unix(),
          })
        ).id
      );
      tradeIds.push(
        (
          await create({
            tokenIn: wallet.generateRandomAddress(),
            tokenOut: wallet.generateRandomAddress(),
            amountIn: utils.parseEther('100'),
            maxSlippage: 1000,
            deadline: moment().add('30', 'minutes').unix(),
          })
        ).id
      );
    });
    // TODO: only SWAPPER_SETTER
    when('swapper is not registered', () => {
      let changeStrategyPendingTradesSwapper: Promise<TransactionResponse>;
      given(async () => {
        changeStrategyPendingTradesSwapper = positionsHandler
          .connect(swapperSetter)
          .changeStrategyPendingTradesSwapper(strategy.address, wallet.generateRandomAddress());
      });
      then('tx is reverted with reason', async () => {
        await expect(changeStrategyPendingTradesSwapper).to.be.revertedWith('InvalidSwapper()');
      });
    });
    when('swapper is valid', () => {
      let changeStrategyPendingTradesSwapper: TransactionResponse;
      const newSwapper = wallet.generateRandomAddress();
      given(async () => {
        await positionsHandler.connect(swapperAdder).addSwappers([newSwapper]);
        changeStrategyPendingTradesSwapper = await positionsHandler
          .connect(swapperSetter)
          .changeStrategyPendingTradesSwapper(strategy.address, newSwapper);
      });
      then("changes all pending trade's swapper", async () => {
        for (let i = 0; i < tradeIds.length; i++) {
          expect((await positionsHandler.pendingTradesById(tradeIds[i]))._swapper).to.equal(newSwapper);
        }
      });
      then('emits event', async () => {
        await expect(changeStrategyPendingTradesSwapper)
          .to.emit(positionsHandler, 'TradesSwapperChanged')
          .withArgs(strategy.address, tradeIds, newSwapper);
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
