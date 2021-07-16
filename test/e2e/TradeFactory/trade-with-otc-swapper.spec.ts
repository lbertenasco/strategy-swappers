import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { fixtures } from '../../utils';
import { contract, then, when } from '../../utils/bdd';

contract('TradeFactory', () => {
  let governor: SignerWithAddress;
  let mechanic: SignerWithAddress;

  let mechanicsRegistry: Contract;
  let machinery: Contract;

  before('create fixture loader', async () => {
    [governor, mechanic] = await ethers.getSigners();
  });

  beforeEach(async () => {
    ({ mechanicsRegistry, machinery } = await fixtures.machineryFixture(mechanic.address));
  });

  describe('trade executed with otc swapper', () => {
    when('otc has available to trade', () => {
      then('tokens get taken from strategy');
      then('trades some on otc pool');
      then('trades the rest on uniswap');
      then('all tokens received get airdropped to strategy');
    });
    when('otc has none available to trade', () => {
      then('tokens get taken from strategy');
      then('trades none on otc pool');
      then('trades all on uniswap');
      then('all tokens received get airdropped to strategy');
    });
  });
});
