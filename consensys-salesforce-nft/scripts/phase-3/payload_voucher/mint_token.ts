import { getAccounts, signTypedeData } from "../accounts";
import { PayloadType } from "../common";

export function createPayload(
  contractAddress: string,
  chainId: number,
  nonce: number,
  tokenId: number,
  buyer: string,
  issueTime: number,
  expirationDuration: number,
  pricePerToken: string
) {
  const payload = {
    types: {
      //  REQD Domain structure for EIP-712
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],

      //  Custom Data structure for `mintToken` Voucher
      Voucher: [
        { name: "tokenId", type: "uint256" },
        { name: "buyer", type: "address" },
        { name: "issueTime", type: "uint256" },
        { name: "expirationDuration", type: "uint256" },
        { name: "pricePerToken", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "functionABI", type: "string" },
      ],
    },

    primaryType: "Voucher",

    //  EIP712Domain Data
    domain: {
      name: "Erc721Verifier",
      version: "V2",
      chainId,
      verifyingContract: contractAddress,
    },

    //  `mintToken` Data
    message: {
      tokenId,
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken,
      nonce,
      functionABI: "mintToken(uint256,VoucherParams)",
    },
  };
  return payload;
}

export async function createVoucherParam(
  payload: any,
  nonce: number,
  signerIdx: number,
  buyer: string,
  issueTime: number,
  expirationDuration: number,
  pricePerToken: string
) {
  const accounts = getAccounts();
  const signature = await signTypedeData(payload, accounts[signerIdx].privateKey, PayloadType.VOUCHER);
  const voucherParam = {
    buyer,
    issueTime,
    expirationDuration,
    pricePerToken,
    nonce,
    signature,
  };
  return voucherParam;
}


