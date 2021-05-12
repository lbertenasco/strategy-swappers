import { expect } from 'chai';
import { ethers } from 'hardhat';
import { contract, then, when } from '../utils/bdd';

contract('SwapperRegistry', () => {
  describe('swappers', () => {
    when('there are no swappers', () => {
      then('returns empty array');
    });
    when('there are swappers', () => {
      then('returns array with correct swappers');
    });
  });

  describe('swapperNames', () => {
    when('there are no swappers', () => {
      then('returns empty array');
    });
    when('there are swappers', () => {
      then('returns array with correct swapper names');
    });
  });

  describe('activeSwappers', () => {
    when('there are no swappers', () => {
      then('returns empty array');
    });
    when('all current swapper are actives', () => {
      then('returns array with correct swappers');
    });
    when('some swappers were deprecated', () => {
      then('array has same length as total swappers');
      then('returns only active swappers');
      then('rest of array is zero address');
    });
  });

  describe('deprecatedSwappers', () => {
    when('there are no swappers', () => {
      then('returns empty array');
    });
    when('all current swapper are deprecated', () => {
      then('returns array with correct swappers');
    });
    when('some swappers are active', () => {
      then('array has same length as total swappers');
      then('returns only deprecated swappers');
      then('rest of array is zero address');
    });
  });

  describe('isSwapper(address)', () => {
    when('is not a swapper', () => {
      then('returns false');
    });
    when('is a swapper', () => {
      then('returns true');
    });
  });

  describe('isSwapper(string)', () => {
    when('is not a swapper', () => {
      then('returns false');
      then('returns swapper address as zero');
      then('returns initialization as zero');
    });
    when('is a swapper', () => {
      then('returns true');
      then('returns correct swapper address');
      then('returns correct initialization');
    });
  });

  describe('addSwapper', () => {
    // only governor
  });

  describe('_addSwapper', () => {
    when('adding swapper with empty name', () => {
      then('tx is reverted with reason');
    });
    when('adding swapper with zero address', () => {
      then('tx is reverted with reason');
    });
    when('swapper was already added', () => {
      then('tx is reverted with reason');
    });
    when('swapper name was already taken', () => {
      then('tx is reverted with reason');
    });
    when('adding valid swapper', () => {
      then('name gets related with address');
      then('address gets related with name');
      then('initialization is set');
      then('gets added to swappers');
      then('deprecated is false');
      then('emits event with correct information');
    });
  });

  describe('deprecateSwapper', () => {
    // only governor
  });

  describe('_deprecateSwapper', () => {
    when('swapper was not in registry', () => {
      then('tx is reverted with reason');
    });
    when('swapper was in registry', () => {
      then('sets deprecated to true');
      then('emits event with correct information');
    });
  });

  describe('sendDust', () => {
    // only governor
  });
});
