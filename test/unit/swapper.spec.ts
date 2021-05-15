import moment from 'moment';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { behaviours, constants, wallet } from '../utils';
import { contract, given, then, when } from '../utils/bdd';
import { BigNumber } from '@ethersproject/bignumber';

contract.only('Swapper', () => {
  let governor: SignerWithAddress;
  let tradeFactory: SignerWithAddress;
  let swapperFactory: ContractFactory;
  let swapper: Contract;

  before(async () => {
    [governor, tradeFactory] = await ethers.getSigners();
    swapperFactory = await ethers.getContractFactory('contracts/mock/Swapper.sol:SwapperMock');
  });

  beforeEach(async () => {
    swapper = await swapperFactory.deploy(governor.address, tradeFactory.address);
  });

  describe('onlyTradeFactory', () => {
    behaviours.shouldBeExecutableOnlyByTradeFactory({
      contract: () => swapper,
      funcAndSignature: 'modifierOnlyTradeFactory()',
      params: [],
      tradeFactory: () => tradeFactory,
    });
  });

  describe('assertPreSwap', () => {
    behaviours.shouldBeCheckPreAssetSwap({
      contract: () => swapper,
      funcAndSignature: 'assertPreSwap',
    });
  });

  describe('swap', () => {
    behaviours.shouldBeCheckPreAssetSwap({
      contract: () => swapper,
      funcAndSignature: 'swap',
    });
    behaviours.shouldBeExecutableOnlyByTradeFactory({
      contract: () => swapper,
      funcAndSignature: 'swap(address,address,address,uint256,uint256)',
      params: [constants.ZERO_ADDRESS, constants.ZERO_ADDRESS, constants.ZERO_ADDRESS, constants.ZERO, constants.ZERO],
      tradeFactory: () => tradeFactory,
    });
    when('everything is valid', () => {
      then('takes tokens from caller');
      then('executes internal swap');
      then('emits event with correct information');
    });
  });

  describe('sendDust', () => {
    // only governor
  });
});
