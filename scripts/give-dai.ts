import { utils } from 'ethers';
import { ethers } from 'hardhat';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import wallet from '../test/utils/wallet';

export const main = async () => {
  const dai = await ethers.getContractAt(IERC20_ABI, '0x6b175474e89094c44da98b954eedeac495271d0f');
  const whale = await wallet.impersonate('0x028171bca77440897b824ca71d1c56cac55b68a3');
  await dai.connect(whale).transfer('0xB82193725471dC7bfaAB1a3AB93c7b42963F3265', utils.parseEther('100000'), { gasPrice: 0 });
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
