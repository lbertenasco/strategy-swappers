import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { contract, given, then, when } from '../../utils/bdd';
import { smockit, MockContract } from '@eth-optimism/smock';

contract.only('TradeFactoryPositionsHandler', () => {
  let governance: SignerWithAddress;
  let swapperRegistryFactory: ContractFactory;
  let swapperRegistry: MockContract;
  let positionsHandlerFactory: ContractFactory;
  let positionsHandler: Contract;

  before(async () => {
    [governance] = await ethers.getSigners();
    positionsHandlerFactory = await ethers.getContractFactory(
      'contracts/mock/TradeFactory/TradeFactoryPositionsHandler.sol:TradeFactoryPositionsHandlerMock'
    );
    swapperRegistryFactory = await ethers.getContractFactory('contracts/mock/SwapperRegistry.sol:SwapperRegistryMock');
  });

  beforeEach(async () => {
    await swapperRegistryFactory.deploy(governance.address);
    swapperRegistry = await smockit(await swapperRegistryFactory.deploy(governance.address));
    positionsHandler = await positionsHandlerFactory.deploy(governance.address);
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
      then('returns empty array');
    });
    when('strategy has pending trades', () => {
      then('returns array of ids');
    });
  });

  describe('create', () => {
    when('swapper is not registered', () => {
      then('tx is reverted with reason');
    });
    when('swapper was initiated later than strategy safety checkpoint', () => {
      then('tx is reverted with reason');
    });
    when('owner is zero address', () => {
      then('tx is reverted with reason');
    });
    when('token in is zero address', () => {
      then('tx is reverted with reason');
    });
    when('token out is zero address', () => {
      then('tx is reverted with reason');
    });
    when('amount in is zero', () => {
      then('tx is reverted with reason');
    });
    when('max slippage is set to zero', () => {
      then('tx is reverted with reason');
    });
    when('deadline is equal or less than current timestamp', () => {
      then('tx is reverted with reason');
    });
    when('all data is correct', () => {
      then('trade gets added to pending trades');
      then('trade id gets added to pending trades by strategy');
      then('trade id gets added to pending trades ids');
      then('trade counter gets increased');
      then('emits event');
    });
  });

  describe('cancelPending', () => {
    when('pending trade does not exist', () => {
      then('tx is reverted with reason');
    });
    when('pending trade exists', () => {
      then('calls remove trade with correct values');
      then('emits event');
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
