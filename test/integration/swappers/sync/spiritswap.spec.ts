import { expect } from 'chai';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { JsonRpcSigner } from '@ethersproject/providers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Contract, utils, Wallet } from 'ethers';
import { deployments, ethers, getNamedAccounts } from 'hardhat';
import { contracts, evm, wallet } from '../../../utils';
import { then, when } from '../../../utils/bdd';
import moment from 'moment';
import { getNodeUrl } from '../../../../utils/network';
import { setTestChainId } from '../../../../utils/deploy';
import { STRATEGY_ADDER, SWAPPER_ADDER, SWAPPER_SETTER } from '../../../../deploy/001_trade_factory';

// We set a fixed block number so tests can cache blockchain state
const FORK_BLOCK_NUMBER = 16548550;

const MAX_SLIPPAGE = 10_000; // 1%
const AMOUNT_IN = utils.parseEther('10000');
const data = contracts.encodeParameters([], []);

describe('Spiritswap', function () {
  let swapperAdder: JsonRpcSigner;
  let swapperSetter: JsonRpcSigner;
  let strategyAdder: JsonRpcSigner;
  let crvWhale: JsonRpcSigner;
  let daiWhale: JsonRpcSigner;
  let yMech: JsonRpcSigner;
  let strategy: Wallet;

  let tradeFactory: Contract;
  let sushiswap: Contract;

  let CRV: Contract;
  let DAI: Contract;

  when('on fantom', () => {
    const CRV_ADDRESS = '0x1E4F97b9f9F913c46F1632781732927B9019C68b';
    const DAI_ADDRESS = '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E';

    const CRV_WHALE_ADDRESS = '0x9d945d909ca91937d19563e30bb4dac12c860189';
    const DAI_WHALE_ADDRESS = '0xdb042a2ff578633f241fcd010eb4ac775f0eabc2';

    beforeEach(async () => {
      const CHAIN_ID = 250;

      await evm.reset({
        jsonRpcUrl: getNodeUrl('fantom'),
        blockNumber: FORK_BLOCK_NUMBER,
      });

      const namedAccounts = await getNamedAccounts();

      await ethers.provider.send('hardhat_setBalance', [namedAccounts.deployer, '0xffffffffffffffff']);
      setTestChainId(CHAIN_ID);
      await deployments.fixture(['Common', 'Fantom', 'SyncSpiritswap'], { keepExistingDeployments: false });

      swapperAdder = await wallet.impersonate(SWAPPER_ADDER[CHAIN_ID]);
      swapperSetter = await wallet.impersonate(SWAPPER_SETTER[CHAIN_ID]);
      strategyAdder = await wallet.impersonate(STRATEGY_ADDER[CHAIN_ID]);
      crvWhale = await wallet.impersonate(CRV_WHALE_ADDRESS);
      daiWhale = await wallet.impersonate(DAI_WHALE_ADDRESS);
      yMech = await wallet.impersonate(namedAccounts.yMech);
      strategy = await wallet.generateRandom();

      CRV = await ethers.getContractAt(IERC20_ABI, CRV_ADDRESS);
      DAI = await ethers.getContractAt(IERC20_ABI, DAI_ADDRESS);

      tradeFactory = await ethers.getContract('TradeFactory');
      sushiswap = await ethers.getContract('SyncSpiritswap');

      await CRV.connect(crvWhale).transfer(strategy.address, AMOUNT_IN);

      await tradeFactory.connect(strategyAdder).grantRole(await tradeFactory.STRATEGY(), strategy.address);
      await tradeFactory.connect(swapperAdder).addSwappers([sushiswap.address]);
      await tradeFactory.connect(swapperSetter).setStrategySyncSwapper(strategy.address, sushiswap.address);

      await CRV.connect(strategy).approve(tradeFactory.address, AMOUNT_IN);
    });

    describe('swap', () => {
      const data = ethers.utils.defaultAbiCoder.encode([], []);
      beforeEach(async () => {
        await tradeFactory
          .connect(strategy)
          ['execute(address,address,uint256,uint256,bytes)'](CRV_ADDRESS, DAI_ADDRESS, AMOUNT_IN, MAX_SLIPPAGE, data);
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
