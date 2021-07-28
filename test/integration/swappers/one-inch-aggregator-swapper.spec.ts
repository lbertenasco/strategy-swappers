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
import oneinch from '../../../scripts/libraries/oneinch';

describe.only('OneInchAggregatorSwapper', function () {
  let deployer: JsonRpcSigner;
  let governor: JsonRpcSigner;
  let crvWhale: JsonRpcSigner;
  let daiWhale: JsonRpcSigner;
  let yMech: JsonRpcSigner;
  let strategy: Wallet;

  let tradeFactory: Contract;
  let swapperRegistry: Contract;
  let oneInchAggregatorSwapper: Contract;

  const MAX_SLIPPAGE = 10_000; // 1%

  context('on mainnet', () => {
    const CRV_ADDRESS = '0xD533a949740bb3306d119CC777fa900bA034cd52';
    const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

    const CRV_WHALE_ADDRESS = '0xd2d43555134dc575bf7279f4ba18809645db0f1d';
    const DAI_WHALE_ADDRESS = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643';

    let CRV: Contract;
    let DAI: Contract;

    const AMOUNT_IN = utils.parseEther('10000');

    beforeEach(async () => {
      await evm.reset({
        jsonRpcUrl: getNodeUrl('mainnet'),
      });

      const namedAccounts = await getNamedAccounts();

      deployer = await wallet.impersonate(namedAccounts.deployer);
      governor = await wallet.impersonate(namedAccounts.governor);
      crvWhale = await wallet.impersonate(CRV_WHALE_ADDRESS);
      daiWhale = await wallet.impersonate(DAI_WHALE_ADDRESS);
      yMech = await wallet.impersonate(namedAccounts.yMech);
      strategy = await wallet.generateRandom();

      await setTestChainId(1);
      await deployments.fixture('OneInchAggregatorSwapper');

      CRV = await ethers.getContractAt(IERC20_ABI, CRV_ADDRESS);
      DAI = await ethers.getContractAt(IERC20_ABI, DAI_ADDRESS);

      tradeFactory = await ethers.getContract('TradeFactory');
      swapperRegistry = await ethers.getContract('SwapperRegistry');
      oneInchAggregatorSwapper = await ethers.getContract('OneInchAggregatorSwapper');

      await CRV.connect(crvWhale).transfer(strategy.address, AMOUNT_IN, { gasPrice: 0 });

      await tradeFactory.connect(governor).grantRole(await tradeFactory.STRATEGY(), strategy.address, { gasPrice: 0 });

      await CRV.connect(strategy).approve(tradeFactory.address, AMOUNT_IN, { gasPrice: 0 });
      const { _initialization } = await swapperRegistry['isSwapper(string)']('one-inch-aggregator');
      await tradeFactory.connect(strategy).setSwapperSafetyCheckpoint(_initialization, { gasPrice: 0 });
      await tradeFactory
        .connect(strategy)
        .create('one-inch-aggregator', CRV_ADDRESS, DAI_ADDRESS, AMOUNT_IN, MAX_SLIPPAGE, moment().add('30', 'minutes').unix(), { gasPrice: 0 });
    });

    describe('swap', () => {
      beforeEach(async () => {
        const oneInchApiResponse = await oneinch.swap(1, {
          tokenIn: CRV_ADDRESS,
          tokenOut: DAI_ADDRESS,
          amountIn: AMOUNT_IN,
          fromAddress: oneInchAggregatorSwapper.address,
          receiver: strategy.address,
          slippage: 1,
          allowPartialFill: false,
          disableEstimate: true,
        });
        await tradeFactory.connect(yMech).execute(1, oneInchApiResponse.tx.data, { gasPrice: 0 });
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
