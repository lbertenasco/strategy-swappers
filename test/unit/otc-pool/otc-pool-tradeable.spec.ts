import { Contract } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { abi as OTCSwapperABI } from '../../../artifacts/contracts/OTCSwapper.sol/IOTCSwapper.json';
import { abi as tradeFactoryABI } from '../../../artifacts/contracts/TradeFactory/TradeFactory.sol/TradeFactory.json';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { behaviours, bn, constants, contracts, erc20, wallet } from '../../utils';
import { contract, given, then, when } from '../../utils/bdd';
import { BigNumber } from '@ethersproject/bignumber';
import { utils, Wallet } from 'ethers';
import { expectNoEventWithName } from '../../utils/event-utils';
import { MockContract, ModifiableContract, ModifiableContractFactory, smockit, smoddit } from '@eth-optimism/smock';

contract('OTCPoolTradeable', () => {
  let OTCProvider: SignerWithAddress;
  let swapper: SignerWithAddress;
  let OTCPoolTradeableFactory: ModifiableContractFactory;
  let OTCPoolTradeable: ModifiableContract;
  let tradeFactory: MockContract;
  let otcSwapper: MockContract;

  before(async () => {
    [OTCProvider, swapper] = await ethers.getSigners();
    OTCPoolTradeableFactory = await smoddit('contracts/mock/OTCPool/OTCPoolTradeable.sol:OTCPoolTradeableMock');
  });

  beforeEach(async () => {
    otcSwapper = await smockit(OTCSwapperABI);
    tradeFactory = await smockit(tradeFactoryABI);
    OTCPoolTradeable = await OTCPoolTradeableFactory.deploy(OTCProvider.address, tradeFactory.address);
    tradeFactory.smocked['isSwapper(address)'].will.return.with(true);
  });

  describe('constructor', () => {
    when('tradeFactory is zero address', () => {
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
        const deployment = await contracts.deploy(OTCPoolTradeableFactory, [OTCProvider.address, tradeFactory.address]);
        deployedContract = deployment.contract;
      });
      then('tradeFactory is set', async () => {
        expect(await deployedContract.tradeFactory()).to.equal(tradeFactory.address);
      });
    });
  });

  describe('setTradeFactory', () => {
    // TODO: Only governor
    when('tradeFactory is zero address', () => {
      let setSwapperTx: Promise<TransactionResponse>;
      given(async () => {
        setSwapperTx = OTCPoolTradeable.setTradeFactory(constants.ZERO_ADDRESS);
      });
      then('tx is reverted with reason', async () => {
        await expect(setSwapperTx).to.be.revertedWith('OTCPool: zero address');
      });
    });
    when('tradeFactory is not zero address', () => {
      let setSwapperTx: TransactionResponse;
      given(async () => {
        setSwapperTx = OTCPoolTradeable.setTradeFactory(constants.NOT_ZERO_ADDRESS);
      });
      then('tradeFactory is set', async () => {
        expect(await OTCPoolTradeable.tradeFactory()).to.equal(constants.NOT_ZERO_ADDRESS);
      });
      then('event is emitted', async () => {
        await expect(setSwapperTx).to.emit(OTCPoolTradeable, 'TradeFactorySet').withArgs(constants.NOT_ZERO_ADDRESS);
      });
    });
  });

  describe('onlyRegisteredSwapper', () => {
    when('not being called registered swapper', () => {
      then('tx is reverted with reason');
    });
    when('being called registered swapper', () => {
      then('tradeFactory registry is consulted');
      then('tx is not reverted');
    });
  });

  describe('claim', () => {
    // TODO: Only OTC Provider
    when('token is zero address', () => {
      let claimTx: Promise<TransactionResponse>;
      given(async () => {
        claimTx = OTCPoolTradeable.claim(constants.ZERO_ADDRESS, 1);
      });
      then('tx is reverted with reason', async () => {
        await expect(claimTx).to.be.revertedWith('OTCPool: zero address');
      });
    });
    when('amount to claim is more than available', () => {
      let claimTx: Promise<TransactionResponse>;
      given(async () => {
        claimTx = OTCPoolTradeable.claim(constants.NOT_ZERO_ADDRESS, 1);
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
        await OTCPoolTradeable.smodify.put({
          _tokensUnderManagement: {
            [token.address]: available.toString(),
          },
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
        expect(await token.balanceOf(OTCProvider.address)).to.equal(toClaim);
      });
      then('event is emitted', async () => {
        await expect(claimTx).to.emit(OTCPoolTradeable, 'Claimed').withArgs(OTCProvider.address, token.address, toClaim);
      });
    });
  });

  const getMaxTakeableFromPoolAndSwapperTest = async ({
    title,
    availableOnPool,
    maxWantedFromOffered,
  }: {
    title: string;
    availableOnPool: BigNumber | number | string;
    maxWantedFromOffered: BigNumber | number | string;
  }) => {
    let wanted: string;
    let offered: string;
    given(async () => {
      wanted = wallet.generateRandomAddress();
      offered = wallet.generateRandomAddress();
    });
    when(title, () => {
      let tookFromPool: BigNumber;
      let tookFromSwapper: BigNumber;
      const offeredAmount = utils.parseEther(bn.random(1, 100).toString());
      const shouldTakeFromSwapper = utils.parseEther(bn.random(1, 100).toString());
      const shouldTakeFromPool = maxWantedFromOffered <= availableOnPool ? maxWantedFromOffered : availableOnPool;
      given(async () => {
        otcSwapper.smocked.getTotalAmountOut.will.return.with((tokenIn, tokenOut) => {
          if (tokenIn == offered && tokenOut == wanted) return maxWantedFromOffered;
          if (tokenIn == wanted && tokenOut == offered) return shouldTakeFromSwapper;
        });
        await OTCPoolTradeable.setAvailableFor(wanted, offered, availableOnPool);
        [tookFromPool, tookFromSwapper] = await OTCPoolTradeable.getMaxTakeableFromPoolAndSwapper(
          otcSwapper.address,
          offered,
          wanted,
          offeredAmount
        );
      });
      then('swapper is called to calculate max wanted offerered with correct information', () => {
        expect(otcSwapper.smocked.getTotalAmountOut.calls[0]).to.be.eql([offered, wanted, offeredAmount]);
      });
      then('swapper is called to calculate how much should be taken from the swapper correctly', () => {
        expect(otcSwapper.smocked.getTotalAmountOut.calls[1]).to.be.eql([wanted, offered, bn.toBN(shouldTakeFromPool)]);
      });
      then('took from pool returns correct value', () => {
        expect(tookFromPool).to.equal(shouldTakeFromPool);
      });
      then('took from swapper returns correct value', () => {
        expect(tookFromSwapper).to.equal(shouldTakeFromSwapper);
      });
    });
  };

  describe('getMaxTakeableFromPoolAndSwapper', () => {
    getMaxTakeableFromPoolAndSwapperTest({
      title: 'when there is nothing available on pool',
      availableOnPool: 0,
      maxWantedFromOffered: 10,
    });
    getMaxTakeableFromPoolAndSwapperTest({
      title: 'offered converted to wanted is less than available',
      availableOnPool: 100,
      maxWantedFromOffered: 10,
    });
    getMaxTakeableFromPoolAndSwapperTest({
      title: 'offered converted to wanted is more than available',
      availableOnPool: 10,
      maxWantedFromOffered: 50,
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
        await OTCPoolTradeable.smodify.put({
          _tokensUnderManagement: {
            [offeredByOTCProvider().address]: amountOfferedByOTCProvider.toString(),
          },
        });
        await OTCPoolTradeable.setAvailableFor(offeredByOTCProvider().address, wantedByOTCProvider().address, amountOfferedByOTCProvider);
        await offeredBySwapper().mint(swapper.address, tookFromSwapper);
        await offeredBySwapper().connect(swapper).approve(OTCPoolTradeable.address, tookFromSwapper);
        await OTCPoolTradeable.mockGetMaxTakeableFromPoolAndSwapper(tookFromPool, tookFromSwapper);
        initialBalanceOfOTCPool = await offeredByOTCProvider().balanceOf(OTCPoolTradeable.address);
        initialBalanceOfSwapper = await offeredBySwapper().balanceOf(swapper.address);
        await offeredBySwapper().approve(OTCPoolTradeable.address, tookFromSwapper);
        takeOfferTx = await OTCPoolTradeable.connect(swapper).takeOffer(
          offeredBySwapper().address,
          wantedBySwapper().address,
          0 // its not used, since getMaxTakeable is mocked
        );
      });
      then('max tokens offered to be taken by otc pool are taken from swapper', async () => {
        expect(await offeredBySwapper().balanceOf(swapper.address)).to.equal(initialBalanceOfSwapper.sub(tookFromSwapper));
      });
      then('max tokens offered to be taken by otc pool are sent to pool', async () => {
        expect(await offeredBySwapper().balanceOf(OTCPoolTradeable.address)).to.equal(tookFromSwapper);
      });
      then('max tokens to be taken from pool are taken from pool', async () => {
        expect(await offeredByOTCProvider().balanceOf(OTCPoolTradeable.address)).to.equal(initialBalanceOfOTCPool.sub(tookFromPool));
      });
      then('max tokens to be taken from pool are taken sent to swapper', async () => {
        expect(await offeredByOTCProvider().balanceOf(swapper.address)).to.equal(tookFromPool);
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
          .withArgs(swapper.address, offeredBySwapper().address, wantedBySwapper().address, tookFromPool, tookFromSwapper);
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
        initialAccount: wallet.generateRandomAddress(),
        initialAmount: utils.parseEther('0'),
      });
      token1 = await erc20.deploy({
        symbol: 'T1',
        name: 'T1',
        initialAccount: wallet.generateRandomAddress(),
        initialAmount: utils.parseEther('0'),
      });
    });
    // TODO: Only registered swapper
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
        await offeredBySwapper().mint(swapper.address, amountOfferedBySwapper);
        await OTCPoolTradeable.setAvailableFor(offeredByOTC().address, wantedByOTC().address, amountOfferedByOTC);
        takeOfferTx = await OTCPoolTradeable.connect(swapper).takeOffer(offeredBySwapper().address, wantedBySwapper, amountOfferedBySwapper);
      });
      then('no tokens are taken from swapper', async () => {
        expect(await offeredBySwapper().balanceOf(swapper.address)).to.equal(amountOfferedBySwapper);
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
