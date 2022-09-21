const {
  BN,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  constants,
} = require("@openzeppelin/test-helpers");
import { accounts, contract, privateKeys, web3 } from "@openzeppelin/test-environment";
import { BigNumber, ethers } from "ethers";

import {
  IDX_CONTRACT_ADMIN_1,
  getAccountsFromArray,
  IDX_CONTRACT_ADMIN_2,
  IDX_CONTRACT_ADMIN_3,
  IDX_BUYER_1,
  IDX_BUYER_2,
  IDX_FINANCE_ADMIN_1,
  IDX_FINANCE_ADMIN_2,
  Account,
  CONTRACT_ADMIN_ROLE,
  IDX_CONTRACT_ADMIN_4,
  IDX_PAYEE_1,
  IDX_PAYEE_2,
  IDX_PRICE_PAYOUT,
  IDX_VOUCHER_SIGNER_1,
} from "../accounts";
import { ERC721_OS_V2, PAYMENT_SPLITTER, OpenSaleParams, nonceGen } from "../common";
import { createOpenSaleParams, multiSigRoleThreshold } from "../erc721_params";
import { createMultiSigParam } from "../payload_multisig/common";
import { createPayload as createPauseTokensPayload } from "../payload_multisig/pause_tokens";
import { createPayload as createTogglePausePayload } from "../payload_multisig/toggle_pause";
import { createPayload as createToggleSalePayload } from "../payload_multisig/toggle_sale";
import { createPayload as createRoleRoyaltyPayoutPayload } from "../payload_multisig/update_role_royalty_pricepayout";
import { createPayload as createWithdrawPayload } from "../payload_multisig/withdraw";

import {
  createPayload as createMinTokenPayload,
  createVoucherParam as createMintTokenVoucherParam,
} from "../payload_voucher/mint_token";

const Erc721 = contract.fromArtifact(ERC721_OS_V2);
const PaymentSplitter = contract.fromArtifact(PAYMENT_SPLITTER);

describe(`${ERC721_OS_V2} - Happy Path E2E`, () => {
  let nft: any;
  let erc721Address: string;
  let saleParams: OpenSaleParams;
  let defaultSender = accounts[IDX_CONTRACT_ADMIN_1];
  let chainId = 1;
  let nonce: number;
  let multisigNonceGen = nonceGen;
  let voucherNonceGen = nonceGen;
  const accountInfo: Account[] = getAccountsFromArray(accounts, privateKeys);
  const contractAdminSigners = [IDX_CONTRACT_ADMIN_1, IDX_CONTRACT_ADMIN_2, IDX_CONTRACT_ADMIN_3];
  const financeAdminSigners = [IDX_FINANCE_ADMIN_1, IDX_FINANCE_ADMIN_2];

  beforeAll(async () => {
    saleParams = createOpenSaleParams(accountInfo, multiSigRoleThreshold());
    nft = await Erc721.new(saleParams, { from: defaultSender });
    erc721Address = nft.address;
  });

  it("should create NFT contract", () => {
    expect(nft).toBeTruthy();
  });

  it("should be initialized correctly", async () => {
    expect(await nft.name()).toEqual(saleParams.name);
    expect(await nft.symbol()).toEqual(saleParams.symbol);
    expect(await nft.baseURI()).toEqual(saleParams.baseURI);
    expect(await nft.contractURI()).toEqual(saleParams.contractURI);
    expect((await nft.maxSupply()).toNumber()).toEqual(saleParams.maxSupply);
    expect((await nft.maxTokensPerWallet()).toNumber()).toEqual(saleParams.maxTokensPerWallet);
    expect(await nft.pricePayoutWallet()).toEqual(saleParams.pricePayoutWallet);
    expect((await nft.totalSupply()).toNumber()).toEqual(0);
    expect(await nft.isSaleActive()).toEqual(false);
    expect(await nft.paused()).toEqual(false);
    expect(await web3.eth.getBalance(nft.address)).toEqual(new BN(0).toString());

    const paymentSplittersCount = (await nft.paymentSplittersCount()).toNumber();
    expect(paymentSplittersCount).toEqual(1);
    expect(await nft.currentPaymentSplitter()).toEqual(await nft.paymentSplittersHistory(paymentSplittersCount - 1));
  });

  it("should activate sale", async () => {
    nonce = multisigNonceGen();
    const payload = createToggleSalePayload(erc721Address, chainId, nonce);
    const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
    const receipt = await nft.toggleSaleState(multiSigParam, { from: defaultSender });
    expectEvent(receipt, "SaleActiveChanged");
    expect(await nft.isSaleActive()).toEqual(true);
  });

  it("should mark a multisig-nonce as `used-up`", async () => {
    nonce = multisigNonceGen();
    await nft.markMultisigNonceUsed(nonce, { from: defaultSender });
  });

  it("should fail when using a `used-up` nonce to perform an admin task", async () => {
    //  DO NOT generate a new nonce, and instead use the current `used-up` nonce
    // nonce = multisigNonceGen();
    const payload = createTogglePausePayload(erc721Address, chainId, nonce);
    const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
    await expectRevert(nft.togglePauseState(multiSigParam, { from: defaultSender }), "27");
  });

  it("should pause the contract", async () => {
    nonce = multisigNonceGen(); //  Generate a new Nonce to continue
    const payload = createTogglePausePayload(erc721Address, chainId, nonce);
    const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
    await nft.togglePauseState(multiSigParam, { from: defaultSender });
    expect(await nft.paused()).toEqual(true);
  });

  it("should fail on performing any admin task (eg. deactivate sale) when contract is paused", async () => {
    nonce = multisigNonceGen();
    const payload = createToggleSalePayload(erc721Address, chainId, nonce);
    const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
    await expectRevert(nft.toggleSaleState(multiSigParam, { from: defaultSender }), "Pausable: paused");
  });

  it("should un-pause the contract", async () => {
    nonce = multisigNonceGen();
    const payload = createTogglePausePayload(erc721Address, chainId, nonce);
    const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
    await nft.togglePauseState(multiSigParam, { from: defaultSender });
    expect(await nft.paused()).toEqual(false);
  });

  it("should update roles, royalties and pricePayoutWallet", async () => {
    nonce = multisigNonceGen();
    const grantRoles = [CONTRACT_ADMIN_ROLE];
    const grantRoleAddresses = [accountInfo[IDX_CONTRACT_ADMIN_4].address];
    const revokeRoles = [CONTRACT_ADMIN_ROLE] as string[];
    const revokeRoleAddresses = [accountInfo[IDX_CONTRACT_ADMIN_4].address] as string[];
    const totalRoyalty = 1000;
    const payees = [accountInfo[IDX_PAYEE_1].address, accountInfo[IDX_PAYEE_2].address];
    const shares = [6000, 4000];
    const pricePayoutWallets = [accountInfo[IDX_PRICE_PAYOUT].address];

    const payload = createRoleRoyaltyPayoutPayload(
      erc721Address,
      chainId,
      nonce,
      grantRoles,
      grantRoleAddresses,
      revokeRoles,
      revokeRoleAddresses,
      totalRoyalty,
      payees,
      shares,
      pricePayoutWallets
    );
    const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
    const receipt = await nft.updateRoleRoyaltyPayout(
      grantRoles,
      grantRoleAddresses,
      revokeRoles,
      revokeRoleAddresses,
      totalRoyalty,
      payees,
      shares,
      pricePayoutWallets,
      multiSigParam,
      { from: defaultSender }
    );

    expect(await nft.paymentSplittersCount()).toEqual(new BN(2));
    expectEvent(receipt, "UpdatedRoleRoyaltyPricePayout");
  });

  it("should mint token with tokenId=0", async () => {
    nonce = voucherNonceGen();
    const tokenId = 0;
    const buyer = accountInfo[IDX_BUYER_1].address;
    const now_Minus_1Hr = new Date(Date.now());
    now_Minus_1Hr.setHours(-1);
    const issueTime = Math.floor(now_Minus_1Hr.valueOf() / 1000); // NowMinus1Hr in seconds,
    const expirationDuration = 2 * 24 * 60 * 60; // 2 Days in seconds
    const pricePerToken = ethers.utils.parseEther("0.001");
    const value = ethers.utils.parseEther("0.001");

    const payload = createMinTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );
    const voucherParam = await createMintTokenVoucherParam(
      payload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );

    const receipt = await nft.mintToken(tokenId, voucherParam, {
      from: buyer,
      value: value,
    });

    expectEvent(receipt, "Transfer", {
      from: constants.ZERO_ADDRESS,
      to: buyer,
      tokenId: new BN(tokenId),
    });
  });

  it("should mint token with tokenId=1", async () => {
    nonce = voucherNonceGen();
    const tokenId = 1;
    const buyer = accountInfo[IDX_BUYER_1].address;
    const now_Minus_1Hr = new Date(Date.now());
    now_Minus_1Hr.setHours(-1);
    const issueTime = Math.floor(now_Minus_1Hr.valueOf() / 1000); // NowMinus1Hr in seconds,
    const expirationDuration = 2 * 24 * 60 * 60; // 2 Days in seconds
    const pricePerToken = ethers.utils.parseEther("0.001");
    const value = ethers.utils.parseEther("0.001");

    const payload = createMinTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );
    const voucherParam = await createMintTokenVoucherParam(
      payload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );

    const receipt = await nft.mintToken(tokenId, voucherParam, {
      from: buyer,
      value: value,
    });

    expectEvent(receipt, "Transfer", {
      from: constants.ZERO_ADDRESS,
      to: buyer,
      tokenId: new BN(tokenId),
    });
  });

  it("should mint token with tokenId=2", async () => {
    nonce = voucherNonceGen();
    const tokenId = 2;
    const buyer = accountInfo[IDX_BUYER_1].address;
    const now_Minus_1Hr = new Date(Date.now());
    now_Minus_1Hr.setHours(-1);
    const issueTime = Math.floor(now_Minus_1Hr.valueOf() / 1000); // NowMinus1Hr in seconds,
    const expirationDuration = 2 * 24 * 60 * 60; // 2 Days in seconds
    const pricePerToken = ethers.utils.parseEther("0.001");
    const value = ethers.utils.parseEther("0.001");

    const payload = createMinTokenPayload(
      erc721Address,
      chainId,
      nonce,
      tokenId,
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );
    const voucherParam = await createMintTokenVoucherParam(
      payload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );

    const receipt = await nft.mintToken(tokenId, voucherParam, {
      from: buyer,
      value: value,
    });

    expectEvent(receipt, "Transfer", {
      from: constants.ZERO_ADDRESS,
      to: buyer,
      tokenId: new BN(tokenId),
    });
  });

  it("should generate correct tokenURIs for the minted tokens", async () => {
    expect(await nft.tokenURI(0)).toEqual(`${saleParams.baseURI}${0}`);
    expect(await nft.tokenURI(1)).toEqual(`${saleParams.baseURI}${1}`);
    expect(await nft.tokenURI(2)).toEqual(`${saleParams.baseURI}${2}`);
  });

  it("should fail when tokenURI requested for non-existent tokenId", async () => {
    expectRevert(nft.tokenURI(3), "23");
  });

  it("should pause transfers on tokenIds 0,1", async () => {
    nonce = multisigNonceGen();
    const tokenIds = [0, 1];
    const pause = true;
    const payload = createPauseTokensPayload(erc721Address, chainId, nonce, tokenIds, pause);
    const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
    const receipt = await nft.pauseTokens(tokenIds, pause, multiSigParam, { from: defaultSender });
    expectEvent(receipt, "TokensPaused");
  });

  it("should fail on transferring tokenIds 0,1 after pausing them", async () => {
    let tokenIdToTransfer = 0;
    await expectRevert(
      nft.transferFrom(accounts[IDX_BUYER_1], accounts[IDX_BUYER_2], tokenIdToTransfer, {
        from: accounts[IDX_BUYER_1],
      }),
      "34"
    );

    tokenIdToTransfer = 1;
    await expectRevert(
      nft.transferFrom(accounts[IDX_BUYER_1], accounts[IDX_BUYER_2], tokenIdToTransfer, {
        from: accounts[IDX_BUYER_1],
      }),
      "34"
    );
  });

  it("should un-pause transfers on tokenIds 0,1", async () => {
    nonce = multisigNonceGen();
    const tokenIds = [0, 1];
    const pause = false;
    const payload = createPauseTokensPayload(erc721Address, chainId, nonce, tokenIds, pause);
    const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
    const receipt = await nft.pauseTokens(tokenIds, pause, multiSigParam, { from: defaultSender });
    expectEvent(receipt, "TokensPaused");
  });

  it("should resume transferring of tokenIds 0,1 after un-pausing", async () => {
    let tokenIdToTransfer = 0;
    let receipt = await nft.transferFrom(accounts[IDX_BUYER_1], accounts[IDX_BUYER_2], tokenIdToTransfer, {
      from: accounts[IDX_BUYER_1],
    });
    expectEvent(receipt, "Transfer", {
      from: accounts[IDX_BUYER_1],
      to: accounts[IDX_BUYER_2],
      tokenId: new BN(tokenIdToTransfer),
    });

    tokenIdToTransfer = 1;
    receipt = await nft.transferFrom(accounts[IDX_BUYER_1], accounts[IDX_BUYER_2], tokenIdToTransfer, {
      from: accounts[IDX_BUYER_1],
    });
    expectEvent(receipt, "Transfer", {
      from: accounts[IDX_BUYER_1],
      to: accounts[IDX_BUYER_2],
      tokenId: new BN(tokenIdToTransfer),
    });
  });

  it("should de-activate sale", async () => {
    nonce = multisigNonceGen();
    const payload = createToggleSalePayload(erc721Address, chainId, nonce);
    const multiSigParam = await createMultiSigParam(payload, nonce, contractAdminSigners);
    const receipt = await nft.toggleSaleState(multiSigParam, { from: defaultSender });
    expectEvent(receipt, "SaleActiveChanged");
    expect(await nft.isSaleActive()).toEqual(false);
  });

  it("should allow to withdraw funds", async () => {
    nonce = multisigNonceGen();
    expect(new BN(await web3.eth.getBalance(nft.address)).gte(new BN(0))).toEqual(true);
    const payload = createWithdrawPayload(erc721Address, chainId, nonce);
    const multiSigParam = await createMultiSigParam(payload, nonce, financeAdminSigners);
    const receipt = await nft.withdraw(multiSigParam, { from: accounts[IDX_FINANCE_ADMIN_1] });
    expectEvent(receipt, "Withdraw");
    expect(new BN(await web3.eth.getBalance(nft.address)).eq(new BN(0))).toEqual(true);
  });

  it("should release the correct amounts to the payee wallets", async () => {
    const paymentSplitterAddress = await nft.currentPaymentSplitter();
    const paymentSplitterBalanceInitial: BigNumber = new BN(await web3.eth.getBalance(paymentSplitterAddress));
    const paymentSplitter = await PaymentSplitter.at(paymentSplitterAddress);

    const payee1Wallet = saleParams.payees[0];
    const payee1WalletBalanceInitial: BigNumber = new BN(await web3.eth.getBalance(payee1Wallet));
    const payee1WalletDue = paymentSplitterBalanceInitial.mul(new BN(6000)).div(new BN(10000));

    const payee2Wallet = saleParams.payees[1];
    const payee2WalletBalanceInitial: BigNumber = new BN(await web3.eth.getBalance(payee2Wallet));
    const payee2WalletDue = paymentSplitterBalanceInitial.mul(new BN(4000)).div(new BN(10000));

    await paymentSplitter.release(payee1Wallet);
    const payee1WalletBalanceFinal: BigNumber = new BN(await web3.eth.getBalance(payee1Wallet));
    expect(payee1WalletBalanceFinal.eq(payee1WalletBalanceInitial.add(payee1WalletDue))).toEqual(true);

    await paymentSplitter.release(payee2Wallet);
    const payee2WalletBalanceFinal: BigNumber = new BN(await web3.eth.getBalance(payee2Wallet));
    expect(payee2WalletBalanceFinal.eq(payee2WalletBalanceInitial.add(payee2WalletDue))).toEqual(true);

    const paymentSplitterBalanceFinal: BigNumber = new BN(await web3.eth.getBalance(paymentSplitterAddress));
    expect(paymentSplitterBalanceFinal.eq(new BN(0))).toEqual(true);
  });
});
