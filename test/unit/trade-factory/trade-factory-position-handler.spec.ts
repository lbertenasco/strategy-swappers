import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { abi as swapperRegistryABI } from '../../../artifacts/contracts/SwapperRegistry.sol/ISwapperRegistry.json';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { contract, given, then, when } from '../../utils/bdd';
import { smockit, MockContract } from '@eth-optimism/smock';
import { constants, wallet } from '../../utils';
import { BigNumber, utils } from 'ethers';
import moment from 'moment';

contract.only('TradeFactoryPositionsHandler', () => {
  let user: SignerWithAddress;
  let randomGuy: SignerWithAddress;
  let swapperRegistry: MockContract;
  let positionsHandlerFactory: ContractFactory;
  let positionsHandler: Contract;

  before(async () => {
    [user, randomGuy] = await ethers.getSigners();
    positionsHandlerFactory = await ethers.getContractFactory(
      'contracts/mock/TradeFactory/TradeFactoryPositionsHandler.sol:TradeFactoryPositionsHandlerMock'
    );
  });

  beforeEach(async () => {
    swapperRegistry = await smockit(swapperRegistryABI);
    positionsHandler = await positionsHandlerFactory.deploy(swapperRegistry.address);
  });

  describe('constructor', () => {});

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
        expect(await positionsHandler['pendingTradesIds(address)'](user.address)).to.eql([tradeId]);
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
      await positionsHandler.setSwapperSafetyCheckpoint(strategySafetyCheckpoint);
      swapperRegistry.smocked['isSwapper(string)'].will.return.with([true, swapperAddress, BigNumber.from(`${strategySafetyCheckpoint}`)]);
    });
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
        await expect(positionsHandler.create(swapper, tokenIn, tokenOut, amountIn, maxSlippage, moment().unix())).to.be.revertedWith(
          'TradeFactory: deadline too soon'
        );
      });
    });
    when('all data is correct', () => {
      let createTx: TransactionResponse;
      let tradeId: BigNumber;
      given(async () => {
        const createTrade = await create({
          swapper,
          tokenIn,
          tokenOut,
          amountIn,
          maxSlippage,
          deadline,
        });
        createTx = createTrade.tx;
        tradeId = createTrade.id;
      });
      then('consults swapper with registry', async () => {
        expect(swapperRegistry.smocked['isSwapper(string)'].calls[0]._swapper).to.be.equal(swapper);
      });
      then('trade gets added to pending trades', async () => {
        const pendingTrade = await positionsHandler.pendingTradesById(tradeId);
        expect(pendingTrade._id).to.equal(BigNumber.from('1'));
        expect(pendingTrade._strategy).to.equal(user.address);
        expect(pendingTrade._swapper).to.equal(swapperAddress);
        expect(pendingTrade._tokenIn).to.equal(tokenIn);
        expect(pendingTrade._tokenOut).to.equal(tokenOut);
        expect(pendingTrade._amountIn).to.equal(amountIn);
        expect(pendingTrade._maxSlippage).to.equal(maxSlippage);
        expect(pendingTrade._deadline).to.equal(deadline);
      });
      then('trade id gets added to pending trades by strategy', async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](user.address)).to.eql([tradeId]);
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
          .withArgs(tradeId, user.address, swapperAddress, tokenIn, tokenOut, amountIn, maxSlippage, deadline);
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
    when('pending trade does not exist', () => {
      then('tx is reverted with reason', async () => {
        await expect(positionsHandler.cancelPending(BigNumber.from('12'))).to.be.revertedWith('TradeFactory: trade not pending');
      });
    });
    when('trying to cancel a trade thats not owned by sender', () => {
      then('tx is reverted with reason');
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
        expect(await positionsHandler['pendingTradesIds(address)'](user.address)).to.be.empty;
      });
      then('removes trade from pending trades ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(cancelTx).to.emit(positionsHandler, 'TradeCanceled').withArgs(user.address, 1);
      });
    });
  });

  describe('cancelAllPending', () => {
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
        expect(await positionsHandler['pendingTradesIds(address)'](user.address)).to.be.empty;
      });
      then('removes trades from pending trades ids', async () => {
        expect(await positionsHandler['pendingTradesIds()']()).to.be.empty;
      });
      then('emits event', async () => {
        await expect(cancellAllPendingTx).to.emit(positionsHandler, 'TradesCanceled').withArgs(user.address, tradeIds);
      });
    });
  });

  describe('removePendingTrade', () => {
    when('pending trade exists', () => {
      then('removes pending trade id from owners pending trade list');
      then('removes it from pending trades ids list');
      then('removes it from pending trades');
    });
  });

  describe('changePendingTradesSwapper', () => {
    when('swapper is not registered', () => {
      then('tx is reverted with reason');
    });
    when('swapper was initiated later than strategy safety checkpoint', () => {
      then('tx is reverted with reason');
    });
    when('swapper is valid', () => {
      then("changes all pending trade's swapper");
      then('emits event');
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
