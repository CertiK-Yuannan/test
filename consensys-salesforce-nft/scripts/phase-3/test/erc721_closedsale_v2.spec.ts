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
  IDX_RANDOM_1,
  IDX_FINANCE_ADMIN_1,
  IDX_BUYER_1,
  IDX_BUYER_2,
  IDX_BUYER_3,
  IDX_PRICE_PAYOUT,
  Account,
  IDX_VOUCHER_SIGNER_1,
} from "../accounts";
import { ERC721_CS_V2, PAYMENT_SPLITTER, ClosedSaleParams } from "../common";
import { createClosedSaleParams, multiSigParam, roleRoyaltyPayout } from "../erc721_params";
import {
  createPayload as createMintTokensPayload,
  createVoucherParam as createMintTokensVoucherParam,
} from "../payload_voucher/mint_tokens";

const Erc721 = contract.fromArtifact(ERC721_CS_V2);
const PaymentSplitter = contract.fromArtifact(PAYMENT_SPLITTER);

describe(ERC721_CS_V2, () => {
  let nft: any;
  let erc721Address: string;
  let saleParams: ClosedSaleParams;
  let defaultSender = accounts[IDX_CONTRACT_ADMIN_1];
  let chainId = 1;
  let multiSig = multiSigParam();
  const accountInfo: Account[] = getAccountsFromArray(accounts, privateKeys);
  let buyer1 = accountInfo[IDX_BUYER_1].address;
  let buyer2 = accountInfo[IDX_BUYER_2].address;
  let buyer3 = accountInfo[IDX_BUYER_3].address;

  beforeEach(async () => {
    saleParams = createClosedSaleParams(accountInfo);
    nft = await Erc721.new(saleParams, { from: defaultSender });
    erc721Address = nft.address;
  });

  it("should create NFT contract", () => {
    expect(nft).toBeTruthy();
  });

  describe("Contract Creation", () => {
    it("should initialize correctly", async () => {
      expect(await nft.provenance()).toEqual(saleParams.provenance);
      expect((await nft.maxTokensPerTxn()).toNumber()).toEqual(saleParams.maxTokensPerTxn);
      expect(await nft.isRevealed()).toEqual(false);
    });

    describe("Constructor Params", () => {
      it("should accept a valid `provenance`", async () => {
        const params = createClosedSaleParams(accountInfo, { provenance: "provenance" });
        nft = await Erc721.new(params, { from: defaultSender });
        expect(nft).not.toBeNull();
      });

      it("should reject an empty `provenance`", async () => {
        const params = createClosedSaleParams(accountInfo, { provenance: "" });
        await expectRevert(Erc721.new(params, { from: defaultSender }), "03");
      });

      it("should accept a valid `maxTokensPerTxn - min`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 10, maxTokensPerTxn: 1 });
        nft = await Erc721.new(params, { from: defaultSender });
        expect(nft).not.toBeNull();
      });

      it("should accept a valid `maxTokensPerTxn - between min/max`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 10, maxTokensPerTxn: 7 });
        nft = await Erc721.new(params, { from: defaultSender });
        expect(nft).not.toBeNull();
      });

      it("should accept a valid `maxTokensPerTxn - max`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 10, maxTokensPerTxn: 10 });
        nft = await Erc721.new(params, { from: defaultSender });
        expect(nft).not.toBeNull();
      });

      it("should reject an invalid `maxTokensPerTxn - 0`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 10, maxTokensPerTxn: 0 });
        await expectRevert(Erc721.new(params, { from: defaultSender }), "07");
      });

      it("should reject an invalid `maxTokensPerTxn - > maxSupply`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 10, maxTokensPerTxn: 11 });
        await expectRevert(Erc721.new(params, { from: defaultSender }), "07");
      });
    });
  });

  describe("Reveal Sale", () => {
    it("should fail if invalid baseURI is passed in", async () => {
      await expectRevert(nft.revealSale("", multiSig, { from: defaultSender }), "02");
    });

    it("should work correctly", async () => {
      let receipt = await nft.revealSale("base-uri", multiSig, { from: defaultSender });
      expectEvent(receipt, "SaleRevealed", { isRevealed: true });
      expect(await nft.isRevealed()).toEqual(true);
    });

    it("should work only once", async () => {
      let receipt = await nft.revealSale("base-uri", multiSig, { from: defaultSender });
      expectEvent(receipt, "SaleRevealed", { isRevealed: true });
      expect(await nft.isRevealed()).toEqual(true); //  Works Once

      await expectRevert(
        nft.revealSale("base-uri", multiSig, { from: defaultSender }), //  Fails when tried again
        "14"
      );
    });

    it("should replace original baseURI with new baseURI", async () => {
      const newBaseURI = "new-baseURI";
      const originalBaseURI = await nft.baseURI();
      expect(originalBaseURI).not.toEqual(newBaseURI);

      await nft.revealSale(newBaseURI, multiSig, { from: defaultSender });
      const actualBaseURI = await nft.baseURI();

      expect(originalBaseURI).not.toEqual(actualBaseURI);
      expect(newBaseURI).toEqual(actualBaseURI);
    });

    it("should set offsetIndex", async () => {
      const originalOffsetIndex = (await nft.offsetIndex()).toNumber();
      expect(originalOffsetIndex).toEqual(0);

      await nft.revealSale("base-uri", multiSig, { from: defaultSender });
      const actualOffsetIndex = (await nft.offsetIndex()).toNumber();
      expect(actualOffsetIndex).not.toEqual(0);
      expect(actualOffsetIndex).toBeGreaterThan(0);
    });

    it("should set offsetIndexBlock", async () => {
      const originalOffsetIndexBlock = (await nft.offsetIndexBlock()).toNumber();
      expect(originalOffsetIndexBlock).toEqual(0);

      await nft.revealSale("base-uri", multiSig, { from: defaultSender });
      const actualOffsetIndexBlock = (await nft.offsetIndexBlock()).toNumber();
      expect(actualOffsetIndexBlock).not.toEqual(0);
      expect(actualOffsetIndexBlock).toBeGreaterThan(0);
    });

    it("should pass when called by CONTRACT_ADMIN_ROLE", async () => {
      const receipt = await nft.revealSale("base-uri", multiSig, { from: accounts[IDX_CONTRACT_ADMIN_2] });
      expectEvent(receipt, "SaleRevealed", { isRevealed: true });
    });

    it("should fail when called by non-CONTRACT_ADMIN_ROLE", async () => {
      await expectRevert.unspecified(nft.revealSale("base-uri", multiSig, { from: accounts[IDX_RANDOM_1] }));
    });

    it("should fail when paused", async () => {
      await nft.togglePauseState(multiSig, { from: defaultSender });
      await expectRevert(nft.revealSale("base-uri", multiSig, { from: defaultSender }), "Pausable: paused");
    });

    it("should pass when called by CONTRACT_ADMIN_ROLE", async () => {
      let receipt = await nft.revealSale("base-uri", multiSig, { from: accounts[IDX_CONTRACT_ADMIN_2] });
      expectEvent(receipt, "SaleRevealed", { isRevealed: true });
    });

    it("should fail when called by non CONTRACT_ADMIN_ROLE", async () => {
      await expectRevert.unspecified(nft.revealSale("base-uri", multiSig, { from: accounts[IDX_FINANCE_ADMIN_1] }));
    });
  });

  describe("Public minting", () => {
    beforeEach(async () => {
      //  Activate Sale for all these UnitTests
      await nft.toggleSaleState(multiSig, { from: defaultSender });
    });

    it("should fail if sale is not activated", async () => {
      await nft.toggleSaleState(multiSig, { from: defaultSender }); // Deactivate Sale

      const nonce = 1;
      const tokenCount = 3;
      const value = ethers.utils.parseEther("0.001").mul(tokenCount);
      const voucherParam = await await createVoucher(nonce, tokenCount, buyer1);
      await expectRevert(
        nft.mintTokens(tokenCount, voucherParam, {
          from: buyer1,
          value: value,
        }),
        "15"
      );
    });

    it("should fail if tokenCount == 0", async () => {
      const nonce = 1;
      const tokenCount = 0;
      const value = ethers.utils.parseEther("0.001").mul(tokenCount);
      const voucherParam = await createVoucher(nonce, tokenCount, buyer1);
      await expectRevert(
        nft.mintTokens(tokenCount, voucherParam, {
          from: buyer1,
          value: value,
        }),
        "20"
      );
    });

    it("should fail if msg.sender is a Contract address", async () => {
      const nonce = 1;
      const tokenCount = 3;
      const value = ethers.utils.parseEther("0.001").mul(tokenCount);
      const voucherParam = await createVoucher(nonce, tokenCount, erc721Address);
      await expectRevert(
        nft.mintTokens(tokenCount, voucherParam, {
          from: erc721Address,
          value: value,
        }),
        "16"
      );
    });

    it("should fail if exceeding maxSupply", async () => {
      // maxSupply = 10;
      let nonce = 1;
      let tokenCount = 3;
      let value = ethers.utils.parseEther("0.001").mul(tokenCount);
      let voucherParam = await createVoucher(nonce, tokenCount, buyer1);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
      });

      nonce = 2;
      tokenCount = 2;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer1);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
      });

      nonce = 3;
      tokenCount = 3;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer2);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer2,
        value,
      });

      nonce = 4;
      tokenCount = 2;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer2);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer2,
        value,
      });
      //  Maxed out now

      nonce = 5;
      tokenCount = 1;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer3);
      await expectRevert(
        nft.mintTokens(tokenCount, voucherParam, {
          from: buyer3,
          value,
        }),
        "17"
      );
    });

    it("should fail if exceeding maxTokensPerTxn", async () => {
      // maxTokensPerTxn: 3
      const nonce = 1;
      const tokenCount = 4;
      const value = ethers.utils.parseEther("0.001").mul(tokenCount);
      const voucherParam = await createVoucher(nonce, tokenCount, buyer1);
      await expectRevert(
        nft.mintTokens(tokenCount, voucherParam, {
          from: buyer1,
          value: value,
        }),
        "18"
      );
    });

    it("should fail if exceeding maxTokensPerWallet", async () => {
      // maxTokensPerWallet: 5
      const nonce = 1;
      const tokenCount = 6;
      const value = ethers.utils.parseEther("0.001").mul(tokenCount);
      const voucherParam = await createVoucher(nonce, tokenCount, buyer1);
      await expectRevert(
        nft.mintTokens(tokenCount, voucherParam, {
          from: buyer1,
          value: value,
        }),
        "19"
      );
    });

    it("should succeed if all conditions are ok", async () => {
      const nonce = 1;
      const tokenCount = 3;
      const value = ethers.utils.parseEther("0.001").mul(tokenCount);
      const voucherParam = await createVoucher(nonce, tokenCount, buyer1);

      const receipt = await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
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
      expectEvent(receipt, "Transfer", {
        from: constants.ZERO_ADDRESS,
        to: buyer1,
        tokenId: new BN(2),
      });
    });

    it("should fail if exceeding maxTokensPerWallet across multiple Txns", async () => {
      // maxTokensPerWallet: 5
      let nonce = 1;
      let tokenCount = 2;
      let value = ethers.utils.parseEther("0.001").mul(tokenCount);
      let voucherParam = await createVoucher(nonce, tokenCount, buyer1);

      const receipt = await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
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

      //  This will exceed
      nonce = 2;
      tokenCount = 4;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer1);
      await expectRevert(
        nft.mintTokens(tokenCount, voucherParam, {
          from: buyer1,
          value,
        }),
        "19"
      );
    });

    it("should update `totalSupply()` on successful minting", async () => {
      const nonce = 1;
      const tokenCount = 2;
      const value = ethers.utils.parseEther("0.001").mul(tokenCount);
      const voucherParam = await createVoucher(nonce, tokenCount, buyer1);

      const receipt = await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
      });
      expect((await nft.totalSupply()).toNumber()).toEqual(2);
    });

    it("should reflect correct balance for minting address", async () => {
      const nonce = 1;
      const tokenCount = 2;
      const value = ethers.utils.parseEther("0.001").mul(tokenCount);
      const voucherParam = await createVoucher(nonce, tokenCount, buyer1);

      const receipt = await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
      });
      expect((await nft.balanceOf(buyer1)).toString()).toEqual(new BN(tokenCount).toString());
    });

    it("should fail when paused", async () => {
      await nft.togglePauseState(multiSig, { from: defaultSender });

      const nonce = 1;
      const tokenCount = 3;
      const value = ethers.utils.parseEther("0.001").mul(tokenCount);
      const voucherParam = await createVoucher(nonce, tokenCount, erc721Address);
      await expectRevert(
        nft.mintTokens(tokenCount, voucherParam, {
          from: buyer1,
          value,
        }),
        "Pausable: paused"
      );
    });
  });

  describe("TokenURI", () => {
    beforeEach(async () => {
      await nft.toggleSaleState(multiSig, { from: defaultSender });
    });

    it("should return static URI before reveal", async () => {
      const staticBaseURI = saleParams.baseURI;
      //  mint maxSupply/10 Tokens
      let nonce = 1;
      let tokenCount = 3;
      let value = ethers.utils.parseEther("0.001").mul(tokenCount);
      let voucherParam = await createVoucher(nonce, tokenCount, buyer1);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
      });

      nonce = 2;
      tokenCount = 3;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer2);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer2,
        value,
      });

      nonce = 3;
      tokenCount = 3;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer3);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer3,
        value,
      });

      nonce = 4;
      tokenCount = 1;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer3);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer3,
        value,
      });

      for (let n = 0; n < 10; n++) {
        const tokenURI = await nft.tokenURI(n);
        expect(tokenURI).toEqual(staticBaseURI);
      }
    });

    it("should return new URI after reveal", async () => {
      //  mint maxSupply/10 Tokens
      let nonce = 1;
      let tokenCount = 3;
      let value = ethers.utils.parseEther("0.001").mul(tokenCount);
      let voucherParam = await createVoucher(nonce, tokenCount, buyer1);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
      });

      nonce = 2;
      tokenCount = 3;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer2);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer2,
        value,
      });

      nonce = 3;
      tokenCount = 3;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer3);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer3,
        value,
      });

      nonce = 4;
      tokenCount = 1;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer3);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer3,
        value,
      });

      const newBaseURI = "some-new-base-uri\\";
      await nft.revealSale(newBaseURI, multiSig, { from: defaultSender });
      const offsetIndex = (await nft.offsetIndex()).toNumber();

      expect(offsetIndex).toBeGreaterThan(0);

      const maxSupply = (await nft.maxSupply()).toNumber();
      for (let n = 0; n < 10; n++) {
        let offsetTokenId = n + offsetIndex;
        if (offsetTokenId >= maxSupply) {
          offsetTokenId -= maxSupply;
        }
        const expectedTokenURI = `${newBaseURI}${offsetTokenId}`;
        const actualTokenURI = await nft.tokenURI(n);
        expect(expectedTokenURI).toEqual(actualTokenURI);
      }
    });

    it("should accept only valid tokenIds", async () => {
      let nonce = 1;
      let tokenCount = 3;
      let value = ethers.utils.parseEther("0.001").mul(tokenCount);
      let voucherParam = await createVoucher(nonce, tokenCount, buyer1);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
      });

      // 0,1,2 are minted and are valid
      await nft.tokenURI(0);
      await nft.tokenURI(1);
      await nft.tokenURI(2);

      // 3 onwards are not minted yet and so are invalid
      await expectRevert(nft.tokenURI(3), "23");
      await expectRevert(nft.tokenURI(4), "23");
      await expectRevert(nft.tokenURI(5), "23");
    });
  });

  describe("Pause Contract", () => {
    it("should toggle state", async () => {
      let state = await nft.paused();
      expect(state).toEqual(false);

      await nft.togglePauseState(multiSig, { from: defaultSender });
      state = await nft.paused();
      expect(state).toEqual(true);
    });

    it("should not allow transfer of tokens when Paused", async () => {
      //  Mint Tokens 0,1,2 to buyer1
      await mintTokensHelper(3);

      //  Pause Contract
      await nft.togglePauseState(multiSig, { from: defaultSender });

      //  Attempt to Transfer tokenId 0
      await expectRevert(
        nft.transferFrom(buyer1, buyer2, 0, {
          from: buyer1,
        }),
        "ERC721Pausable: token transfer while paused"
      );

      //  Attempt to Transfer tokenId 1
      await expectRevert(
        nft.transferFrom(buyer1, buyer2, 1, {
          from: buyer1,
        }),
        "ERC721Pausable: token transfer while paused"
      );

      //  Attempt to Transfer tokenId 2
      await expectRevert(
        nft.transferFrom(buyer1, buyer2, 2, {
          from: buyer1,
        }),
        "ERC721Pausable: token transfer while paused"
      );
    });

    it("should resume transfer of tokens when Un-Paused", async () => {
      //  Mint Tokens 0,1,2 to buyer1
      await mintTokensHelper(3);

      //  Pause Contract
      await nft.togglePauseState(multiSig, { from: defaultSender });

      //  Failed Attempt to Transfer tokenId 0
      await expectRevert(
        nft.transferFrom(buyer1, buyer2, 0, {
          from: buyer1,
        }),
        "ERC721Pausable: token transfer while paused"
      );

      //  Failed Attempt to Transfer tokenId 1
      await expectRevert(
        nft.transferFrom(buyer1, buyer2, 1, {
          from: buyer1,
        }),
        "ERC721Pausable: token transfer while paused"
      );

      //  Failed Attempt to Transfer tokenId 2
      await expectRevert(
        nft.transferFrom(buyer1, buyer2, 2, {
          from: buyer1,
        }),
        "ERC721Pausable: token transfer while paused"
      );

      //  Un Pause Contract
      await nft.togglePauseState(multiSig, { from: defaultSender });

      //  Successful Attempt to Transfer tokenId 0
      let receipt = await nft.transferFrom(buyer1, buyer2, 0, {
        from: buyer1,
      });
      expectEvent(receipt, "Transfer", {
        from: buyer1,
        to: buyer2,
        tokenId: new BN(0),
      });

      //  Successful Attempt to Transfer tokenId 1
      receipt = await nft.transferFrom(buyer1, buyer2, 1, {
        from: buyer1,
      });
      expectEvent(receipt, "Transfer", {
        from: buyer1,
        to: buyer2,
        tokenId: new BN(1),
      });

      //  Successful Attempt to Transfer tokenId 2
      receipt = await nft.transferFrom(buyer1, buyer2, 2, {
        from: buyer1,
      });
      expectEvent(receipt, "Transfer", {
        from: buyer1,
        to: buyer2,
        tokenId: new BN(2),
      });
    });
  });

  describe("Pause Tokens", () => {
    beforeEach(async () => {
      // Activate Sale
      await nft.toggleSaleState(multiSig, { from: defaultSender });

      // Mint some Tokens (0-8)
      let nonce = 1;
      let tokenCount = 3;
      let value = ethers.utils.parseEther("0.001").mul(tokenCount);
      let voucherParam = await createVoucher(nonce, tokenCount, buyer1);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer1,
        value,
      }); //  0,1,2

      nonce = 2;
      tokenCount = 2;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer2);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer2,
        value,
      }); //  3,4

      nonce = 3;
      tokenCount = 3;
      value = ethers.utils.parseEther("0.001").mul(tokenCount);
      voucherParam = await createVoucher(nonce, tokenCount, buyer3);
      await nft.mintTokens(tokenCount, voucherParam, {
        from: buyer3,
        value,
      }); //  5,6,7
    });

    it("should fail if no tokenIds are passed in", async () => {
      const tokenIds: number[] = [];
      const pause = true;
      await expectRevert(nft.pauseTokens(tokenIds, pause, multiSig, { from: defaultSender }), "33");
    });

    it("should pass if valid tokenIds are passed in", async () => {
      const tokenIds: number[] = [1, 2, 3];
      const pause = true;
      const receipt = await nft.pauseTokens(tokenIds, pause, multiSig, { from: defaultSender });
      expectEvent(receipt, "TokensPaused");
    });

    it("should pass when called by CONTRACT_ADMIN_ROLE", async () => {
      const tokenIds: number[] = [1, 2, 3];
      const pause = true;
      const receipt = await nft.pauseTokens(tokenIds, pause, multiSig, { from: accounts[IDX_CONTRACT_ADMIN_2] });
      expectEvent(receipt, "TokensPaused");
    });

    it("should fail when called by non-CONTRACT_ADMIN_ROLE", async () => {
      const tokenIds: number[] = [1, 2, 3];
      const pause = true;
      await expectRevert.unspecified(
        nft.pauseTokens(tokenIds, pause, multiSig, { from: accounts[IDX_FINANCE_ADMIN_1] })
      );
    });

    it("should fail when collection is paused", async () => {
      await nft.togglePauseState(multiSig, { from: defaultSender });

      const tokenIds: number[] = [1, 2, 3];
      const pause = true;

      await expectRevert(nft.pauseTokens(tokenIds, pause, multiSig, { from: defaultSender }), "Pausable: paused");
    });

    it("should ignore tokenIds in the list, which are not minted yet", async () => {
      const tokenIds: number[] = [1, 2, 3, 9]; //  9 is not minted yet

      let pause = true;
      let receipt = await nft.pauseTokens(tokenIds, pause, multiSig, { from: defaultSender });
      expectEvent(receipt, "TokensPaused");

      pause = false;
      receipt = await nft.pauseTokens(tokenIds, pause, multiSig, { from: defaultSender });
      expectEvent(receipt, "TokensPaused");
    });

    it("should not affect transfer for other tokens after calling pauseTokens on some", async () => {
      //  Apply a Pause
      const tokenIds: number[] = [1, 2, 3];
      const pause = true;
      const tokenIdToTransfer = 5; // Other TokenId
      await nft.pauseTokens(tokenIds, pause, multiSig, { from: defaultSender });

      //  Attempt to Transfer Token other than the ones paused
      const receipt = await nft.transferFrom(accounts[IDX_BUYER_3], accounts[IDX_BUYER_1], tokenIdToTransfer, {
        from: accounts[IDX_BUYER_3],
      });
      expectEvent(receipt, "Transfer", {
        from: accounts[IDX_BUYER_3],
        to: accounts[IDX_BUYER_1],
        tokenId: new BN(tokenIdToTransfer),
      });
    });

    it("should not allow transfer for paused tokens", async () => {
      //  Apply a Pause
      const tokenIds: number[] = [1, 2, 3];
      const pause = true;
      const tokenIdToTransfer = 2;
      await nft.pauseTokens(tokenIds, pause, multiSig, { from: defaultSender });

      //  Attempt to Transfer Pause Token
      await expectRevert(
        nft.transferFrom(accounts[IDX_BUYER_1], accounts[IDX_BUYER_2], tokenIdToTransfer, {
          from: accounts[IDX_BUYER_1],
        }),
        "34"
      );
    });

    it("should resume transfer for tokens that are unpaused", async () => {
      //  Apply a Pause
      const tokenIds: number[] = [1, 2, 3];
      const pause = true;
      const tokenIdToTransfer = 2;
      await nft.pauseTokens(tokenIds, pause, multiSig, { from: defaultSender });

      //  Failure on attempting to Transfer Pause Token
      await expectRevert(
        nft.transferFrom(accounts[IDX_BUYER_1], accounts[IDX_BUYER_2], tokenIdToTransfer, {
          from: accounts[IDX_BUYER_1],
        }),
        "34"
      );

      //  UnPause the tokens
      await nft.pauseTokens(tokenIds, false, multiSig, { from: defaultSender });

      //  Success on Transfer
      const receipt = await nft.transferFrom(accounts[IDX_BUYER_1], accounts[IDX_BUYER_2], tokenIdToTransfer, {
        from: accounts[IDX_BUYER_1],
      });
      expectEvent(receipt, "Transfer", {
        from: accounts[IDX_BUYER_1],
        to: accounts[IDX_BUYER_2],
        tokenId: new BN(tokenIdToTransfer),
      });
    });
  });

  describe("Withdraw", () => {
    let zeroBN = new BN(0);

    it("should fail when balance is 0", async () => {
      await expectRevert(nft.withdraw(multiSig, { from: accounts[IDX_FINANCE_ADMIN_1] }), "24");
    });

    it("should fail when called by non FINANCE_ADMIN_ROLE", async () => {
      await expectRevert.unspecified(nft.withdraw(multiSig, { from: accounts[IDX_CONTRACT_ADMIN_2] }));
    });

    it("should pass when called by FINANCE_ADMIN_ROLE", async () => {
      await mintTokensHelper();
      const receipt = await nft.withdraw(multiSig, { from: accounts[IDX_FINANCE_ADMIN_1] });
      expectEvent(receipt, "Withdraw");
    });

    it("should fail when paused", async () => {
      await nft.togglePauseState(multiSig, { from: defaultSender });
      await expectRevert(nft.withdraw(multiSig, { from: accounts[IDX_FINANCE_ADMIN_1] }), "Pausable: paused");
    });

    it("should withdraw into the most recent pricePayoutWallet", async () => {
      //  Current Wallet
      const ppWalletOld = await nft.pricePayoutWallet();
      const ppWalletOldBalanceInitial: BigNumber = new BN(await web3.eth.getBalance(ppWalletOld));

      //  New Wallet
      let ppWalletNew = accounts[IDX_RANDOM_1];
      let ppWalletNewBalanceInitial: BigNumber = new BN(await web3.eth.getBalance(ppWalletNew));

      await mintTokensHelper();
      const contractBalance: BigNumber = new BN(await web3.eth.getBalance(nft.address));

      //  Change pricePayoutWallet
      let params = roleRoyaltyPayout();
      params.pricePayoutWallets = [ppWalletNew];
      await nft.updateRoleRoyaltyPayout(
        params.roles.grantRoles,
        params.roles.grantRoleAddresses,
        params.roles.revokeRoles,
        params.roles.revokeRoleAddresses,
        params.royalties.totalRoyalty,
        params.royalties.payees,
        params.royalties.shares,
        params.pricePayoutWallets,
        multiSig,
        {
          from: defaultSender,
        }
      );
      expect(ppWalletNew).toEqual(await nft.pricePayoutWallet());

      const royalty = await nft.royaltyInfo(0, web3.utils.toWei("0.001")); //  Using dummy tokenId - 0 to calculate Royalty
      const royaltyAddress = royalty[0];
      const royaltyAmount: BigNumber = royalty[1];

      await nft.withdraw(multiSig, { from: accounts[IDX_FINANCE_ADMIN_1] });
      let ppWalletOldBalanceAfterWithdraw: BigNumber = new BN(await web3.eth.getBalance(ppWalletOld));
      let ppWalletNewBalanceAfterWithdraw: BigNumber = new BN(await web3.eth.getBalance(ppWalletNew));

      expect(ppWalletOldBalanceInitial.eq(ppWalletOldBalanceAfterWithdraw)).toEqual(true); //  Old wallet balalnce remains the same
      expect(
        ppWalletNewBalanceAfterWithdraw.eq(ppWalletNewBalanceInitial.add(contractBalance).sub(royaltyAmount))
      ).toEqual(true); //  New Wallet gets the (contractBalance-royaltyAmount) after withdraw
    });

    describe("Royalty included", () => {
      it("should withdraw into pricePayoutWallet and paymentSplitter correctly", async () => {
        const paymentSplitter = await nft.paymentSplittersHistory(0);

        let contractBalanceInitial: BigNumber;
        let contractBalanceAfterMint: BigNumber;
        let contractBalanceAfterWithdraw: BigNumber;

        let psBalanceInitial: BigNumber;
        let psBalanceAfterMint: BigNumber;
        let psBalanceAfterWithdraw: BigNumber;

        let ppwBalanceInitial: BigNumber;
        let ppwBalanceAfterMint: BigNumber;
        let ppwBalanceAfterWithdraw: BigNumber;

        contractBalanceInitial = new BN(await web3.eth.getBalance(nft.address));
        psBalanceInitial = new BN(await web3.eth.getBalance(paymentSplitter));
        ppwBalanceInitial = new BN(await web3.eth.getBalance(accounts[IDX_PRICE_PAYOUT]));

        expect(contractBalanceInitial.eq(zeroBN)).toEqual(true);
        expect(psBalanceInitial.eq(zeroBN)).toEqual(true);

        await mintTokensHelper();

        contractBalanceAfterMint = new BN(await web3.eth.getBalance(nft.address));
        psBalanceAfterMint = new BN(await web3.eth.getBalance(paymentSplitter));
        ppwBalanceAfterMint = new BN(await web3.eth.getBalance(accounts[IDX_PRICE_PAYOUT]));

        expect(contractBalanceAfterMint.gt(zeroBN)).toEqual(true);
        expect(psBalanceAfterMint.eq(zeroBN)).toEqual(true);
        expect(ppwBalanceInitial.eq(ppwBalanceAfterMint)).toEqual(true);

        const royalty = await nft.royaltyInfo(0, web3.utils.toWei("0.001")); //  Using dummy tokenId - 0 to calculate Royalty
        const royaltyAddress = royalty[0];
        const royaltyAmount: BigNumber = royalty[1];

        const receipt = await nft.withdraw(multiSig, { from: accounts[IDX_FINANCE_ADMIN_1] });

        contractBalanceAfterWithdraw = new BN(await web3.eth.getBalance(nft.address));
        psBalanceAfterWithdraw = new BN(await web3.eth.getBalance(paymentSplitter));
        ppwBalanceAfterWithdraw = new BN(await web3.eth.getBalance(accounts[IDX_PRICE_PAYOUT]));

        expect(contractBalanceAfterWithdraw.eq(zeroBN)).toEqual(true);
        expect(ppwBalanceAfterWithdraw.eq(ppwBalanceInitial.add(contractBalanceAfterMint).sub(royaltyAmount))).toEqual(
          true
        );
        expect(psBalanceAfterWithdraw.eq(royaltyAmount)).toEqual(true);
      });

      it("should release the correct amounts to the payee wallets", async () => {
        await mintTokensHelper();
        await nft.withdraw(multiSig, { from: accounts[IDX_FINANCE_ADMIN_1] });

        const paymentSplitterAddress = await nft.paymentSplittersHistory(0);
        const paymentSplitterBalanceInitial: BigNumber = new BN(await web3.eth.getBalance(paymentSplitterAddress));
        const paymentSplitter = await PaymentSplitter.at(paymentSplitterAddress);

        const payee1Wallet = saleParams.payees[0];
        const payee1WalletBalanceInitial: BigNumber = new BN(await web3.eth.getBalance(payee1Wallet));
        const payee1WalletDue = paymentSplitterBalanceInitial.mul(new BN(saleParams.shares[0])).div(new BN(10000));

        const payee2Wallet = saleParams.payees[1];
        const payee2WalletBalanceInitial: BigNumber = new BN(await web3.eth.getBalance(payee2Wallet));
        const payee2WalletDue = paymentSplitterBalanceInitial.mul(new BN(saleParams.shares[1])).div(new BN(10000));

        await paymentSplitter.release(payee1Wallet);
        const payee1WalletBalanceFinal: BigNumber = new BN(await web3.eth.getBalance(payee1Wallet));
        expect(payee1WalletBalanceFinal.eq(payee1WalletBalanceInitial.add(payee1WalletDue))).toEqual(true);

        await paymentSplitter.release(payee2Wallet);
        const payee2WalletBalanceFinal: BigNumber = new BN(await web3.eth.getBalance(payee2Wallet));
        expect(payee2WalletBalanceFinal.eq(payee2WalletBalanceInitial.add(payee2WalletDue))).toEqual(true);

        const paymentSplitterBalanceFinal: BigNumber = new BN(await web3.eth.getBalance(paymentSplitterAddress));
        expect(paymentSplitterBalanceFinal.eq(zeroBN)).toEqual(true);
      });
    });

    describe("Royalty NOT included", () => {
      beforeEach(async () => {
        saleParams = createClosedSaleParams(accountInfo, { totalRoyalty: 0 });
        nft = await Erc721.new(saleParams, { from: defaultSender });
        erc721Address = nft.address;
      });

      it("should withdraw into pricePayoutWallet correctly", async () => {
        expect(new BN(await nft.paymentSplittersCount())).toEqual(zeroBN);

        let contractBalanceInitial: BigNumber;
        let contractBalanceAfterMint: BigNumber;
        let contractBalanceAfterWithdraw: BigNumber;

        let ppwBalanceInitial: BigNumber;
        let ppwBalanceAfterMint: BigNumber;
        let ppwBalanceAfterWithdraw: BigNumber;

        contractBalanceInitial = new BN(await web3.eth.getBalance(nft.address));
        ppwBalanceInitial = new BN(await web3.eth.getBalance(accounts[IDX_PRICE_PAYOUT]));

        expect(contractBalanceInitial.eq(zeroBN)).toEqual(true);

        await mintTokensHelper();

        contractBalanceAfterMint = new BN(await web3.eth.getBalance(nft.address));
        ppwBalanceAfterMint = new BN(await web3.eth.getBalance(accounts[IDX_PRICE_PAYOUT]));

        expect(contractBalanceAfterMint.gt(zeroBN)).toEqual(true);
        expect(ppwBalanceInitial.eq(ppwBalanceAfterMint)).toEqual(true);

        const receipt = await nft.withdraw(multiSig, { from: accounts[IDX_FINANCE_ADMIN_1] });

        contractBalanceAfterWithdraw = new BN(await web3.eth.getBalance(nft.address));
        ppwBalanceAfterWithdraw = new BN(await web3.eth.getBalance(accounts[IDX_PRICE_PAYOUT]));

        expect(contractBalanceAfterWithdraw.eq(zeroBN)).toEqual(true);
        expect(ppwBalanceAfterWithdraw.eq(ppwBalanceInitial.add(contractBalanceAfterMint))).toEqual(true);
      });
    });
  });

  async function mintTokensHelper(tokenCount = 1) {
    await nft.toggleSaleState(multiSig, { from: defaultSender });

    let nonce = 1;
    let value = ethers.utils.parseEther("0.001").mul(tokenCount);
    let voucherParam = await createVoucher(nonce, tokenCount, buyer1);
    await nft.mintTokens(tokenCount, voucherParam, {
      from: buyer1,
      value,
    });
  }

  async function createVoucher(nonce: number, tokenCount: number, buyer: string) {
    const now_Minus_1Hr = new Date(Date.now());
    now_Minus_1Hr.setHours(-1);
    const issueTime = Math.floor(now_Minus_1Hr.valueOf() / 1000); // NowMinus1Hr in seconds,
    const expirationDuration = 2 * 24 * 60 * 60; // 2 Days in seconds
    const pricePerToken = ethers.utils.parseEther("0.001");

    const payload = createMintTokensPayload(
      erc721Address,
      chainId,
      nonce,
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );
    const voucherParam = await createMintTokensVoucherParam(
      payload,
      nonce,
      IDX_VOUCHER_SIGNER_1,
      buyer,
      issueTime,
      expirationDuration,
      pricePerToken.toString()
    );
    return voucherParam;
  }
});
