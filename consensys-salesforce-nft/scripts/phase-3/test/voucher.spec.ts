const {
  BN,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  constants,
} = require("@openzeppelin/test-helpers");
import { accounts, contract, privateKeys, web3 } from "@openzeppelin/test-environment";
import { ethers } from "ethers";

import {
  IDX_CONTRACT_ADMIN_1,
  IDX_BUYER_1,
  Account,
  getAccountsFromArray,
  IDX_VOUCHER_SIGNER_1,
  IDX_BUYER_2,
} from "../accounts";
import { ERC721_OS_V2, ERC721_CS_V2, OpenSaleParams, ClosedSaleParams } from "../common";
import { createClosedSaleParams, createOpenSaleParams, multiSigParam } from "../erc721_params";
import {
  createPayload as createMintTokenPayload,
  createVoucherParam as createMintTokenVoucherParam,
} from "../payload_voucher/mint_token";
import {
  createPayload as createMintTokensPayload,
  createVoucherParam as createMintTokensVoucherParam,
} from "../payload_voucher/mint_tokens";

const Erc721OS = contract.fromArtifact(ERC721_OS_V2);
const Erc721CS = contract.fromArtifact(ERC721_CS_V2);
const accountInfo: Account[] = getAccountsFromArray(accounts, privateKeys);

describe(ERC721_OS_V2, () => {
  let nft: any;
  let erc721Address: string;
  let saleParams: OpenSaleParams;
  let defaultSender = accounts[IDX_CONTRACT_ADMIN_1];
  let multiSig = multiSigParam(); //  No MultiSig param
  let chainId = 1;
  let override: any;
  const buyer1 = accountInfo[IDX_BUYER_1].address;
  const buyer2 = accountInfo[IDX_BUYER_2].address;

  beforeAll(() => {
    override = {
      maxSupply: 3,
      maxTokensPerWallet: 2,
    };
  });

  beforeEach(async () => {
    saleParams = createOpenSaleParams(accountInfo, override);
    nft = await Erc721OS.new(saleParams, { from: defaultSender });
    erc721Address = nft.address;

    //  Activate Sale for all these UnitTests
    await nft.toggleSaleState(multiSig, { from: defaultSender });
  });

  it("should create NFT contract", () => {
    expect(nft).toBeTruthy();
  });

  it("should fail if the incorrect value/ETH is passed", async () => {
    let nonce = 1;
    let tokenId = 0;
    let times = getVoucherTimes();
    let pricePerToken = ethers.utils.parseEther("0.001");
    let value = ethers.utils.parseEther("0.001");
    let voucherPayload = createMintTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );
    let voucherParam = await createMintTokenVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value: web3.utils.toWei(`0.002`), //  value should be "0.001"
      }),
      "22"
    );
  });

  it("should fail if the same nonce is re-used after a sucessful txn", async () => {
    let nonce = 1;
    let tokenId = 0;
    let times = getVoucherTimes();
    let pricePerToken = ethers.utils.parseEther("0.001");
    let value = ethers.utils.parseEther("0.001");
    let voucherPayload = createMintTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    let voucherParam = await createMintTokenVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    const receipt = await nft.mintToken(tokenId, voucherParam, {
      from: buyer1,
      value: value,
    });
    expectEvent(receipt, "Transfer", {
      from: constants.ZERO_ADDRESS,
      to: buyer1,
      tokenId: new BN(tokenId),
    });

    tokenId = 2;
    // nonce = 2; DO NOT create a new nonce
    voucherPayload = createMintTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );
    voucherParam = await createMintTokenVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value: value,
      }),
      "27"
    );
  });

  it("should fail if the Voucher has expired", async () => {
    let nonce = 1;
    let tokenId = 0;
    const today = new Date();
    today.setHours(-25); //  rewind 25 hours
    const issueTime = Math.floor(today.valueOf() / 1000); // time in seconds,
    const expirationDuration = 1 * 24 * 60 * 60; // 24 Hours in seconds
    let pricePerToken = ethers.utils.parseEther("0.001");
    let value = ethers.utils.parseEther("0.001");
    let voucherPayload = createMintTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer1,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );
    let voucherParam = await createMintTokenVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      }),
      "35"
    );
  });

  it("should fail if the Voucher is issued for a future time", async () => {
    let nonce = 1;
    let tokenId = 0;
    const today = new Date();
    today.setHours(25); //  fwd 25 hours
    const issueTime = Math.floor(today.valueOf() / 1000); // time in seconds,
    const expirationDuration = 1 * 24 * 60 * 60; // 24 Hours in seconds
    let pricePerToken = ethers.utils.parseEther("0.001");
    let value = ethers.utils.parseEther("0.001");
    let voucherPayload = createMintTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer1,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );
    let voucherParam = await createMintTokenVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      }),
      "35"
    );
  });

  it("should fail if the Voucher is issued for a different tokenId", async () => {
    let nonce = 1;
    let tokenId = 0;
    let times = getVoucherTimes();
    let pricePerToken = ethers.utils.parseEther("0.001");
    let value = ethers.utils.parseEther("0.001");
    let voucherPayload = createMintTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    let voucherParam = await createMintTokenVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      //  Some other tokenId
      nft.mintToken(2, voucherParam, {
        from: buyer1,
        value: value,
      }),
      "32"
    );
  });

  it("should fail if the Voucher is issued for a different buyer", async () => {
    let nonce = 1;
    let tokenId = 0;
    let times = getVoucherTimes();
    let pricePerToken = ethers.utils.parseEther("0.001");
    let value = ethers.utils.parseEther("0.001");
    let voucherPayload = createMintTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    let voucherParam = await createMintTokenVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      //  Some other buyer
      nft.mintToken(tokenId, voucherParam, {
        from: buyer2,
        value: value,
      }),
      "32"
    );
  });

  it("should fail if the Voucher is signed by a non-voucher-signer role", async () => {
    let nonce = 1;
    let tokenId = 0;
    let times = getVoucherTimes();
    let pricePerToken = ethers.utils.parseEther("0.001");
    let value = ethers.utils.parseEther("0.001");
    let voucherPayload = createMintTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    let voucherParam = await createMintTokenVoucherParam(
      voucherPayload,
      nonce,
      IDX_CONTRACT_ADMIN_1, //  Some other Signer
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      //  Some other buyer
      nft.mintToken(tokenId, voucherParam, {
        from: buyer2,
        value: value,
      }),
      "32"
    );
  });

  it("should succeed if all conditions are ok", async () => {
    let nonce = 1;
    let tokenId = 0;
    let times = getVoucherTimes();
    let pricePerToken = ethers.utils.parseEther("0.001");
    let value = ethers.utils.parseEther("0.001");
    let voucherPayload = createMintTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    let voucherParam = await createMintTokenVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    const receipt = await nft.mintToken(tokenId, voucherParam, {
      from: buyer1,
      value: value,
    });
    expectEvent(receipt, "Transfer", {
      from: constants.ZERO_ADDRESS,
      to: buyer1,
      tokenId: new BN(tokenId),
    });
  });
});

describe(ERC721_CS_V2, () => {
  let nft: any;
  let erc721Address: string;
  let saleParams: ClosedSaleParams;
  let defaultSender = accounts[IDX_CONTRACT_ADMIN_1];
  let multiSig = multiSigParam(); //  No MultiSig param
  let chainId = 1;
  let override: any;
  const buyer1 = accountInfo[IDX_BUYER_1].address;
  const buyer2 = accountInfo[IDX_BUYER_2].address;

  beforeAll(() => {
    override = {
      maxSupply: 3,
      maxTokensPerWallet: 2,
    };
  });

  beforeEach(async () => {
    saleParams = createClosedSaleParams(accountInfo, override);
    nft = await Erc721CS.new(saleParams, { from: defaultSender });
    erc721Address = nft.address;

    //  Activate Sale for all these UnitTests
    await nft.toggleSaleState(multiSig, { from: defaultSender });
  });

  it("should create NFT contract", () => {
    expect(nft).toBeTruthy();
  });

  it("should fail if the incorrect value/ETH is passed", async () => {
    let nonce = 1;
    const tokenCount = 2;
    let times = getVoucherTimes();
    let pricePerToken = ethers.utils.parseEther("0.001");
    const value = ethers.utils.parseEther("0.001").mul(tokenCount);
    let voucherPayload = createMintTokensPayload(
      erc721Address,
      chainId,
      nonce,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );
    let voucherParam = await createMintTokensVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value: web3.utils.toWei(`0.001`), //  Invalid value
      }),
      "22"
    );
  });

  it("should fail if the same nonce is re-used after a sucessful txn", async () => {
    let nonce = 1;
    const tokenCount = 1;
    let times = getVoucherTimes();
    let pricePerToken = ethers.utils.parseEther("0.001");
    const value = ethers.utils.parseEther("0.001").mul(tokenCount);
    let voucherPayload = createMintTokensPayload(
      erc721Address,
      chainId,
      nonce,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    let voucherParam = await createMintTokensVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    const receipt = await nft.mintTokens(tokenCount, voucherParam, {
      from: buyer1,
      value: value,
    });
    expectEvent(receipt, "Transfer", {
      from: constants.ZERO_ADDRESS,
      to: buyer1,
      tokenId: new BN(0),
    });

    // nonce = 2; DO NOT create a new nonce
    voucherPayload = createMintTokensPayload(
      erc721Address,
      chainId,
      nonce,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );
    voucherParam = await createMintTokensVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value: value,
      }),
      "27"
    );
  });

  it("should fail if the Voucher has expired", async () => {
    let nonce = 1;
    const tokenCount = 2;
    const today = new Date();
    today.setHours(-25); //  rewind 25 hours
    const issueTime = Math.floor(today.valueOf() / 1000); // time in seconds,
    const expirationDuration = 1 * 24 * 60 * 60; // 24 Hours in seconds
    let pricePerToken = ethers.utils.parseEther("0.001");
    const value = ethers.utils.parseEther("0.001").mul(tokenCount);
    let voucherPayload = createMintTokensPayload(
      erc721Address,
      chainId,
      nonce,
      buyer1,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );
    let voucherParam = await createMintTokensVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
      }),
      "35"
    );
  });

  it("should fail if the Voucher is issued for a future time", async () => {
    let nonce = 1;
    const tokenCount = 2;
    const today = new Date();
    today.setHours(25); //  fwd 25 hours
    const issueTime = Math.floor(today.valueOf() / 1000); // time in seconds,
    const expirationDuration = 1 * 24 * 60 * 60; // 24 Hours in seconds
    let pricePerToken = ethers.utils.parseEther("0.001");
    const value = ethers.utils.parseEther("0.001").mul(tokenCount);
    let voucherPayload = createMintTokensPayload(
      erc721Address,
      chainId,
      nonce,
      buyer1,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );
    let voucherParam = await createMintTokensVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
      }),
      "35"
    );
  });

  it("should fail if the Voucher is issued for a different buyer", async () => {
    let nonce = 1;
    const tokenCount = 2;
    let times = getVoucherTimes();
    let pricePerToken = ethers.utils.parseEther("0.001");
    const value = ethers.utils.parseEther("0.001").mul(tokenCount);
    let voucherPayload = createMintTokensPayload(
      erc721Address,
      chainId,
      nonce,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    let voucherParam = await createMintTokensVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      //  Some other buyer
      nft.mintTokens(tokenCount, voucherParam, {
        from: buyer2,
        value: value,
      }),
      "32"
    );
  });

  it("should fail if the Voucher is signed by a non-voucher-signer role", async () => {
    let nonce = 1;
    const tokenCount = 2;
    let times = getVoucherTimes();
    let pricePerToken = ethers.utils.parseEther("0.001");
    const value = ethers.utils.parseEther("0.001").mul(tokenCount);
    let voucherPayload = createMintTokensPayload(
      erc721Address,
      chainId,
      nonce,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    let voucherParam = await createMintTokensVoucherParam(
      voucherPayload,
      nonce,
      IDX_CONTRACT_ADMIN_1, //  Some other Signer
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    await expectRevert(
      //  Some other buyer
      nft.mintTokens(tokenCount, voucherParam, {
        from: buyer2,
        value: value,
      }),
      "32"
    );
  });

  it("should succeed if all conditions are ok", async () => {
    let nonce = 1;
    const tokenCount = 2;
    let times = getVoucherTimes();
    let pricePerToken = ethers.utils.parseEther("0.001");
    const value = ethers.utils.parseEther("0.001").mul(tokenCount);
    let voucherPayload = createMintTokensPayload(
      erc721Address,
      chainId,
      nonce,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    let voucherParam = await createMintTokensVoucherParam(
      voucherPayload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer1,
      times.issueTime,
      times.expirationDuration,
      pricePerToken.toString()
    );

    const receipt = await nft.mintTokens(tokenCount, voucherParam, {
      from: buyer1,
      value: value,
    });
    expectEvent(receipt, "Transfer", {
      from: constants.ZERO_ADDRESS,
      to: buyer1,
      tokenId: new BN(0),
    });
    expectEvent(receipt, "Transfer", {
      from: constants.ZERO_ADDRESS,
      to: buyer1,
      tokenId: new BN(1),
    });
  });
});

function getVoucherTimes() {
  const now_Minus_1Hr = new Date(Date.now());
  now_Minus_1Hr.setHours(-1);
  const issueTime = Math.floor(now_Minus_1Hr.valueOf() / 1000); // NowMinus1Hr in seconds,
  const expirationDuration = 2 * 24 * 60 * 60; // 2 Days in seconds
  return {
    issueTime,
    expirationDuration,
  };
}
