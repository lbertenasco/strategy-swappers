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
  let swapperRegistry: MockContract;
  let positionsHandlerFactory: ContractFactory;
  let positionsHandler: Contract;

  before(async () => {
    [user] = await ethers.getSigners();
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
      then('returns array of ids');
    });
  });

  describe('pendingTradesIds(address)', () => {
    when('strategy doesnt have pending trades', () => {
      then('returns empty array', async () => {
        expect(await positionsHandler['pendingTradesIds(address)'](wallet.generateRandomAddress())).to.be.empty;
      });
    });
    when('strategy has pending trades', () => {
      then('returns array of ids');
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
    when('owner is zero address', () => {
      given(async () => {
        await positionsHandler.setSwapperSafetyCheckpointToAddress(constants.ZERO_ADDRESS, strategySafetyCheckpoint);
      });
      then('tx is reverted with reason', async () => {
        await expect(
          positionsHandler.createWithOwner(swapper, constants.ZERO_ADDRESS, tokenIn, tokenOut, amountIn, maxSlippage, deadline)
        ).to.be.revertedWith('TradeFactory: zero address');
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
        createTx = await positionsHandler.create(swapper, tokenIn, tokenOut, amountIn, maxSlippage, deadline);
        const txReceipt = await createTx.wait();
        const parsedEvent = positionsHandler.interface.parseLog(txReceipt.logs[0]);
        tradeId = parsedEvent.args._id;
      });
      then('consults swapper with registry', async () => {
        expect(swapperRegistry.smocked['isSwapper(string)'].calls[0]._swapper).to.be.equal(swapper);
      });
      then('trade gets added to pending trades', async () => {
        const pendingTrade = await positionsHandler.pendingTradesById(tradeId);
        expect(pendingTrade._id).to.equal(BigNumber.from('1'));
        expect(pendingTrade._owner).to.equal(user.address);
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
      await positionsHandler
        .connect(user)
        .create(
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
        await expect(positionsHandler.cancelPendingInternal(BigNumber.from('12'))).to.be.revertedWith('TradeFactory: trade not pending');
      });
    });
    when('pending trade exists', () => {
      let cancelTx: TransactionResponse;
      given(async () => {
        cancelTx = await positionsHandler.cancelPendingInternal(1);
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
        await expect(cancelTx).to.emit(positionsHandler, 'TradeCanceled').withArgs(1);
      });
    });
  });

  describe('cancelAllPendingOfOwner', () => {
    when('owner does not have pending trades', () => {
      then('tx is reverted with reason');
    });
    when('owner does have pending trades', () => {
      then('calls remove trade with correct values');
      then('emits event');
    });
  });

  describe('removePendingTrade', () => {
    when('pending trade exists', () => {
      then('removes pending trade id from owners pending trade list');
      then('removes it from pending trades ids list');
      then('removes it from pending trades');
    });
  });

  describe('changePendingTradesSwapperOfOwner', () => {
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
});
