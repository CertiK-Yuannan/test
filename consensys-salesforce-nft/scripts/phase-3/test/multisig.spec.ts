const {
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
import { accounts, contract, privateKeys } from "@openzeppelin/test-environment";
import { ethers } from "ethers";

import {
  IDX_CONTRACT_ADMIN_1,
  IDX_CONTRACT_ADMIN_2,
  IDX_CONTRACT_ADMIN_3,
  IDX_FINANCE_ADMIN_1,
  IDX_BUYER_1,
  Account,
  getAccountsFromArray,
  IDX_VOUCHER_SIGNER_1,
  IDX_CONTRACT_ADMIN_4,
} from "../accounts";
import { ERC721_CS_V2, ClosedSaleParams } from "../common";
import { createMultiSigParam } from "../payload_multisig/common";
import { createPayload as createPauseTokensPayload } from "../payload_multisig/pause_tokens";
import { createPayload as createToggleSalePayload } from "../payload_multisig/toggle_sale";

import { createClosedSaleParams, multiSigRoleThreshold } from "../erc721_params";
import {
  createPayload as createMintTokensPayload,
  createVoucherParam as createMintTokensVoucherParam,
} from "../payload_voucher/mint_tokens";

const Erc721CS = contract.fromArtifact(ERC721_CS_V2);
const contractAdminSigners = [IDX_CONTRACT_ADMIN_1, IDX_CONTRACT_ADMIN_2, IDX_CONTRACT_ADMIN_3];

describe(ERC721_CS_V2, () => {
  let nft: any;
  let erc721Address: string;
  let saleParams: ClosedSaleParams;
  let defaultSender = accounts[IDX_CONTRACT_ADMIN_1];
  let chainId = 1;
  const accountInfo: Account[] = getAccountsFromArray(accounts, privateKeys);

  beforeEach(async () => {
    saleParams = createClosedSaleParams(accountInfo, multiSigRoleThreshold());
    nft = await Erc721CS.new(saleParams, { from: defaultSender });
    erc721Address = nft.address;
  });

  it("should create NFT contract", () => {
    expect(nft).toBeTruthy();
  });

  it("should fail if parameters do not match the parameters in the signature", async () => {
    let nonce = 1;
    await mintTokens(nonce);

    nonce = 2;
    const tokenIds = [0, 1];
    const incorrectTokenIds = [0];
    const pause = true;
    const payload = createPauseTokensPayload(erc721Address, chainId, nonce, incorrectTokenIds, pause);
    const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);

    await expectRevert(nft.pauseTokens(tokenIds, pause, multiSigParam, { from: defaultSender }), "32");
  });

  it("should fail if the same nonce is re-used after a sucessful txn", async () => {
    let nonce = 1;
    await mintTokens(nonce);

    const tokenIds = [0, 1];
    const pause = true;
    const payload = createPauseTokensPayload(erc721Address, chainId, nonce, tokenIds, pause);
    const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);

    await expectRevert(nft.pauseTokens(tokenIds, pause, multiSigParam, { from: defaultSender }), "27");
  });

  it("should fail if the number of signatures are lesser than the threshold", async () => {
    let nonce = 1;
    await mintTokens(nonce);

    nonce = 2;
    const tokenIds = [0, 1];
    const pause = true;
    const payload = createPauseTokensPayload(erc721Address, chainId, nonce, tokenIds, pause);
    const multiSigParam = await createMultiSigParam(payload, nonce, [IDX_CONTRACT_ADMIN_1, IDX_CONTRACT_ADMIN_2]); //  2 signatures sent in. . Threshold=3);

    await expectRevert(nft.pauseTokens(tokenIds, pause, multiSigParam, { from: defaultSender }), "28");
  });

  it("should fail if the number of signatures are greater than the threshold", async () => {
    let nonce = 1;
    await mintTokens(nonce);

    nonce = 2;
    const tokenIds = [0, 1];
    const pause = true;
    const payload = createPauseTokensPayload(erc721Address, chainId, nonce, tokenIds, pause);
    const multiSigParam = await createMultiSigParam(payload, nonce, [
      IDX_CONTRACT_ADMIN_1,
      IDX_CONTRACT_ADMIN_2,
      IDX_CONTRACT_ADMIN_3,
      IDX_CONTRACT_ADMIN_4,
    ]); //  4 signatures sent in. . Threshold=3);

    await expectRevert(nft.pauseTokens(tokenIds, pause, multiSigParam, { from: defaultSender }), "28");
  });

  it("should fail if duplicate Accounts are signing for this nonce", async () => {
    let nonce = 1;
    await mintTokens(nonce);

    nonce = 2;
    const tokenIds = [0, 1];
    const pause = true;
    const payload = createPauseTokensPayload(erc721Address, chainId, nonce, tokenIds, pause);
    const multiSigParam = await createMultiSigParam(payload, nonce, [
      IDX_CONTRACT_ADMIN_1,
      IDX_CONTRACT_ADMIN_2,
      IDX_CONTRACT_ADMIN_2,
    ]); //  Duplicate signatures sent in

    await expectRevert(nft.pauseTokens(tokenIds, pause, multiSigParam, { from: defaultSender }), "31");
  });

  it("should fail if signed by a non CONTRACT_ADMIN_ROLE", async () => {
    let nonce = 1;
    await mintTokens(nonce);

    nonce = 2;
    const tokenIds = [0, 1];
    const pause = true;
    const payload = createPauseTokensPayload(erc721Address, chainId, nonce, tokenIds, pause);
    const multiSigParam = await createMultiSigParam(payload, nonce, [
      IDX_CONTRACT_ADMIN_1,
      IDX_CONTRACT_ADMIN_2,
      IDX_FINANCE_ADMIN_1,
    ]); //  Duplicate signatures sent in

    await expectRevert(nft.pauseTokens(tokenIds, pause, multiSigParam, { from: defaultSender }), "32");
  });

  it("should mark the nonce as used and prevent it from being re-used", async () => {
    let nonce = 1;
    await mintTokens(nonce);

    nonce = 2;
    await nft.markMultisigNonceUsed(nonce, { from: defaultSender }); //  This nonce cannot be used again.

    const tokenIds = [0, 1];
    const pause = true;
    const payload = createPauseTokensPayload(erc721Address, chainId, nonce, tokenIds, pause);
    const multiSigParam = await createMultiSigParam(payload, nonce, [
      IDX_CONTRACT_ADMIN_1,
      IDX_CONTRACT_ADMIN_2,
      IDX_FINANCE_ADMIN_1,
    ]); //  Using a "used-up" nonce

    await expectRevert(nft.pauseTokens(tokenIds, pause, multiSigParam, { from: defaultSender }), "27");
  });

  it("should succeed if all conditions are ok", async () => {
    let nonce = 1;
    await mintTokens(nonce);

    nonce = 2;
    const tokenIds = [0, 1];
    const pause = true;
    const payload = createPauseTokensPayload(erc721Address, chainId, nonce, tokenIds, pause);
    const multiSigParam = await createMultiSigParam(payload, nonce, [
      IDX_CONTRACT_ADMIN_1,
      IDX_CONTRACT_ADMIN_2,
      IDX_CONTRACT_ADMIN_3,
    ]);

    const receipt = await nft.pauseTokens(tokenIds, pause, multiSigParam, { from: defaultSender });
    expectEvent(receipt, "TokensPaused");
  });

  async function mintTokens(nonce: number, tokenCount = 3) {
    //  Mint TokenIds 0,1,2
    const multiSigPayload = createToggleSalePayload(erc721Address, chainId, nonce);
    const multiSigParam = await createMultiSigParam(multiSigPayload, nonce, contractAdminSigners);
    await nft.toggleSaleState(multiSigParam, { from: defaultSender });

    const buyer = accountInfo[IDX_BUYER_1].address;

    const now_Minus_1Hr = new Date(Date.now());
    now_Minus_1Hr.setHours(-1);
    const issueTime = Math.floor(now_Minus_1Hr.valueOf() / 1000); // NowMinus1Hr in seconds,
    const expirationDuration = 2 * 24 * 60 * 60; // 2 Days in seconds
    const pricePerToken = ethers.utils.parseEther("0.001");
    const value = ethers.utils.parseEther("0.001").mul(tokenCount);
    const voucherPayload = createMintTokensPayload(
      erc721Address,
      chainId,
      nonce,
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );
    const voucherParam = await createMintTokensVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );

    await nft.mintTokens(tokenCount, voucherParam, {
      from: buyer,
      value: value,
    });
  }
});
