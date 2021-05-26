import moment from 'moment';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { behaviours, constants, contracts, erc20, wallet } from '../../utils';
import { contract, given, then, when } from '../../utils/bdd';
import { BigNumber } from '@ethersproject/bignumber';
import { utils } from 'ethers';

contract.only('OTCPoolTradeable', () => {
  let OTCProvider: SignerWithAddress;
  let OTCPoolTradeableFactory: ContractFactory;
  let OTCPoolTradeable: Contract;
  let swapperRegistryFactory: ContractFactory;
  let swapperRegistry: Contract;

  before(async () => {
    [OTCProvider] = await ethers.getSigners();
    OTCPoolTradeableFactory = await ethers.getContractFactory('contracts/mock/OTCPool/OTCPoolTradeable.sol:OTCPoolTradeableMock');
    swapperRegistryFactory = await ethers.getContractFactory('contracts/mock/SwapperRegistry.sol:SwapperRegistryMock');
  });

  beforeEach(async () => {
    swapperRegistry = await swapperRegistryFactory.deploy(await wallet.generateRandomAddress());
    OTCPoolTradeable = await OTCPoolTradeableFactory.deploy(OTCProvider.address, swapperRegistry.address);
  });

  describe('constructor', () => {
    when('swapper registry is zero address', () => {
      then('tx is reverted with reason', async () => {
        await behaviours.deployShouldRevertWithZeroAddress({
          contract: OTCPoolTradeableFactory,
          args: [constants.NOT_ZERO_ADDRESS, constants.ZERO_ADDRESS],
        });
      });
    });
    when('all parameters are valid', () => {
      let deployedContract: Contract;
      given(async () => {
        const deployment = await contracts.deploy(OTCPoolTradeableFactory, [OTCProvider.address, swapperRegistry.address]);
        deployedContract = deployment.contract;
      });
      then('swapper registry is set', async () => {
        expect(await deployedContract.swapperRegistry()).to.equal(swapperRegistry.address);
      });
    });
  });

  describe('setSwapperRegistry', () => {
    when('swapper registry is zero address', () => {
      let setSwapperTx: Promise<TransactionResponse>;
      given(async () => {
        setSwapperTx = OTCPoolTradeable.setSwapperRegistry(constants.ZERO_ADDRESS);
      });
      then('tx is reverted with reason', async () => {
        await expect(setSwapperTx).to.be.revertedWith('OTCPool: zero address');
      });
    });
    when('swapper registry is not zero address', () => {
      let setSwapperTx: TransactionResponse;
      given(async () => {
        setSwapperTx = OTCPoolTradeable.setSwapperRegistry(constants.NOT_ZERO_ADDRESS);
      });
      then('swapper registry is set', async () => {
        expect(await OTCPoolTradeable.swapperRegistry()).to.equal(constants.NOT_ZERO_ADDRESS);
      });
      then('event is emitted', async () => {
        await expect(setSwapperTx).to.emit(OTCPoolTradeable, 'SwapperRegistrySet').withArgs(constants.NOT_ZERO_ADDRESS);
      });
    });
  });

  describe('onlyRegisteredSwapper', () => {
    // behave like only registered swapper
  });

  describe('claim', () => {
    when('receiver is zero address', () => {
      let claimTx: Promise<TransactionResponse>;
      given(async () => {
        claimTx = OTCPoolTradeable.claimInternal(constants.ZERO_ADDRESS, constants.NOT_ZERO_ADDRESS, 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(claimTx).to.be.revertedWith('OTCPool: zero address');
      });
    });
    when('token is zero address', () => {
      let claimTx: Promise<TransactionResponse>;
      given(async () => {
        claimTx = OTCPoolTradeable.claimInternal(constants.NOT_ZERO_ADDRESS, constants.ZERO_ADDRESS, 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(claimTx).to.be.revertedWith('OTCPool: zero address');
      });
    });
    when('amount to claim is more than available', () => {
      let claimTx: Promise<TransactionResponse>;
      given(async () => {
        claimTx = OTCPoolTradeable.claimInternal(constants.NOT_ZERO_ADDRESS, constants.NOT_ZERO_ADDRESS, 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(claimTx).to.be.revertedWith('OTCPool: zero claim');
      });
    });
    when('parameters are valid', () => {
      then('swapped available of token is reduced');
      then('funds are taken from otc pool');
      then('funds are sent to receiver');
      then('event is emitted');
    });
  });

  describe('takeOffer', () => {
    when('there is no amount available for offered <-> wanted', () => {
      then('returns zero taken from pool');
      then('returns zero taken from swapper');
    });
  });
});
