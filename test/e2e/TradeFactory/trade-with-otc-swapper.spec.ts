import { contract, then, when } from '../../utils/bdd';

contract('TradeFactory', () => {
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
