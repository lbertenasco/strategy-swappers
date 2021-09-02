import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { behaviours, constants, contracts, erc20, wallet } from '../utils';
import { contract, given, then, when } from '../utils/bdd';
import { BigNumber } from '@ethersproject/bignumber';
import { utils } from 'ethers';

contract('OTCPool', () => {
  let governor: SignerWithAddress;
  let tradeFactory: SignerWithAddress;
  let otcPoolFactory: ContractFactory;
  let otcPool: Contract;

  before(async () => {
    [governor, tradeFactory] = await ethers.getSigners();
    otcPoolFactory = await ethers.getContractFactory('contracts/OTCPool.sol:OTCPool');
  });

  beforeEach(async () => {
    otcPool = await otcPoolFactory.deploy(governor.address, tradeFactory.address);
  });

  describe('constructor', () => {
    when('trade factory is zero address', () => {
      then('tx is reverted with reason');
    });
    when('all arguments are valid', () => {
      then('governor is set correctly');
      then('trade factory is set correctly');
    });
  });

  describe('setTradeFactory', () => {
    // ONLY GOVERNOR
    when('trade factory is zero address', () => {
      then('tx is reverted with reason');
    });
    when('trade factory is valid address', () => {
      then('trade factory is set');
      then('emits event');
    });
  });

  describe('create', () => {
    // ONLY GOVERNOR
    when('trade factory is zero address', () => {
      then('tx is reverted with reason');
    });
    when('amount is zero', () => {
      then('tx is reverted with reason');
    });
    when('otc pool doesnt have allowance for offers', () => {
      then('tx is reverted with reason');
    });
    when('arguments are valid', () => {
      then('offer for that token gets increased');
      then('event is emitted');
    });
  });

  describe('take', () => {
    // ONLY TRADE FACTORY
    when('executed', () => {
      then('takes wanted token and amount from governor');
      then('wanted token and amount gets sent to receiver');
      then('offer for wanted token gets reduced');
      then('event is emitted');
    });
  });

  describe('sendDust', () => {
    // only governor
  });
});
