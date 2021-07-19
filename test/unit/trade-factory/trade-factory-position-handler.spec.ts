import { Contract } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { abi as swapperRegistryABI } from '../../../artifacts/contracts/SwapperRegistry.sol/ISwapperRegistry.json';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { contract, given, then, when } from '../../utils/bdd';
import { smockit, smoddit, MockContract, ModifiableContractFactory, ModifiableContract } from '@eth-optimism/smock';
import { constants, evm, wallet } from '../../utils';
import { BigNumber, utils } from 'ethers';
import Web3 from 'web3';
import moment from 'moment';

contract.only('TradeFactoryPositionsHandler', () => {
  let deployer: SignerWithAddress;
  let governor: SignerWithAddress;
  let strategy: SignerWithAddress;
  let swapperRegistry: MockContract;
  let positionsHandlerFactory: ModifiableContractFactory;
  let positionsHandler: ModifiableContract;

  const STRATEGY_ROLE = new Web3().utils.soliditySha3('STRATEGY');
  const STRATEGY_ADMIN_ROLE = new Web3().utils.soliditySha3('STRATEGY_ADMIN');

  before(async () => {
    [deployer, governor, strategy] = await ethers.getSigners();
    positionsHandlerFactory = await smoddit(
      'contracts/mock/TradeFactory/TradeFactoryPositionsHandler.sol:TradeFactoryPositionsHandlerMock',
      strategy
    );
  });

  beforeEach(async () => {
    swapperRegistry = await smockit(swapperRegistryABI);
    positionsHandler = await positionsHandlerFactory.deploy(governor.address, swapperRegistry.address);
    await positionsHandler.connect(governor).grantRole(STRATEGY_ROLE, strategy.address);
  });

  describe('constructor', () => {
    // TODO: Make it better
    when('all data is valid', () => {
      then('governor is set correctly', async () => {
        expect(await positionsHandler.governor()).to.equal(governor.address);
      });
      then('role admin of strategy is strategy admin', async () => {
        expect(await positionsHandler.getRoleAdmin(STRATEGY_ROLE)).to.equal(STRATEGY_ADMIN_ROLE);
      });
      then('governor has strategy admin role', async () => {
        expect(await positionsHandler.hasRole(STRATEGY_ADMIN_ROLE, governor.address)).to.be.true;
      });
    });
  });

  describe('grantRole', () => {
    const randomGuy = wallet.generateRandomAddress();
    when('not called from governor', () => {
      let grantRoleTx: Promise<TransactionResponse>;
      given(() => {
        grantRoleTx = positionsHandler.connect(deployer).grantRole(STRATEGY_ROLE, randomGuy);
      });
      then('tx get reverted with reason', async () => {
        await expect(grantRoleTx).to.be.reverted;
      });
    });
    when('called from governor', () => {
      given(async () => {
        await positionsHandler.connect(governor).grantRole(STRATEGY_ROLE, randomGuy);
      });
      then('role gets added to address', async () => {
        expect(await positionsHandler.hasRole(STRATEGY_ROLE, randomGuy)).to.be.true;
      });
    });
  });

  describe('revokeRole', () => {
    const randomGuy = wallet.generateRandomAddress();
    given(async () => {
      await positionsHandler.connect(governor).grantRole(STRATEGY_ROLE, randomGuy);
    });
    when('not called from governor', () => {
      let grantRoleTx: Promise<TransactionResponse>;
      given(() => {
        grantRoleTx = positionsHandler.connect(deployer).revokeRole(STRATEGY_ROLE, randomGuy);
      });
      then('tx get reverted with reason', async () => {
        await expect(grantRoleTx).to.be.reverted;
      });
    });
    when('called from governor', () => {
      given(async () => {
        await positionsHandler.connect(governor).revokeRole(STRATEGY_ROLE, randomGuy);
      });
      then('role gets removed from address', async () => {
        expect(await positionsHandler.hasRole(STRATEGY_ROLE, randomGuy)).to.be.false;
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
        swapperRegistry.smocked['isSwapper(string)'].will.return.with([true, wallet.generateRandomAddress(), 0]);
        const tx = await create({
          swapper: 'my-swapper',
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
        swapperRegistry.smocked['isSwapper(string)'].will.return.with([true, wallet.generateRandomAddress(), 0]);
        const tx = await create({
          swapper: 'my-swapper',
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

  describe('onlyStrategy', () => {
    when('not being called from strategy', () => {
      then('tx is reverted with reason');
    });
    when('being called from strategy', () => {
      then('strategy registry is consulted');
      then('tx is not reverted');
    });
  });

  describe('create', () => {
    const swapper = 'my-swapper';
    const swapperAddress = wallet.generateRandomAddress();
    const tokenIn = wallet.generateRandomAddress();
    const tokenOut = wallet.generateRandomAddress();
    const amountIn = utils.parseEther('100');
    const maxSlippage = 1000;
    const deadline = moment().add('30', 'minutes').unix();
    const strategySafetyCheckpoint = moment().unix();
    given(async () => {
      await positionsHandler.smodify.put({
        swapperSafetyCheckpoint: {
          [strategy.address]: strategySafetyCheckpoint,
        },
      });
      swapperRegistry.smocked['isSwapper(string)'].will.return.with([true, swapperAddress, BigNumber.from(`${strategySafetyCheckpoint}`)]);
    });
    // TODO: only strategy
    when('swapper is not registered', () => {
      given(async () => {
        swapperRegistry.smocked['isSwapper(string)'].will.return.with([false, '0x0000000000000000000000000000000000000000', constants.ZERO]);
      });
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(swapper, tokenIn, tokenOut, amountIn, maxSlippage, deadline)).to.be.revertedWith(
          'TradeFactory: invalid swapper'
        );
      });
    });
    when('swapper was initiated later than strategy safety checkpoint', () => {
      given(async () => {
        swapperRegistry.smocked['isSwapper(string)'].will.return.with([
          true,
          '0x0000000000000000000000000000000000000000',
          strategySafetyCheckpoint + 1,
        ]);
      });
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(swapper, tokenIn, tokenOut, amountIn, maxSlippage, deadline)).to.be.revertedWith(
          'TradeFactory: initialization greater than checkpoint'
        );
      });
    });
    when('token in is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(swapper, constants.ZERO_ADDRESS, tokenOut, amountIn, maxSlippage, deadline)).to.be.revertedWith(
          'TradeFactory: zero address'
        );
      });
    });
    when('token out is zero address', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(swapper, tokenIn, constants.ZERO_ADDRESS, amountIn, maxSlippage, deadline)).to.be.revertedWith(
          'TradeFactory: zero address'
        );
      });
    });
    when('amount in is zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(swapper, tokenIn, tokenOut, constants.ZERO, maxSlippage, deadline)).to.be.revertedWith(
          'TradeFactory: zero amount'
        );
      });
    });
    when('max slippage is set to zero', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(swapper, tokenIn, tokenOut, amountIn, constants.ZERO, deadline)).to.be.revertedWith(
          'TradeFactory: zero slippage'
        );
      });
    });
    when('deadline is equal or less than current timestamp', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.create(swapper, tokenIn, tokenOut, amountIn, maxSlippage, constants.ZERO_ADDRESS)).to.be.revertedWith(
          'TradeFactory: deadline too soon'
        );
        const staticDeadline = moment().unix() + 100;
        await evm.advanceToTime(staticDeadline);
        await expect(positionsHandler.create(swapper, tokenIn, tokenOut, amountIn, maxSlippage, staticDeadline)).to.be.revertedWith(
          'TradeFactory: deadline too soon'
        );
      });
    });
    when('all data is correct', () => {
      let createTx: TransactionResponse;
      let tradeId: BigNumber;
      given(async () => {
        ({ tx: createTx, id: tradeId } = await create({
          swapper,
          tokenIn,
          tokenOut,
          amountIn,
          maxSlippage,
          deadline,
        }));
      });
      then('consults swapper with registry', async () => {
        expect(swapperRegistry.smocked['isSwapper(string)'].calls[0]._swapper).to.be.equal(swapper);
      });
      then('trade gets added to pending trades', async () => {
        const pendingTrade = await positionsHandler.pendingTradesById(tradeId);
        expect(pendingTrade._id).to.equal(BigNumber.from('1'));
        expect(pendingTrade._strategy).to.equal(strategy.address);
        expect(pendingTrade._swapper).to.equal(swapperAddress);
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
        expect(await positionsHandler.callStatic.create(swapper, tokenIn, tokenOut, amountIn, maxSlippage, deadline)).to.be.equal(
          tradeId.add(1)
        );
      });
      then('emits event', async () => {
        await expect(createTx)
          .to.emit(positionsHandler, 'TradeCreated')
          .withArgs(tradeId, strategy.address, swapperAddress, tokenIn, tokenOut, amountIn, maxSlippage, deadline);
      });
    });
  });

  describe('cancelPending', () => {
    given(async () => {
      swapperRegistry.smocked['isSwapper(string)'].will.return.with([true, wallet.generateRandomAddress(), 0]);
      await positionsHandler.create(
        'my-swapper',
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
        await expect(positionsHandler.cancelPending(BigNumber.from('12'))).to.be.revertedWith('TradeFactory: trade not pending');
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
    when('owner does not have pending trades', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.cancelAllPending()).to.be.revertedWith('TradeFactory: no trades pending from strategy');
      });
    });
    when('owner does have pending trades', () => {
      let tradeIds: BigNumber[];
      let cancellAllPendingTx: TransactionResponse;
      given(async () => {
        tradeIds = [];
        swapperRegistry.smocked['isSwapper(string)'].will.return.with([true, wallet.generateRandomAddress(), 0]);
        tradeIds.push(
          (
            await create({
              swapper: 'my-swapper',
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
              swapper: 'my-swapper',
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
        swapperRegistry.smocked['isSwapper(string)'].will.return.with([true, wallet.generateRandomAddress(), 0]);
        ({ id: tradeId } = await create({
          swapper: 'my-swapper',
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

  describe('changePendingTradesSwapper', () => {
    let tradeIds: BigNumber[];
    given(async () => {
      tradeIds = [];
      swapperRegistry.smocked['isSwapper(string)'].will.return.with([true, wallet.generateRandomAddress(), 0]);
      tradeIds.push(
        (
          await create({
            swapper: 'my-swapper',
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
            swapper: 'my-swapper',
            tokenIn: wallet.generateRandomAddress(),
            tokenOut: wallet.generateRandomAddress(),
            amountIn: utils.parseEther('100'),
            maxSlippage: 1000,
            deadline: moment().add('30', 'minutes').unix(),
          })
        ).id
      );
    });
    // TODO: only strategy
    when('swapper is not registered', () => {
      let changePendingTradesSwapper: Promise<TransactionResponse>;
      given(async () => {
        swapperRegistry.smocked['isSwapper(string)'].will.return.with([false, constants.ZERO_ADDRESS, 0]);
        changePendingTradesSwapper = positionsHandler.changePendingTradesSwapper('new-swapper');
      });
      then('tx is reverted with reason', async () => {
        await expect(changePendingTradesSwapper).to.be.revertedWith('TradeFactory: invalid swapper');
      });
    });
    when('swapper was initiated later than strategy safety checkpoint', () => {
      let changePendingTradesSwapper: Promise<TransactionResponse>;
      const strategySafetyCheckpoint = moment().unix();
      given(async () => {
        await positionsHandler.smodify.put({
          swapperSafetyCheckpoint: {
            [strategy.address]: strategySafetyCheckpoint,
          },
        });
        swapperRegistry.smocked['isSwapper(string)'].will.return.with([
          true,
          '0x0000000000000000000000000000000000000000',
          strategySafetyCheckpoint + 1,
        ]);
        changePendingTradesSwapper = positionsHandler.changePendingTradesSwapper('new-swapper');
      });
      then('tx is reverted with reason', async () => {
        await expect(changePendingTradesSwapper).to.be.revertedWith('TradeFactory: initialization greater than checkpoint');
      });
    });
    when('swapper is valid', () => {
      let changePendingTradesSwapper: TransactionResponse;
      const newSwapper = 'new-swapper';
      const newSwapperAddress = wallet.generateRandomAddress();
      const strategySafetyCheckpoint = moment().unix();
      given(async () => {
        await positionsHandler.smodify.put({
          swapperSafetyCheckpoint: {
            [strategy.address]: strategySafetyCheckpoint,
          },
        });
        swapperRegistry.smocked['isSwapper(string)'].will.return.with([true, newSwapperAddress, 0]);
        changePendingTradesSwapper = await positionsHandler.changePendingTradesSwapper(newSwapper);
      });
      then('consults swapper with registry', async () => {
        expect(
          swapperRegistry.smocked['isSwapper(string)'].calls[swapperRegistry.smocked['isSwapper(string)'].calls.length - 1]._swapper
        ).to.be.equal(newSwapper);
      });
      then("changes all pending trade's swapper", async () => {
        for (let i = 0; i < tradeIds.length; i++) {
          expect((await positionsHandler.pendingTradesById(tradeIds[i]))._swapper).to.equal(newSwapperAddress);
        }
      });
      then('emits event', async () => {
        await expect(changePendingTradesSwapper)
          .to.emit(positionsHandler, 'TradesSwapperChanged')
          .withArgs(strategy.address, tradeIds, newSwapper);
      });
    });
  });

  async function create({
    swapper,
    tokenIn,
    tokenOut,
    amountIn,
    maxSlippage,
    deadline,
  }: {
    swapper: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: BigNumber;
    maxSlippage: number;
    deadline: number;
  }): Promise<{ tx: TransactionResponse; id: BigNumber }> {
    const tx = await positionsHandler.create(swapper, tokenIn, tokenOut, amountIn, maxSlippage, deadline);
    const txReceipt = await tx.wait();
    const parsedEvent = positionsHandler.interface.parseLog(txReceipt.logs[0]);
    return { tx, id: parsedEvent.args._id };
  }
});
