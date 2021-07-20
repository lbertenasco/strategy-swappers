import { expect } from 'chai';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { JsonRpcSigner } from '@ethersproject/providers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Contract, utils, Wallet } from 'ethers';
import { deployments, ethers, getNamedAccounts } from 'hardhat';
import { evm, wallet } from '../../utils';
import { then, when } from '../../utils/bdd';
import moment from 'moment';
import { getNodeUrl } from '../../../utils/network';
import { setTestChainId } from '../../../utils/deploy';

describe('SushiswapSwapper', function () {
  let deployer: JsonRpcSigner;
  let governor: JsonRpcSigner;
  let crvWhale: JsonRpcSigner;
  let daiWhale: JsonRpcSigner;
  let yMech: JsonRpcSigner;
  let strategy: Wallet;

  let tradeFactory: Contract;
  let swapperRegistry: Contract;

  context('on mainnet', () => {
    // We set a fixed block number so tests can cache blockchain state
    const FORK_BLOCK_NUMBER = 12865115;

    const MAX_SLIPPAGE = 10_000; // 1%
    const AMOUNT_IN = utils.parseEther('1000');

    const CRV_ADDRESS = '0xD533a949740bb3306d119CC777fa900bA034cd52';
    const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

    const CRV_WHALE_ADDRESS = '0xd2d43555134dc575bf7279f4ba18809645db0f1d';
    const DAI_WHALE_ADDRESS = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643';

    let CRV: Contract;
    let DAI: Contract;

    beforeEach(async () => {
      await evm.reset({
        jsonRpcUrl: getNodeUrl('mainnet'),
        blockNumber: FORK_BLOCK_NUMBER,
      });
      await setTestChainId(1);
      await deployments.fixture('SushiswapSwapper');

      const namedAccounts = await getNamedAccounts();

      deployer = await wallet.impersonate(namedAccounts.deployer);
      governor = await wallet.impersonate(namedAccounts.governor);
      crvWhale = await wallet.impersonate(CRV_WHALE_ADDRESS);
      daiWhale = await wallet.impersonate(DAI_WHALE_ADDRESS);
      yMech = await wallet.impersonate(namedAccounts.yMech);
      strategy = await wallet.generateRandom();

      CRV = await ethers.getContractAt(IERC20_ABI, CRV_ADDRESS);
      DAI = await ethers.getContractAt(IERC20_ABI, DAI_ADDRESS);

      tradeFactory = await ethers.getContract('TradeFactory');
      swapperRegistry = await ethers.getContract('SwapperRegistry');

      await CRV.connect(crvWhale).transfer(strategy.address, AMOUNT_IN, { gasPrice: 0 });

      await tradeFactory.connect(governor).grantRole(await tradeFactory.STRATEGY(), strategy.address, { gasPrice: 0 });

      await CRV.connect(strategy).approve(tradeFactory.address, AMOUNT_IN, { gasPrice: 0 });
      const { _initialization } = await swapperRegistry['isSwapper(string)']('sushiswap');
      await tradeFactory.connect(strategy).setSwapperSafetyCheckpoint(_initialization, { gasPrice: 0 });
      await tradeFactory
        .connect(strategy)
        .create('sushiswap', CRV_ADDRESS, DAI_ADDRESS, AMOUNT_IN, MAX_SLIPPAGE, moment().add('30', 'minutes').unix(), { gasPrice: 0 });
    });

    describe('swap', () => {
      beforeEach(async () => {
        await tradeFactory.connect(yMech).execute(1, { gasPrice: 0 });
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
    // We set a fixed block number so tests can cache blockchain state
    const FORK_BLOCK_NUMBER = 17080654;

    const MAX_SLIPPAGE = 10_000; // 1%
    const AMOUNT_IN = utils.parseEther('10000');

    const CRV_ADDRESS = '0x172370d5cd63279efa6d502dab29171933a610af';
    const DAI_ADDRESS = '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063';

    const CRV_WHALE_ADDRESS = '0x3a8a6831a1e866c64bc07c3df0f7b79ac9ef2fa2';
    const DAI_WHALE_ADDRESS = '0x27f8d03b3a2196956ed754badc28d73be8830a6e';

    let CRV: Contract;
    let DAI: Contract;

    beforeEach(async () => {
      await evm.reset({
        jsonRpcUrl: getNodeUrl('polygon'),
        blockNumber: FORK_BLOCK_NUMBER,
      });
      await setTestChainId(137);
      await deployments.fixture('SushiswapSwapper');

      const namedAccounts = await getNamedAccounts();

      deployer = await wallet.impersonate(namedAccounts.deployer);
      governor = await wallet.impersonate(namedAccounts.governor);
      crvWhale = await wallet.impersonate(CRV_WHALE_ADDRESS);
      daiWhale = await wallet.impersonate(DAI_WHALE_ADDRESS);
      yMech = await wallet.impersonate(namedAccounts.yMech);
      strategy = await wallet.generateRandom();

      CRV = await ethers.getContractAt(IERC20_ABI, CRV_ADDRESS);
      DAI = await ethers.getContractAt(IERC20_ABI, DAI_ADDRESS);

      tradeFactory = await ethers.getContract('TradeFactory');
      swapperRegistry = await ethers.getContract('SwapperRegistry');

      await CRV.connect(crvWhale).transfer(strategy.address, AMOUNT_IN, { gasPrice: 0 });

      await tradeFactory.connect(governor).grantRole(await tradeFactory.STRATEGY(), strategy.address, { gasPrice: 0 });

      await CRV.connect(strategy).approve(tradeFactory.address, AMOUNT_IN, { gasPrice: 0 });
      const { _initialization } = await swapperRegistry['isSwapper(string)']('sushiswap');
      await tradeFactory.connect(strategy).setSwapperSafetyCheckpoint(_initialization, { gasPrice: 0 });
      await tradeFactory
        .connect(strategy)
        .create('sushiswap', CRV_ADDRESS, DAI_ADDRESS, AMOUNT_IN, MAX_SLIPPAGE, moment().add('30', 'minutes').unix(), { gasPrice: 0 });
    });

    describe('swap', () => {
      beforeEach(async () => {
        await tradeFactory.connect(yMech).execute(1, { gasPrice: 0 });
      });

      then('CRV gets taken from strategy', async () => {
        expect(await CRV.balanceOf(strategy.address)).to.equal(0);
      });
      then('DAI gets airdropped to strategy', async () => {
        expect(await DAI.balanceOf(strategy.address)).to.be.gt(0);
      });
    });
  });
});
