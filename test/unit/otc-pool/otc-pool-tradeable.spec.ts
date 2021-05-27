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
import { expectNoEventWithName } from '../../utils/event-utils';

contract('OTCPoolTradeable', () => {
  let randomGuy: SignerWithAddress;
  let OTCProvider: SignerWithAddress;
  let OTCPoolTradeableFactory: ContractFactory;
  let OTCPoolTradeable: Contract;
  let swapperRegistryFactory: ContractFactory;
  let swapperRegistry: Contract;
  let otcSwapperFactory: ContractFactory;

  before(async () => {
    [randomGuy, OTCProvider] = await ethers.getSigners();
    OTCPoolTradeableFactory = await ethers.getContractFactory('contracts/mock/OTCPool/OTCPoolTradeable.sol:OTCPoolTradeableMock');
    swapperRegistryFactory = await ethers.getContractFactory('contracts/mock/SwapperRegistry.sol:SwapperRegistryMock');
    otcSwapperFactory = await ethers.getContractFactory('contracts/mock/StaticOTCSwapper.sol:StaticOTCSwapper');
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
      let token: Contract;
      let claimTx: TransactionResponse;
      const available = utils.parseEther('100');
      const toClaim = utils.parseEther('12.25334');
      given(async () => {
        token = await erc20.deploy({
          initialAccount: OTCPoolTradeable.address,
          initialAmount: available,
          name: 'token',
          symbol: 'TK',
        });
        await OTCPoolTradeable.setSwappedAvailable(token.address, available);
        claimTx = await OTCPoolTradeable.claim(token.address, toClaim);
      });
      then('swapped available of token is reduced', async () => {
        expect(await OTCPoolTradeable.swappedAvailable(token.address)).to.equal(available.sub(toClaim));
      });
      then('funds are taken from otc pool', async () => {
        expect(await token.balanceOf(OTCPoolTradeable.address)).to.equal(available.sub(toClaim));
      });
      then('funds are sent to receiver', async () => {
        expect(await token.balanceOf(randomGuy.address)).to.equal(toClaim);
      });
      then('event is emitted', async () => {
        await expect(claimTx).to.emit(OTCPoolTradeable, 'Claimed').withArgs(randomGuy.address, token.address, toClaim);
      });
    });
  });

  const getMaxTakeableFromPoolAndSwapperTest = async ({
    title,
    availableOnPool,
    maxWantedFromOffered,
    swapperTokenBAmountOut,
  }: {
    title: string;
    availableOnPool: BigNumber | number | string;
    maxWantedFromOffered: BigNumber | number | string;
    swapperTokenBAmountOut: BigNumber | number | string;
  }) => {
    let otcSwapper: Contract;
    let wantedFromSwapper: string;
    let offeredFromSwapper: string;
    given(async () => {
      otcSwapper = await otcSwapperFactory.deploy();
      wantedFromSwapper = await wallet.generateRandomAddress();
      offeredFromSwapper = await wallet.generateRandomAddress();
    });
    when(title, () => {
      let tookFromPool: BigNumber;
      let tookFromSwapper: BigNumber;
      given(async () => {
        await otcSwapper.setTotalAmountOut(offeredFromSwapper, maxWantedFromOffered);
        await otcSwapper.setTotalAmountOut(wantedFromSwapper, swapperTokenBAmountOut);
        await OTCPoolTradeable.setAvailableFor(wantedFromSwapper, offeredFromSwapper, availableOnPool);
        [tookFromPool, tookFromSwapper] = await OTCPoolTradeable.getMaxTakeableFromPoolAndSwapper(
          otcSwapper.address,
          offeredFromSwapper,
          wantedFromSwapper,
          0 // it's zero since swapper.getTotalAmountOut is mocked to return static value
        );
      });
      // then('swapper is called to calculate max wanted offer with correct information');
      // then('swapper is called to calculate how much should be taken from the swapper correctly');
      then('took from pool returns correct value', () => {
        expect(tookFromPool).to.equal(maxWantedFromOffered <= availableOnPool ? maxWantedFromOffered : availableOnPool);
      });
      then('took from swapper returns correct value', () => {
        expect(tookFromSwapper).to.equal(swapperTokenBAmountOut);
      });
    });
  };

  describe('getMaxTakeableFromPoolAndSwapper', () => {
    getMaxTakeableFromPoolAndSwapperTest({
      title: 'when there is nothing available on pool',
      availableOnPool: 0,
      maxWantedFromOffered: 10,
      swapperTokenBAmountOut: 149,
    });
    getMaxTakeableFromPoolAndSwapperTest({
      title: 'offered converted to wanted is less than available',
      availableOnPool: 100,
      maxWantedFromOffered: 10,
      swapperTokenBAmountOut: 99,
    });
    getMaxTakeableFromPoolAndSwapperTest({
      title: 'offered converted to wanted is more than available',
      availableOnPool: 10,
      maxWantedFromOffered: 50,
      swapperTokenBAmountOut: 99,
    });
  });

  const takeOfferTest = ({
    title,
    offeredByOTCProvider,
    wantedByOTCProvider,
    amountOfferedByOTCProvider,
    tookFromPool,
    tookFromSwapper,
  }: {
    title: string;
    offeredByOTCProvider: () => Contract;
    wantedByOTCProvider: () => Contract;
    amountOfferedByOTCProvider: BigNumber;
    tookFromPool: BigNumber;
    tookFromSwapper: BigNumber;
  }) => {
    let takeOfferTx: TransactionResponse;
    let initialBalanceOfSwapper: BigNumber;
    let initialBalanceOfOTCPool: BigNumber;
    const wantedBySwapper = offeredByOTCProvider;
    const offeredBySwapper = wantedByOTCProvider;
    when(title, () => {
      given(async () => {
        await offeredByOTCProvider().mint(OTCPoolTradeable.address, amountOfferedByOTCProvider);
        await OTCPoolTradeable.setAvailableFor(offeredByOTCProvider().address, wantedByOTCProvider().address, amountOfferedByOTCProvider);
        await offeredBySwapper().mint(randomGuy.address, tookFromSwapper);
        await OTCPoolTradeable.mockGetMaxTakeableFromPoolAndSwapper(tookFromPool, tookFromSwapper);
        initialBalanceOfOTCPool = await offeredByOTCProvider().balanceOf(OTCPoolTradeable.address);
        initialBalanceOfSwapper = await offeredBySwapper().balanceOf(randomGuy.address);
        await offeredBySwapper().approve(OTCPoolTradeable.address, tookFromSwapper);
        takeOfferTx = await OTCPoolTradeable.takeOffer(
          offeredBySwapper().address,
          wantedBySwapper().address,
          0 // its not used, since getMaxTakeable is mocked
        );
      });
      then('max tokens offered to be taken by otc pool are taken from swapper', async () => {
        expect(await offeredBySwapper().balanceOf(randomGuy.address)).to.equal(initialBalanceOfSwapper.sub(tookFromSwapper));
      });
      then('max tokens offered to be taken by otc pool are sent to pool', async () => {
        expect(await offeredBySwapper().balanceOf(OTCPoolTradeable.address)).to.equal(tookFromSwapper);
      });
      then('max tokens to be taken from pool are taken from pool', async () => {
        expect(await offeredByOTCProvider().balanceOf(OTCPoolTradeable.address)).to.equal(initialBalanceOfOTCPool.sub(tookFromPool));
      });
      then('max tokens to be taken from pool are taken sent to swapper', async () => {
        expect(await offeredByOTCProvider().balanceOf(randomGuy.address)).to.equal(tookFromPool);
      });
      then('amount of available for that swap is reduced by the max possible amount', async () => {
        expect(await OTCPoolTradeable.availableFor(offeredByOTCProvider().address, wantedByOTCProvider().address)).to.equal(
          amountOfferedByOTCProvider.sub(tookFromPool)
        );
      });
      then('amount available to claim by otc provider of wanted token is augmented', async () => {
        expect(await OTCPoolTradeable.swappedAvailable(wantedByOTCProvider().address)).to.equal(tookFromSwapper);
      });
      then('event is emitted', async () => {
        await expect(takeOfferTx)
          .to.emit(OTCPoolTradeable, 'TradePerformed')
          .withArgs(randomGuy.address, offeredBySwapper().address, wantedBySwapper().address, tookFromPool, tookFromSwapper);
      });
    });
  };

  describe('takeOffer', () => {
    let token0: Contract;
    let token1: Contract;
    given(async () => {
      token0 = await erc20.deploy({
        symbol: 'T0',
        name: 'T0',
        initialAccount: await wallet.generateRandomAddress(),
        initialAmount: utils.parseEther('0'),
      });
      token1 = await erc20.deploy({
        symbol: 'T1',
        name: 'T1',
        initialAccount: await wallet.generateRandomAddress(),
        initialAmount: utils.parseEther('0'),
      });
    });
    when('there is no amount available for offered <-> wanted', () => {
      const offeredByOTC = () => token0;
      const wantedByOTC = () => token1;
      const amountOfferedByOTC = utils.parseEther('1942');
      const offeredBySwapper = () => token1;
      const wantedBySwapper = wallet.generateRandomAddress();
      const amountOfferedBySwapper = utils.parseEther('9350');
      let takeOfferTx: TransactionResponse;
      given(async () => {
        await offeredByOTC().mint(OTCPoolTradeable.address, amountOfferedByOTC);
        await offeredBySwapper().mint(randomGuy.address, amountOfferedBySwapper);
        await OTCPoolTradeable.setAvailableFor(offeredByOTC().address, wantedByOTC().address, amountOfferedByOTC);
        takeOfferTx = await OTCPoolTradeable.takeOffer(offeredBySwapper().address, wantedBySwapper, amountOfferedBySwapper);
      });
      then('no tokens are taken from swapper', async () => {
        expect(await offeredBySwapper().balanceOf(randomGuy.address)).to.equal(amountOfferedBySwapper);
      });
      then('no tokens are taken from otc pool', async () => {
        expect(await offeredByOTC().balanceOf(OTCPoolTradeable.address)).to.equal(amountOfferedByOTC);
      });
      then('amount to claim did not change', async () => {
        expect(await offeredByOTC().balanceOf(OTCPoolTradeable.address)).to.equal(amountOfferedByOTC);
      });
      then('event is not emitted', async () => {
        await expectNoEventWithName(takeOfferTx, 'TradePerformed');
      });
    });
    takeOfferTest({
      title: 'max takeable from pool is not all available ',
      offeredByOTCProvider: () => token0,
      wantedByOTCProvider: () => token1,
      amountOfferedByOTCProvider: utils.parseEther('100'),
      tookFromPool: BigNumber.from('5'),
      tookFromSwapper: BigNumber.from('10'),
    });

    takeOfferTest({
      title: 'max takeable from pool is all available',
      offeredByOTCProvider: () => token0,
      wantedByOTCProvider: () => token1,
      amountOfferedByOTCProvider: BigNumber.from('100'),
      tookFromPool: BigNumber.from('100'),
      tookFromSwapper: BigNumber.from('50'),
    });
  });
});
