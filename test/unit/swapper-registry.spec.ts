import moment from 'moment';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { constants, wallet } from '../utils';
import { contract, given, then, when } from '../utils/bdd';
import { BigNumber } from '@ethersproject/bignumber';

contract('SwapperRegistry', () => {
  let governor: SignerWithAddress;
  let swapperRegistryFactory: ContractFactory;
  let swapperRegistry: Contract;

  before(async () => {
    [governor] = await ethers.getSigners();
    swapperRegistryFactory = await ethers.getContractFactory('contracts/mock/SwapperRegistry.sol:SwapperRegistryMock');
  });

  beforeEach(async () => {
    swapperRegistry = await swapperRegistryFactory.deploy(governor.address);
  });

  describe('swappers', () => {
    when('there are no swappers', () => {
      then('returns empty array', async () => {
        expect(await swapperRegistry.swappers()).to.be.empty;
      });
    });
    when('there are swappers', () => {
      let swappers: string[];
      given(async () => {
        swappers = [await wallet.generateRandomAddress(), await wallet.generateRandomAddress(), await wallet.generateRandomAddress()];
        await swapperRegistry.addSwappersToSwappers(swappers);
      });
      then('returns array with correct swappers', async () => {
        expect(await swapperRegistry.swappers()).to.eql(swappers);
      });
    });
  });

  describe('swapperNames', () => {
    when('there are no swappers', () => {
      then('returns empty array', async () => {
        expect(await swapperRegistry.swapperNames()).to.be.empty;
      });
    });
    when('there are swapper names', () => {
      let swapperNames = [
        Math.random().toString(36).substring(7),
        Math.random().toString(36).substring(7),
        Math.random().toString(36).substring(7),
        Math.random().toString(36).substring(7),
      ];
      given(async () => {
        for (let i = 0; i < swapperNames.length; i++) {
          const address = await wallet.generateRandomAddress();
          await swapperRegistry.addNameByAddress(address, swapperNames[i]);
          await swapperRegistry.addSwappersToSwappers([address]);
        }
      });
      then('returns array with correct swapper names', async () => {
        expect(await swapperRegistry.swapperNames()).to.eql(swapperNames);
      });
    });
  });

  describe('activeSwappers', () => {
    when('there are no swappers', () => {
      then('returns empty array', async () => {
        expect(await swapperRegistry.activeSwappers()).to.be.empty;
      });
    });
    when('all current swapper are actives', () => {
      let swappers: string[];
      given(async () => {
        swappers = [await wallet.generateRandomAddress(), await wallet.generateRandomAddress(), await wallet.generateRandomAddress()];
        await swapperRegistry.addSwappersToSwappers(swappers);
      });
      then('returns array with correct swappers', async () => {
        expect(await swapperRegistry.activeSwappers()).to.eql(swappers);
      });
    });
    when('some swappers were deprecated', () => {
      let swappers: string[];
      let activeSwappers: string[];
      given(async () => {
        swappers = [await wallet.generateRandomAddress(), await wallet.generateRandomAddress(), await wallet.generateRandomAddress()];
        await swapperRegistry.addSwappersToSwappers(swappers);
        await swapperRegistry.setDeprecatedByAddress(swappers[1], true);
        activeSwappers = await swapperRegistry.activeSwappers();
      });
      then('array has same length as total swappers', () => {
        expect(activeSwappers).to.be.length(swappers.length);
      });
      then('returns only active swappers', () => {
        expect(activeSwappers).to.include.members([swappers[0], swappers[2]]);
      });
      then('rest of array is zero address', () => {
        expect(activeSwappers).to.include.members([constants.ZERO_ADDRESS]);
      });
    });
  });

  describe('deprecatedSwappers', () => {
    when('there are no swappers', () => {
      then('returns empty array', async () => {
        expect(await swapperRegistry.deprecatedSwappers()).to.be.empty;
      });
    });
    when('all current swapper are deprecated', () => {
      let swappers: string[];
      given(async () => {
        swappers = [await wallet.generateRandomAddress(), await wallet.generateRandomAddress(), await wallet.generateRandomAddress()];
        await swapperRegistry.addSwappersToSwappers(swappers);
        await swapperRegistry.setDeprecatedByAddress(swappers[0], true);
        await swapperRegistry.setDeprecatedByAddress(swappers[1], true);
        await swapperRegistry.setDeprecatedByAddress(swappers[2], true);
      });
      then('returns array with correct swappers', async () => {
        expect(await swapperRegistry.deprecatedSwappers()).to.eql(swappers);
      });
    });
    when('some swappers are active', () => {
      let swappers: string[];
      let deprecatedSwappers: string[];
      given(async () => {
        swappers = [await wallet.generateRandomAddress(), await wallet.generateRandomAddress(), await wallet.generateRandomAddress()];
        await swapperRegistry.addSwappersToSwappers(swappers);
        await swapperRegistry.setDeprecatedByAddress(swappers[0], true);
        await swapperRegistry.setDeprecatedByAddress(swappers[1], true);
        await swapperRegistry.setDeprecatedByAddress(swappers[2], false);
        deprecatedSwappers = await swapperRegistry.deprecatedSwappers();
      });
      then('array has same length as total swappers', () => {
        expect(deprecatedSwappers).to.be.length(swappers.length);
      });
      then('returns only deprecated swappers', () => {
        expect(deprecatedSwappers).to.include.members([swappers[0], swappers[1]]);
      });
      then('rest of array is zero address', () => {
        expect(deprecatedSwappers).to.include.members([constants.ZERO_ADDRESS]);
      });
    });
  });

  describe('isSwapper(address)', () => {
    when('is not a swapper', () => {
      then('returns false', async () => {
        expect(await swapperRegistry['isSwapper(address)'](await wallet.generateRandomAddress())).to.be.false;
      });
    });
    when('is a swapper', () => {
      let swapper: string;
      given(async () => {
        swapper = await wallet.generateRandomAddress();
        await swapperRegistry.addSwappersToSwappers([swapper]);
      });
      then('returns true', async () => {
        expect(await swapperRegistry['isSwapper(address)'](swapper)).to.be.true;
      });
    });
  });

  describe('isSwapper(string)', () => {
    let swapper: string;
    let isSwapper: boolean;
    let swapperAddress: string;
    let initialization: BigNumber;
    when('is not a swapper', () => {
      given(async () => {
        swapper = await wallet.generateRandomAddress();
        [isSwapper, swapperAddress, initialization] = await swapperRegistry['isSwapper(string)'](swapper);
      });
      then('returns false', () => {
        expect(isSwapper).to.be.false;
      });
      then('returns swapper address as zero', () => {
        expect(swapperAddress).to.be.equal(constants.ZERO_ADDRESS);
      });
      then('returns initialization as zero', () => {
        expect(initialization).to.be.equal(constants.ZERO);
      });
    });
    when('is a swapper', () => {
      let initializedAt = BigNumber.from(moment().unix());
      given(async () => {
        const swapperName = 'swapper-name';
        swapper = await wallet.generateRandomAddress();
        await swapperRegistry.addSwapperByName(swapperName, swapper);
        await swapperRegistry.addSwappersToSwappers([swapper]);
        await swapperRegistry.addInitializationByAddress(swapper, initializedAt);
        [isSwapper, swapperAddress, initialization] = await swapperRegistry['isSwapper(string)'](swapperName);
      });
      then('returns true', async () => {
        expect(isSwapper).to.be.true;
      });
      then('returns correct swapper address', async () => {
        expect(swapperAddress).to.be.equal(swapper);
      });
      then('returns correct initialization', async () => {
        expect(initialization).to.be.equal(initializedAt);
      });
    });
  });

  describe('addSwapper', () => {
    // only governor
  });

  describe('_addSwapper', () => {
    when('adding swapper with empty name', () => {
      let addSwapperTx: Promise<TransactionResponse>;
      given(async () => {
        addSwapperTx = swapperRegistry.addSwapperInternal('', await wallet.generateRandomAddress());
      });
      then('tx is reverted with reason', async () => {
        await expect(addSwapperTx).to.be.revertedWith('SwapperRegistry: empty name');
      });
    });
    when('adding swapper with zero address', () => {
      let addSwapperTx: Promise<TransactionResponse>;
      given(async () => {
        addSwapperTx = swapperRegistry.addSwapperInternal('swapper-name', constants.ZERO_ADDRESS);
      });
      then('tx is reverted with reason', async () => {
        await expect(addSwapperTx).to.be.revertedWith('SwapperRegistry: zero address');
      });
    });
    when('swapper was already added', () => {
      let swapper: string;
      let addSwapperTx: Promise<TransactionResponse>;
      given(async () => {
        swapper = await wallet.generateRandomAddress();
        await swapperRegistry.addSwappersToSwappers([swapper]);
        addSwapperTx = swapperRegistry.addSwapperInternal('swapper-name', swapper);
      });
      then('tx is reverted with reason', async () => {
        await expect(addSwapperTx).to.be.revertedWith('SwapperRegistry: swapper already added');
      });
    });
    when('swapper name was already taken', () => {
      let swapper: string;
      let addSwapperTx: Promise<TransactionResponse>;
      given(async () => {
        const swapperName = 'swapper-name';
        swapper = await wallet.generateRandomAddress();
        await swapperRegistry.addSwapperByName(swapperName, swapper);
        addSwapperTx = swapperRegistry.addSwapperInternal(swapperName, swapper);
      });
      then('tx is reverted with reason', async () => {
        await expect(addSwapperTx).to.be.revertedWith('SwapperRegistry: name taken');
      });
    });
    when('adding valid swapper', () => {
      let swapper: string;
      let addSwapperTx: TransactionResponse;
      let initializedAt: number;
      const swapperName = 'swapper-name';
      given(async () => {
        swapper = await wallet.generateRandomAddress();
        initializedAt = moment().unix();
        addSwapperTx = await swapperRegistry.addSwapperInternal(swapperName, swapper);
      });
      then('name gets related with address', async () => {
        expect(await swapperRegistry.swapperByName(swapperName)).to.equal(swapper);
      });
      then('address gets related with name', async () => {
        expect(await swapperRegistry.nameByAddress(swapper)).to.equal(swapperName);
      });
      then('initialization is set', async () => {
        expect(await swapperRegistry.initializationByAddress(swapper)).to.be.gte(initializedAt);
      });
      then('gets added to swappers', async () => {
        expect(await swapperRegistry['isSwapper(address)'](swapper)).to.be.true;
      });
      then('deprecated is false', async () => {
        expect(await swapperRegistry.deprecatedByAddress(swapper)).to.be.false;
      });
      then('emits event with correct information', async () => {
        await expect(addSwapperTx).to.emit(swapperRegistry, 'SwapperAdded').withArgs(swapper, swapperName);
      });
    });
  });

  describe('deprecateSwapper', () => {
    // only governor
  });

  describe('_deprecateSwapper', () => {
    when('swapper was not in registry', () => {
      let deprecateSwapperTx: Promise<TransactionResponse>;
      given(async () => {
        deprecateSwapperTx = swapperRegistry.deprecateSwapperInternal(await wallet.generateRandomAddress());
      });
      then('tx is reverted with reason', async () => {
        await expect(deprecateSwapperTx).to.be.revertedWith('SwapperRegistry: swapper not added');
      });
    });
    when('swapper was in registry', () => {
      let swapper: string;
      let deprecateSwapperTx: TransactionResponse;
      given(async () => {
        swapper = await wallet.generateRandomAddress();
        await swapperRegistry.addSwappersToSwappers([swapper]);
        deprecateSwapperTx = await swapperRegistry.deprecateSwapperInternal(swapper);
      });
      then('sets deprecated to true', async () => {
        expect(await swapperRegistry.deprecatedByAddress(swapper)).to.be.true;
      });
      then('emits event with correct information', async () => {
        await expect(deprecateSwapperTx).to.emit(swapperRegistry, 'SwapperDeprecated').withArgs(swapper);
      });
    });
  });

  describe('sendDust', () => {
    // only governor
  });
});
