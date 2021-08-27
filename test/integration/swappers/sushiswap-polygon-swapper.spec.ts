import { expect } from 'chai';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { JsonRpcSigner } from '@ethersproject/providers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Contract, utils, Wallet } from 'ethers';
import { deployments, ethers, getNamedAccounts } from 'hardhat';
import { contracts, evm, wallet } from '../../utils';
import { then, when } from '../../utils/bdd';
import moment from 'moment';
import { getNodeUrl } from '../../../utils/network';
import { setTestChainId } from '../../../utils/deploy';
import { STRATEGY_ADDER, SWAPPER_ADDER, SWAPPER_SETTER } from '../../../deploy/001_trade_factory';

// We set a fixed block number so tests can cache blockchain state
const FORK_BLOCK_NUMBER = 17080654;

const MAX_SLIPPAGE = 10_000; // 1%
const AMOUNT_IN = utils.parseEther('10000');
const data = contracts.encodeParameters([], []);

const CRV_ADDRESS = '0x172370d5cd63279efa6d502dab29171933a610af';
const DAI_ADDRESS = '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063';

const CRV_WHALE_ADDRESS = '0x3a8a6831a1e866c64bc07c3df0f7b79ac9ef2fa2';
const DAI_WHALE_ADDRESS = '0x27f8d03b3a2196956ed754badc28d73be8830a6e';

describe('SushiswapPolygonSwapper', function () {
  let swapperAdder: JsonRpcSigner;
  let swapperSetter: JsonRpcSigner;
  let strategyAdder: JsonRpcSigner;
  let crvWhale: JsonRpcSigner;
  let daiWhale: JsonRpcSigner;
  let yMech: JsonRpcSigner;
  let strategy: Wallet;

  let tradeFactory: Contract;
  let sushiswapPolygonSwapper: Contract;

  let CRV: Contract;
  let DAI: Contract;

  beforeEach(async () => {
    const CHAIN_ID = 137;

    await evm.reset({
      jsonRpcUrl: getNodeUrl('polygon'),
      blockNumber: FORK_BLOCK_NUMBER,
    });

    const namedAccounts = await getNamedAccounts();

    await ethers.provider.send('hardhat_setBalance', [namedAccounts.deployer, '0xffffffffffffffff']);
    setTestChainId(CHAIN_ID);
    await deployments.fixture(['TradeFactory', 'SushiswapPolygonSwapper'], { keepExistingDeployments: false });

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
    sushiswapPolygonSwapper = await ethers.getContract('SushiswapPolygonSwapper');

    await CRV.connect(crvWhale).transfer(strategy.address, AMOUNT_IN);

    await tradeFactory.connect(strategyAdder).grantRole(await tradeFactory.STRATEGY(), strategy.address);
    await tradeFactory.connect(swapperAdder).addSwappers([sushiswapPolygonSwapper.address]);
    await tradeFactory.connect(swapperSetter).setStrategySyncSwapper(strategy.address, sushiswapPolygonSwapper.address);

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
