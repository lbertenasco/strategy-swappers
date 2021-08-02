import { expect } from 'chai';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { JsonRpcSigner } from '@ethersproject/providers';
import { Contract, utils, Wallet } from 'ethers';
import { deployments, ethers, getNamedAccounts } from 'hardhat';
import { contracts, evm, wallet } from '../../utils';
import { then, when } from '../../utils/bdd';
import moment from 'moment';
import { setTestChainId } from '../../../utils/deploy';
import { getNodeUrl } from '../../../utils/network';
import zrx, { QuoteResponse } from '../../../scripts/libraries/zrx';

describe('ZRXSwapper', function () {
  let governor: JsonRpcSigner;
  let crvWhale: JsonRpcSigner;
  let yMech: JsonRpcSigner;
  let strategy: Wallet;

  let tradeFactory: Contract;
  let ZRXSwapper: Contract;

  const MAX_SLIPPAGE = 10_000; // 1%

  context('on mainnet', () => {
    const CHAIN_ID = 1;

    const CRV_ADDRESS = '0xD533a949740bb3306d119CC777fa900bA034cd52';
    const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

    const CRV_WHALE_ADDRESS = '0xd2d43555134dc575bf7279f4ba18809645db0f1d';
    const DAI_WHALE_ADDRESS = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643';

    let CRV: Contract;
    let DAI: Contract;

    const AMOUNT_IN = utils.parseEther('10000');
    let zrxAPIResponse: QuoteResponse;
    let forkBlockNumber: number;

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('mainnet'),
      });

      // We get information for trade first, 1inch API starts returning non-valid data

      zrxAPIResponse = await zrx.quote({
        chainId: CHAIN_ID,
        sellToken: CRV_ADDRESS,
        buyToken: DAI_ADDRESS,
        sellAmount: AMOUNT_IN,
        sippagePercentage: 0.1,
      });

      forkBlockNumber = await ethers.provider.getBlockNumber();
    });

    beforeEach(async () => {
      await evm.reset({
        jsonRpcUrl: getNodeUrl('mainnet'),
        blockNumber: forkBlockNumber,
      });

      const namedAccounts = await getNamedAccounts();

      governor = await wallet.impersonate(namedAccounts.governor);
      crvWhale = await wallet.impersonate(CRV_WHALE_ADDRESS);
      yMech = await wallet.impersonate(namedAccounts.yMech);

      await setTestChainId(CHAIN_ID);
      await deployments.fixture('ZRXSwapper');

      CRV = await ethers.getContractAt(IERC20_ABI, CRV_ADDRESS);
      DAI = await ethers.getContractAt(IERC20_ABI, DAI_ADDRESS);

      tradeFactory = await ethers.getContract('TradeFactory');
      ZRXSwapper = await ethers.getContract('ZRXSwapper');

      await CRV.connect(crvWhale).transfer(strategy.address, AMOUNT_IN, {
        gasPrice: 0,
      });

      await tradeFactory.connect(governor).grantRole(await tradeFactory.STRATEGY(), strategy.address, { gasPrice: 0 });
      await tradeFactory.connect(governor).setStrategySwapper(strategy.address, ZRXSwapper.address, false);

      await CRV.connect(strategy).approve(tradeFactory.address, AMOUNT_IN, { gasPrice: 0 });
      await tradeFactory
        .connect(strategy)
        .create(CRV_ADDRESS, DAI_ADDRESS, AMOUNT_IN, MAX_SLIPPAGE, moment().add('30', 'minutes').unix(), { gasPrice: 0 });
    });

    describe('swap', () => {
      beforeEach(async () => {
        await tradeFactory.connect(yMech).execute(1, zrxAPIResponse.data, {
          gasPrice: 0,
        });
      });

      then('CRV gets taken from strategy', async () => {
        expect(await CRV.balanceOf(strategy.address)).to.equal(0);
      }).retries(5);

      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      }).retries(5);
    }).retries(5);
  });

  context('on polygon', () => {
    const CHAIN_ID = 137;

    const WMATIC_ADDRESS = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
    const DAI_ADDRESS = '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063';

    const WMATIC_WHALE_ADDRESS = '0xadbf1854e5883eb8aa7baf50705338739e558e5b';
    const DAI_WHALE_ADDRESS = '0x27f8d03b3a2196956ed754badc28d73be8830a6e';

    let WMATIC: Contract;
    let DAI: Contract;

    let wmaticWhale: JsonRpcSigner;

    const AMOUNT_IN = utils.parseEther('10000');
    let zrxAPIResponse: QuoteResponse;
    let forkBlockNumber: number;

    before(async () => {
      strategy = await wallet.generateRandom();

      await evm.reset({
        jsonRpcUrl: getNodeUrl('polygon'),
      });

      // We get information for trade first, 1inch API starts returning non-valid data

      zrxAPIResponse = await zrx.quote({
        chainId: CHAIN_ID,
        sellToken: WMATIC_ADDRESS,
        buyToken: DAI_ADDRESS,
        sellAmount: AMOUNT_IN,
        sippagePercentage: 0.1,
      });

      forkBlockNumber = await ethers.provider.getBlockNumber();
    });

    beforeEach(async () => {
      await evm.reset({
        jsonRpcUrl: getNodeUrl('polygon'),
        blockNumber: forkBlockNumber,
      });

      const namedAccounts = await getNamedAccounts();

      governor = await wallet.impersonate(namedAccounts.governor);
      wmaticWhale = await wallet.impersonate(WMATIC_WHALE_ADDRESS);
      yMech = await wallet.impersonate(namedAccounts.yMech);

      setTestChainId(CHAIN_ID);
      await deployments.fixture('ZRXSwapper');

      WMATIC = await ethers.getContractAt(IERC20_ABI, WMATIC_ADDRESS);
      DAI = await ethers.getContractAt(IERC20_ABI, DAI_ADDRESS);

      tradeFactory = await ethers.getContract('TradeFactory');
      ZRXSwapper = await ethers.getContract('ZRXSwapper');

      await WMATIC.connect(wmaticWhale).transfer(strategy.address, AMOUNT_IN, {
        gasPrice: 0,
      });

      await tradeFactory.connect(governor).grantRole(await tradeFactory.STRATEGY(), strategy.address, { gasPrice: 0 });
      await tradeFactory.connect(governor).setStrategySwapper(strategy.address, ZRXSwapper.address, false);

      await WMATIC.connect(strategy).approve(tradeFactory.address, AMOUNT_IN, { gasPrice: 0 });

      await tradeFactory.connect(strategy).create(WMATIC_ADDRESS, DAI_ADDRESS, AMOUNT_IN, MAX_SLIPPAGE, moment().add('30', 'minutes').unix(), {
        gasPrice: 0,
      });
    });

    describe('swap', () => {
      beforeEach(async () => {
        await tradeFactory.connect(yMech).execute(1, zrxAPIResponse.data, {
          gasPrice: 0,
        });
      });

      then('WMATIC gets taken from strategy and DAI gets airdropped to strategy', async () => {
        expect(await WMATIC.balanceOf(strategy.address)).to.equal(0);
      }).retries(5);

      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      }).retries(5);
    }).retries(5);
  });
});
