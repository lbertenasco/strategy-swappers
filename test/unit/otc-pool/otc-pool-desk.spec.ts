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

contract.only('OTCPoolDesk', () => {
  let OTCProvider: SignerWithAddress;
  let OTCPoolDeskFactory: ContractFactory;
  let OTCPoolDesk: Contract;

  before(async () => {
    [OTCProvider] = await ethers.getSigners();
    OTCPoolDeskFactory = await ethers.getContractFactory('contracts/mock/OTCPool/OTCPoolDesk.sol:OTCPoolDeskMock');
  });

  beforeEach(async () => {
    OTCPoolDesk = await OTCPoolDeskFactory.deploy(OTCProvider.address);
  });

  describe('constructor', () => {
    when('otc provider is zero address', () => {
      then('tx is reverted with reason');
    });
    when('otc provider is valid', () => {
      then('sets otc provider correctly');
    });
  });

  describe('onlyOTCProvider', () => {
    // behaves like only otc provider
  });

  describe('deposit', () => {
    when('depositor is zero address', () => {
      then('tx is reverted with reason');
    });
    when('offered token from pool is zero address', () => {
      then('tx is reverted with reason');
    });
    when('wanted token from pool is zero address', () => {
      then('tx is reverted with reason');
    });
    when('amount being offered is zero', () => {
      then('tx is reverted with reason');
    });
    when('all parameters are valid', () => {
      then('funds are taken from depositor');
      then('funds are sent to otc pool');
      then('amount is added as available to trade for offered <-> wanted');
      then('event is emitted');
    });
  });

  describe('withdraw', () => {
    when('receiver is zero address', () => {
      then('tx is reverted with reason');
    });
    when('offered token from pool is zero address', () => {
      then('tx is reverted with reason');
    });
    when('wanted token from pool is zero address', () => {
      then('tx is reverted with reason');
    });
    when('amount being withdrawn is zero', () => {
      then('tx is reverted with reason');
    });
    when('amount being withdrawn is bigger than offered for trade', () => {
      then('tx is reverted with reason');
    });
    when('all parameters are valid', () => {
      then('amount is subtracted from trade for offered <-> wanted');
      then('funds are taken from pool');
      then('funds are sent to receiver');
      then('event is emitted');
    });
  });
});
