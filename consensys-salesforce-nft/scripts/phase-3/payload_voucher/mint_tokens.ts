import { ethers } from "ethers";
import { getAccounts, getSigner, IDX_BUYER_1, IDX_VOUCHER_SIGNER_1, signTypedeData } from "../accounts";
import { ethersProvider, getEventNames, nonceGen, PayloadType } from "../common";

export function createPayload(
  contractAddress: string,
  chainId: number,
  nonce: number,
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

      //  Custom Data structure for `mintTokens` Voucher
      Voucher: [
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

    //  `mintTokens` Data
    message: {
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken,
      nonce,
      functionABI: "mintTokens(uint256,VoucherParams)",
    },
  };
  return payload;
}

export async function createVoucherParam(
  payload: any,
  nonce: number,
  signedIdx: number,
  buyer: string,
  issueTime: number,
  expirationDuration: number,
  pricePerToken: string
) {
  const accounts = getAccounts();
  const signature = await signTypedeData(payload, accounts[signedIdx].privateKey, PayloadType.VOUCHER);
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

export async function executeMintTokens(contractAddress: string, erc721Contract: ethers.Contract) {
  console.log("Minting Tokens ...");
  const accounts = getAccounts();
  const signedContract = erc721Contract.connect(getSigner(IDX_BUYER_1, ethersProvider));
  const network = await ethersProvider.getNetwork();
  const chainId = network.chainId;
  const nonce = nonceGen();
  const tokenCount = 3;
  const buyer = accounts[IDX_BUYER_1].address;
  const issueTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const expirationDuration = 2 * 24 * 60 * 60; // 2 Days in seconds
  const pricePerToken = ethers.utils.parseEther("0.001");
  const value = ethers.utils.parseEther("0.001").mul(tokenCount);

  const payload = createPayload(
    contractAddress,
    chainId,
    nonce,
    buyer,
    issueTime,
    expirationDuration,
    pricePerToken.toString()
  );
  const voucherParam = await createVoucherParam(
    payload,
    nonce,
    IDX_VOUCHER_SIGNER_1,
    buyer,
    issueTime,
    expirationDuration,
    pricePerToken.toString()
  );
  const x = await signedContract.mintTokens(tokenCount, voucherParam, { value });
  const receipt = await x.wait();
  console.log("MintTokens Receipt", getEventNames(receipt));
}