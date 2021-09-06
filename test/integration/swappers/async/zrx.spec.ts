import { expect } from 'chai';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { JsonRpcSigner } from '@ethersproject/providers';
import { Contract, utils, Wallet } from 'ethers';
import { deployments, ethers, getNamedAccounts } from 'hardhat';
import { contracts, evm, wallet } from '../../../utils';
import { then, when } from '../../../utils/bdd';
import moment from 'moment';
import { setTestChainId } from '../../../../utils/deploy';
import { getNodeUrl } from '../../../../utils/network';
import zrx, { QuoteResponse } from '../../../../scripts/libraries/zrx';
import { STRATEGY_ADDER, SWAPPER_ADDER, SWAPPER_SETTER } from '../../../../deploy/001_trade_factory';

describe('ZRX', function () {
  let swapperAdder: JsonRpcSigner;
  let swapperSetter: JsonRpcSigner;
  let strategyAdder: JsonRpcSigner;
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
        sippagePercentage: 0.03,
      });

      forkBlockNumber = await ethers.provider.getBlockNumber();
    });

    beforeEach(async () => {
      await evm.reset({
        jsonRpcUrl: getNodeUrl('mainnet'),
        blockNumber: forkBlockNumber,
      });

      const namedAccounts = await getNamedAccounts();

      swapperAdder = await wallet.impersonate(SWAPPER_ADDER[CHAIN_ID]);
      swapperSetter = await wallet.impersonate(SWAPPER_SETTER[CHAIN_ID]);
      strategyAdder = await wallet.impersonate(STRATEGY_ADDER[CHAIN_ID]);
      crvWhale = await wallet.impersonate(CRV_WHALE_ADDRESS);
      yMech = await wallet.impersonate(namedAccounts.yMech);

      await ethers.provider.send('hardhat_setBalance', [namedAccounts.deployer, '0xffffffffffffffff']);
      await ethers.provider.send('hardhat_setBalance', [strategy.address, '0xffffffffffffffff']);
      setTestChainId(CHAIN_ID);
      await deployments.fixture(['Common', 'ZRX'], { keepExistingDeployments: false });

      CRV = await ethers.getContractAt(IERC20_ABI, CRV_ADDRESS);
      DAI = await ethers.getContractAt(IERC20_ABI, DAI_ADDRESS);

      tradeFactory = await ethers.getContract('TradeFactory');
      ZRXSwapper = await ethers.getContract('ZRX');

      await CRV.connect(crvWhale).transfer(strategy.address, AMOUNT_IN);

      await tradeFactory.connect(strategyAdder).grantRole(await tradeFactory.STRATEGY(), strategy.address);
      await tradeFactory.connect(swapperAdder).addSwappers([ZRXSwapper.address]);
      await tradeFactory.connect(swapperSetter).setStrategyAsyncSwapper(strategy.address, ZRXSwapper.address);

      await CRV.connect(strategy).approve(tradeFactory.address, AMOUNT_IN);
      await tradeFactory.connect(strategy).create(CRV_ADDRESS, DAI_ADDRESS, AMOUNT_IN, MAX_SLIPPAGE, moment().add('30', 'minutes').unix());
    });

    describe('swap', () => {
      beforeEach(async () => {
        await tradeFactory.connect(yMech)['execute(uint256,bytes)'](1, zrxAPIResponse.data);
      });

      then('CRV gets taken from strategy', async () => {
        expect(await CRV.balanceOf(strategy.address)).to.equal(0);
      });

      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      });
    });
  });

  context('on polygon', () => {
    const CHAIN_ID = 137;

    const WMATIC_ADDRESS = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
    const DAI_ADDRESS = '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063';

    const WMATIC_WHALE_ADDRESS = '0xadbf1854e5883eb8aa7baf50705338739e558e5b';

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
        sippagePercentage: 0.03,
      });

      forkBlockNumber = await ethers.provider.getBlockNumber();
    });

    beforeEach(async () => {
      await evm.reset({
        jsonRpcUrl: getNodeUrl('polygon'),
        blockNumber: forkBlockNumber,
      });

      const namedAccounts = await getNamedAccounts();

      swapperAdder = await wallet.impersonate(SWAPPER_ADDER[CHAIN_ID]);
      swapperSetter = await wallet.impersonate(SWAPPER_SETTER[CHAIN_ID]);
      strategyAdder = await wallet.impersonate(STRATEGY_ADDER[CHAIN_ID]);
      wmaticWhale = await wallet.impersonate(WMATIC_WHALE_ADDRESS);
      yMech = await wallet.impersonate(namedAccounts.yMech);

      await ethers.provider.send('hardhat_setBalance', [namedAccounts.deployer, '0xffffffffffffffff']);
      await ethers.provider.send('hardhat_setBalance', [strategy.address, '0xffffffffffffffff']);
      setTestChainId(CHAIN_ID);
      await deployments.fixture(['TradeFactory', 'ZRX'], { keepExistingDeployments: false });

      WMATIC = await ethers.getContractAt(IERC20_ABI, WMATIC_ADDRESS);
      DAI = await ethers.getContractAt(IERC20_ABI, DAI_ADDRESS);

      tradeFactory = await ethers.getContract('TradeFactory');
      ZRXSwapper = await ethers.getContract('ZRX');

      await WMATIC.connect(wmaticWhale).transfer(strategy.address, AMOUNT_IN);

      await tradeFactory.connect(strategyAdder).grantRole(await tradeFactory.STRATEGY(), strategy.address);
      await tradeFactory.connect(swapperAdder).addSwappers([ZRXSwapper.address]);
      await tradeFactory.connect(swapperSetter).setStrategyAsyncSwapper(strategy.address, ZRXSwapper.address);

      await WMATIC.connect(strategy).approve(tradeFactory.address, AMOUNT_IN);

      await tradeFactory.connect(strategy).create(WMATIC_ADDRESS, DAI_ADDRESS, AMOUNT_IN, MAX_SLIPPAGE, moment().add('30', 'minutes').unix());
    });

    describe('swap', () => {
      beforeEach(async () => {
        await tradeFactory.connect(yMech)['execute(uint256,bytes)'](1, zrxAPIResponse.data);
      });

      then('WMATIC gets taken from strategy and DAI gets airdropped to strategy', async () => {
        expect(await WMATIC.balanceOf(strategy.address)).to.equal(0);
      });

      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      });
    });
  });
}).retries(5);
