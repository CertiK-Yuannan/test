import { ethers } from "ethers";
import { MNEMONIC } from "./env";

export enum RoleName {
  CONTRACT_ADMIN_ROLE = "CONTRACT_ADMIN_ROLE",
  FINANCE_ADMIN_ROLE = "FINANCE_ADMIN_ROLE",
  VOUCHER_SIGNER_ROLE = "VOUCHER_SIGNER_ROLE",
}

export const CONTRACT_ADMIN_ROLE = ethers.utils.solidityKeccak256(["string"], [RoleName.CONTRACT_ADMIN_ROLE]);
export const FINANCE_ADMIN_ROLE = ethers.utils.solidityKeccak256(["string"], [RoleName.FINANCE_ADMIN_ROLE]);
export const VOUCHER_SIGNER_ROLE = ethers.utils.solidityKeccak256(["string"], [RoleName.VOUCHER_SIGNER_ROLE]);

//  Account Index in a Wallet
export const IDX_CONTRACT_ADMIN_1 = 0;
export const IDX_CONTRACT_ADMIN_2 = 1;
export const IDX_CONTRACT_ADMIN_3 = 2;
export const IDX_CONTRACT_ADMIN_4 = 3;
export const IDX_FINANCE_ADMIN_1 = 4;
export const IDX_FINANCE_ADMIN_2 = 5;
export const IDX_FINANCE_ADMIN_3 = 6;
export const IDX_FINANCE_ADMIN_4 = 7;
export const IDX_VOUCHER_SIGNER_1 = 8;
export const IDX_VOUCHER_SIGNER_2 = 9;
export const IDX_VOUCHER_SIGNER_3 = 10;
export const IDX_VOUCHER_SIGNER_4 = 11;
export const IDX_BUYER_1 = 12;
export const IDX_BUYER_2 = 13;
export const IDX_BUYER_3 = 14;
export const IDX_PAYEE_1 = 15;
export const IDX_PAYEE_2 = 16;
export const IDX_RANDOM_1 = 17;
export const IDX_RANDOM_2 = 18;
export const IDX_PRICE_PAYOUT = 19;

export interface Account {
  address: string;
  publicKey: string;
  privateKey: string;
}

const accounts: Account[] = [];
const keyPath = "m/44'/60'/0'/0/";

export function getAccounts() {
  if (accounts.length == 0) {
    for (let n = 0; n <= 19; n++) {
      const hdNode = ethers.utils.HDNode.fromMnemonic(MNEMONIC);
      const node = hdNode.derivePath(`${keyPath}${n}`);
      accounts.push({
        address: node.address,
        publicKey: node.publicKey,
        privateKey: node.privateKey,
      });
    }
  }
  return accounts;
}

export function getAccountsFromArray(addresses: string[], privateKeys: string[]) {
  for (let n = 0; n <= 19; n++) {
    accounts.push({
      address: addresses[n],
      publicKey: "",
      privateKey: privateKeys[n],
    });
  }
  return accounts;
}

export function getSigner(accountIdx: number, provider: ethers.providers.JsonRpcProvider) {
  const hdNode = ethers.utils.HDNode.fromMnemonic(MNEMONIC);
  const node = hdNode.derivePath(`${keyPath}${accountIdx}`);
  const signer = new ethers.Wallet(node.privateKey, provider);
  return signer;
}

export async function signTypedeData(payload: any, privateKey: string, typeName: string) {
  const wallet = new ethers.Wallet(privateKey);
  const signature = await wallet._signTypedData(
    payload.domain,
    {
      [typeName]: payload.types[typeName],
    },
    payload.message
  );
  return signature;
}

export function verifyTypedData(payload: any, signature: string, typeName: string) {
  return ethers.utils.verifyTypedData(
    payload.domain,
    {
      [typeName]: payload.types[typeName],
    },
    payload.message,
    signature
  );
}