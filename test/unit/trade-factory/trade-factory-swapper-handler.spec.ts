import moment from 'moment';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants, fixtures, wallet } from '../../utils';
import { contract, given, then, when } from '../../utils/bdd';
import { BigNumber } from '@ethersproject/bignumber';

contract('TradeFactorySwapperHandler', () => {
  let masterAdmin: SignerWithAddress;
  let swapperAdder: SignerWithAddress;
  let swapperSetter: SignerWithAddress;
  let mechanic: SignerWithAddress;

  let tradeFactoryFactory: ContractFactory;
  let tradeFactory: Contract;

  before(async () => {
    [masterAdmin, swapperAdder, swapperSetter, mechanic] = await ethers.getSigners();
    tradeFactoryFactory = await ethers.getContractFactory(
      'contracts/mock/TradeFactory/TradeFactorySwapperHandler.sol:TradeFactorySwapperHandlerMock'
    );
  });

  beforeEach(async () => {
    tradeFactory = await tradeFactoryFactory.deploy(masterAdmin.address, swapperAdder.address, swapperSetter.address);
  });

  describe('constructor', () => {
    // checks deployment
  });

  describe('swappers', () => {
    when('there are no swappers', () => {
      then('returns empty array', async () => {
        expect(await tradeFactory.swappers()).to.be.empty;
      });
    });
    when('there are swappers', () => {
      let swappers: string[];
      given(async () => {
        swappers = [wallet.generateRandomAddress(), wallet.generateRandomAddress(), wallet.generateRandomAddress()];
        await tradeFactory.connect(swapperAdder).connect(swapperAdder).addSwappers(swappers);
      });
      then('returns array with correct swappers', async () => {
        expect(await tradeFactory.swappers()).to.eql(swappers);
      });
    });
  });

  describe('activeSwappers', () => {
    when('there are no swappers', () => {
      then('returns empty array', async () => {
        expect(await tradeFactory.swappers()).to.be.empty;
      });
    });
    when('all current swapper are actives', () => {
      let swappers: string[];
      given(async () => {
        swappers = [wallet.generateRandomAddress(), wallet.generateRandomAddress(), wallet.generateRandomAddress()];
        await tradeFactory.connect(swapperAdder).connect(swapperAdder).addSwappers(swappers);
      });
      then('returns array with correct swappers', async () => {
        expect(await tradeFactory.swappers()).to.eql(swappers);
      });
    });
    when('some swappers were removed', () => {
      let swappers: string[];
      let activeSwappers: string[];
      given(async () => {
        swappers = [wallet.generateRandomAddress(), wallet.generateRandomAddress(), wallet.generateRandomAddress()];
        await tradeFactory.connect(swapperAdder).connect(swapperAdder).addSwappers(swappers);
        await tradeFactory.connect(swapperAdder).removeSwappers([swappers[1]]);
        activeSwappers = await tradeFactory.swappers();
      });
      then('array has same length as total swappers minus 1', () => {
        expect(activeSwappers).to.be.length(swappers.length - 1);
      });
      then('returns only active swappers', () => {
        expect(activeSwappers).to.include.members([swappers[0], swappers[2]]);
      });
    });
  });

  describe('isSwapper(address)', () => {
    when('is not a swapper', () => {
      then('returns false', async () => {
        expect(await tradeFactory['isSwapper(address)'](wallet.generateRandomAddress())).to.be.false;
      });
    });
    when('is a swapper', () => {
      let swapper: string;
      given(async () => {
        swapper = wallet.generateRandomAddress();
        await tradeFactory.connect(swapperAdder).connect(swapperAdder).addSwappers([swapper]);
      });
      then('returns true', async () => {
        expect(await tradeFactory['isSwapper(address)'](swapper)).to.be.true;
      });
    });
  });

  describe('addSwapper', () => {
    // only SWAPPER_ADDER
  });

  describe('_addSwapper', () => {
    when('adding swapper with zero address', () => {
      let addSwapperTx: Promise<TransactionResponse>;
      given(async () => {
        addSwapperTx = tradeFactory.connect(swapperAdder).addSwapper(constants.ZERO_ADDRESS);
      });
      then('tx is reverted with reason', async () => {
        await expect(addSwapperTx).to.be.revertedWith('TF: zero address');
      });
    });
    when('swapper was already added', () => {
      let swapper: string;
      let addSwapperTx: Promise<TransactionResponse>;
      given(async () => {
        swapper = wallet.generateRandomAddress();
        await tradeFactory.connect(swapperAdder).connect(swapperAdder).addSwappers([swapper]);
        addSwapperTx = tradeFactory.connect(swapperAdder).addSwapper(swapper);
      });
      then('tx is reverted with reason', async () => {
        await expect(addSwapperTx).to.be.revertedWith('TF: swapper already added');
      });
    });
    when('adding valid swapper', () => {
      let swapper: string;
      let addSwapperTx: TransactionResponse;
      given(async () => {
        swapper = wallet.generateRandomAddress();
        addSwapperTx = await tradeFactory.connect(swapperAdder).addSwapper(swapper);
      });
      then('gets added to swappers', async () => {
        expect(await tradeFactory['isSwapper(address)'](swapper)).to.be.true;
      });
      then('emits event with correct information', async () => {
        await expect(addSwapperTx).to.emit(tradeFactory, 'SwapperAdded').withArgs(swapper);
      });
    });
  });

  describe('removeSwapper', () => {
    // only SWAPPER_ADDER
  });

  describe('_removeSwapper', () => {
    when('swapper was not in registry', () => {
      let removeSwapperTx: Promise<TransactionResponse>;
      given(async () => {
        removeSwapperTx = tradeFactory.connect(swapperAdder).removeSwapper(wallet.generateRandomAddress());
      });
      then('tx is reverted with reason', async () => {
        await expect(removeSwapperTx).to.be.revertedWith('TF: swapper not added');
      });
    });
    when('swapper was in registry', () => {
      let swapper: string;
      let removeSwapperTx: TransactionResponse;
      given(async () => {
        swapper = wallet.generateRandomAddress();
        await tradeFactory.connect(swapperAdder).connect(swapperAdder).addSwappers([swapper]);
        removeSwapperTx = await tradeFactory.connect(swapperAdder).removeSwapper(swapper);
      });
      then('sets removed to true', async () => {
        expect(await tradeFactory.isSwapper(swapper)).to.be.false;
      });
      then('emits event with correct information', async () => {
        await expect(removeSwapperTx).to.emit(tradeFactory, 'SwapperRemoved').withArgs(swapper);
      });
    });
  });

  describe('sendDust', () => {
    // only MASTER_ADMIN
  });
});
