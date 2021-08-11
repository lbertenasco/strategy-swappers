import { expect } from 'chai';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { JsonRpcSigner } from '@ethersproject/providers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Contract, utils, Wallet } from 'ethers';
import { deployments, ethers, getNamedAccounts } from 'hardhat';
import { contracts, evm, wallet } from '../../utils';
import { then, when } from '../../utils/bdd';
import moment from 'moment';
import { setTestChainId } from '../../../utils/deploy';
import { getNodeUrl } from '../../../utils/network';

// We set a fixed block number so tests can cache blockchain state
const FORK_BLOCK_NUMBER = 12865115;

describe('OneInchSwapper', function () {
  let deployer: JsonRpcSigner;
  let governor: JsonRpcSigner;
  let crvWhale: JsonRpcSigner;
  let daiWhale: JsonRpcSigner;
  let yMech: JsonRpcSigner;
  let strategy: Wallet;

  let tradeFactory: Contract;
  let oneInchSwapper: Contract;

  const MAX_SLIPPAGE = 10_000; // 1%

  context('on mainnet', () => {
    const CRV_ADDRESS = '0xD533a949740bb3306d119CC777fa900bA034cd52';
    const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

    const CRV_WHALE_ADDRESS = '0xd2d43555134dc575bf7279f4ba18809645db0f1d';
    const DAI_WHALE_ADDRESS = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643';

    let CRV: Contract;
    let DAI: Contract;

    const AMOUNT_IN = utils.parseEther('10000');
    const data = contracts.encodeParameters([], []);

    beforeEach(async () => {
      await evm.reset({
        jsonRpcUrl: getNodeUrl('mainnet'),
        blockNumber: FORK_BLOCK_NUMBER,
      });

      const namedAccounts = await getNamedAccounts();

      deployer = await wallet.impersonate(namedAccounts.deployer);
      governor = await wallet.impersonate(namedAccounts.governor);
      crvWhale = await wallet.impersonate(CRV_WHALE_ADDRESS);
      daiWhale = await wallet.impersonate(DAI_WHALE_ADDRESS);
      yMech = await wallet.impersonate(namedAccounts.yMech);
      strategy = await wallet.generateRandom();

      await setTestChainId(1);
      await deployments.fixture('OneInchSwapper');

      CRV = await ethers.getContractAt(IERC20_ABI, CRV_ADDRESS);
      DAI = await ethers.getContractAt(IERC20_ABI, DAI_ADDRESS);

      tradeFactory = await ethers.getContract('TradeFactory');
      oneInchSwapper = await ethers.getContract('OneInchSwapper');

      await CRV.connect(crvWhale).transfer(strategy.address, AMOUNT_IN, {
        gasPrice: 0,
      });

      await tradeFactory.connect(governor).grantRole(await tradeFactory.STRATEGY(), strategy.address, { gasPrice: 0 });
      // await tradeFactory.connect(governor).setStrategySwapper(strategy.address, oneInchSwapper.address);

      await CRV.connect(strategy).approve(tradeFactory.address, AMOUNT_IN, { gasPrice: 0 });
    });

    describe('swap', () => {
      beforeEach(async () => {
        await tradeFactory
          .connect(strategy)
          ['execute(address,address,address,uint256,uint256)'](oneInchSwapper.address, CRV_ADDRESS, DAI_ADDRESS, AMOUNT_IN, MAX_SLIPPAGE, {
            gasPrice: 0,
          });
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
