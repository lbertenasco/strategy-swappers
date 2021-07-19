import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { behaviours, constants, contracts, erc20, wallet } from '../../utils';
import { contract, given, then, when } from '../../utils/bdd';
import { utils } from 'ethers';

contract('OTCPool', () => {
  let OTCProvider: SignerWithAddress;
  let governor: SignerWithAddress;
  let OTCPoolFactory: ContractFactory;
  let OTCPool: Contract;

  before(async () => {
    [OTCProvider, governor] = await ethers.getSigners();
    OTCPoolFactory = await ethers.getContractFactory('contracts/OTCPool/OTCPool.sol:OTCPool');
  });

  beforeEach(async () => {
    OTCPool = await OTCPoolFactory.deploy(governor.address, OTCProvider.address, wallet.generateRandomAddress());
  });

  describe('sendDust', () => {
    // TODO: Only governor
  });
});
