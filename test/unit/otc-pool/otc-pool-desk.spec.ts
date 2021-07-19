import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { behaviours, constants, contracts, erc20, wallet } from '../../utils';
import { contract, given, then, when } from '../../utils/bdd';
import { utils } from 'ethers';
import { ModifiableContract, ModifiableContractFactory, smoddit } from '@eth-optimism/smock';

contract('OTCPoolDesk', () => {
  let OTCProvider: SignerWithAddress;
  let OTCPoolDeskFactory: ModifiableContractFactory;
  let OTCPoolDesk: ModifiableContract;

  before(async () => {
    [OTCProvider] = await ethers.getSigners();
    OTCPoolDeskFactory = await smoddit('contracts/mock/OTCPool/OTCPoolDesk.sol:OTCPoolDeskMock');
  });

  beforeEach(async () => {
    OTCPoolDesk = await OTCPoolDeskFactory.deploy(OTCProvider.address);
  });

  describe('constructor', () => {
    when('otc provider is zero address', () => {
      then('tx is reverted with reason', async () => {
        await behaviours.deployShouldRevertWithZeroAddress({
          contract: OTCPoolDeskFactory,
          args: [constants.ZERO_ADDRESS],
        });
      });
    });
    when('otc provider is valid', () => {
      let deployedContract: Contract;
      given(async () => {
        const deployment = await contracts.deploy(OTCPoolDeskFactory, [OTCProvider.address]);
        deployedContract = deployment.contract;
      });
      then('sets otc provider correctly', async () => {
        expect(await deployedContract.OTCProvider()).to.equal(OTCProvider.address);
      });
    });
  });

  describe('onlyOTCProvider', () => {
    when('not being called from otc provider', () => {
      then('tx is reverted with reason');
    });
    when('being called from otc provider', () => {
      then('tx is not reverted');
    });
  });

  describe('deposit', () => {
    // TODO: Only OTCProvider
    when('offered token from pool is zero address', () => {
      let depositTx: Promise<TransactionResponse>;
      given(async () => {
        depositTx = OTCPoolDesk.deposit(constants.ZERO_ADDRESS, await wallet.generateRandomAddress(), 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(depositTx).to.be.revertedWith('OTCPool: tokens should not be zero');
      });
    });
    when('wanted token from pool is zero address', () => {
      let depositTx: Promise<TransactionResponse>;
      given(async () => {
        depositTx = OTCPoolDesk.deposit(await wallet.generateRandomAddress(), constants.ZERO_ADDRESS, 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(depositTx).to.be.revertedWith('OTCPool: tokens should not be zero');
      });
    });
    when('amount being offered is zero', () => {
      let depositTx: Promise<TransactionResponse>;
      given(async () => {
        depositTx = OTCPoolDesk.deposit(await wallet.generateRandomAddress(), await wallet.generateRandomAddress(), 0);
      });
      then('tx is reverted with reason', async () => {
        await expect(depositTx).to.be.revertedWith('OTCPool: should provide more than zero');
      });
    });
    when('all parameters are valid', () => {
      let offeredTokenToPool: Contract;
      let wantedTokenFromPool: string;
      let depositTx: TransactionResponse;
      const initialBalance = utils.parseEther('19493');
      const amountOffered = utils.parseEther('1.1245');
      given(async () => {
        wantedTokenFromPool = await wallet.generateRandomAddress();
        offeredTokenToPool = await erc20.deploy({
          name: 'Offered Token',
          symbol: 'OT',
          initialAmount: initialBalance,
          initialAccount: OTCProvider.address,
        });
        await offeredTokenToPool.approve(OTCPoolDesk.address, amountOffered);
        depositTx = await OTCPoolDesk.deposit(offeredTokenToPool.address, wantedTokenFromPool, amountOffered);
      });
      then('funds are taken from depositor', async () => {
        expect(await offeredTokenToPool.balanceOf(OTCProvider.address)).to.equal(initialBalance.sub(amountOffered));
      });
      then('funds are sent to otc pool', async () => {
        expect(await offeredTokenToPool.balanceOf(OTCPoolDesk.address)).to.equal(amountOffered);
      });
      then('amount is added as available to trade for offered <-> wanted', async () => {
        expect(await OTCPoolDesk.availableFor(offeredTokenToPool.address, wantedTokenFromPool)).to.equal(amountOffered);
      });
      then('increases amount of token under management', async () => {
        expect(await OTCPoolDesk.tokensUnderManagement(offeredTokenToPool.address)).to.equal(amountOffered);
      });
      then('event is emitted', async () => {
        await expect(depositTx)
          .to.emit(OTCPoolDesk, 'Deposited')
          .withArgs(OTCProvider.address, offeredTokenToPool.address, wantedTokenFromPool, amountOffered);
      });
    });
  });

  describe('withdraw', () => {
    // TODO: Only OTCProvider
    when('offered token from pool is zero address', () => {
      let withdrawTx: Promise<TransactionResponse>;
      given(async () => {
        withdrawTx = OTCPoolDesk.withdraw(constants.ZERO_ADDRESS, await wallet.generateRandomAddress(), 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(withdrawTx).to.be.revertedWith('OTCPool: tokens should not be zero');
      });
    });
    when('wanted token from pool is zero address', () => {
      let withdrawTx: Promise<TransactionResponse>;
      given(async () => {
        withdrawTx = OTCPoolDesk.withdraw(await wallet.generateRandomAddress(), constants.ZERO_ADDRESS, 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(withdrawTx).to.be.revertedWith('OTCPool: tokens should not be zero');
      });
    });
    when('amount being withdrawn is zero', () => {
      let withdrawTx: Promise<TransactionResponse>;
      given(async () => {
        withdrawTx = OTCPoolDesk.withdraw(await wallet.generateRandomAddress(), await wallet.generateRandomAddress(), 0);
      });
      then('tx is reverted with reason', async () => {
        await expect(withdrawTx).to.be.revertedWith('OTCPool: should withdraw more than zero');
      });
    });
    when('amount being withdrawn is bigger than offered for trade', () => {
      let withdrawTx: Promise<TransactionResponse>;
      given(async () => {
        withdrawTx = OTCPoolDesk.withdraw(await wallet.generateRandomAddress(), await wallet.generateRandomAddress(), 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(withdrawTx).to.be.revertedWith('OTCPool: not enough provided');
      });
    });
    when('all parameters are valid', () => {
      let offeredTokenToPool: Contract;
      let wantedTokenFromPool: string;
      let withdrawTx: TransactionResponse;
      const available = utils.parseEther('1.1245');
      const toWithdraw = utils.parseEther('0.324');
      given(async () => {
        wantedTokenFromPool = await wallet.generateRandomAddress();
        offeredTokenToPool = await erc20.deploy({
          name: 'Offered Token',
          symbol: 'OT',
          initialAmount: available,
          initialAccount: OTCPoolDesk.address,
        });
        await OTCPoolDesk.setAvailableFor(offeredTokenToPool.address, wantedTokenFromPool, available);
        await OTCPoolDesk.smodify.put({
          _tokensUnderManagement: {
            [offeredTokenToPool.address]: available.toString(),
          },
        });
        withdrawTx = await OTCPoolDesk.withdraw(offeredTokenToPool.address, wantedTokenFromPool, toWithdraw);
      });
      then('amount is subtracted from trade for offered <-> wanted', async () => {
        expect(await OTCPoolDesk.availableFor(offeredTokenToPool.address, wantedTokenFromPool)).to.equal(available.sub(toWithdraw));
      });
      then('funds are taken from pool', async () => {
        expect(await offeredTokenToPool.balanceOf(OTCPoolDesk.address)).to.equal(available.sub(toWithdraw));
      });
      then('funds are sent to receiver', async () => {
        expect(await offeredTokenToPool.balanceOf(OTCProvider.address)).to.equal(toWithdraw);
      });
      then('reduces amount of token under management', async () => {
        expect(await OTCPoolDesk.tokensUnderManagement(offeredTokenToPool.address)).to.equal(available.sub(toWithdraw));
      });
      then('event is emitted', async () => {
        await expect(withdrawTx)
          .to.emit(OTCPoolDesk, 'Withdrew')
          .withArgs(OTCProvider.address, offeredTokenToPool.address, wantedTokenFromPool, toWithdraw);
      });
    });
  });
});
