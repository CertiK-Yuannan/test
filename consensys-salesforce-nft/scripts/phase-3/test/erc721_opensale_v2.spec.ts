const {
  BN,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  constants,
} = require("@openzeppelin/test-helpers");
import { accounts, contract, privateKeys } from "@openzeppelin/test-environment";
import { ethers } from "ethers";
import {
  IDX_CONTRACT_ADMIN_1,
  Account,
  getAccountsFromArray,
  IDX_BUYER_1,
  IDX_BUYER_2,
  IDX_BUYER_3,
  IDX_VOUCHER_SIGNER_1,
} from "../accounts";
import { ERC721_OS_V2, OpenSaleParams } from "../common";

import { createOpenSaleParams, multiSigParam } from "../erc721_params";
import {
  createPayload as createMintTokenPayload,
  createVoucherParam as createMintTokenVoucherParam,
} from "../payload_voucher/mint_token";

const Erc721 = contract.fromArtifact(ERC721_OS_V2);

describe(ERC721_OS_V2, () => {
  let nft: any;
  let erc721Address: string;
  let saleParams: OpenSaleParams;
  let defaultSender = accounts[IDX_CONTRACT_ADMIN_1];
  let chainId = 1;
  let multiSig = multiSigParam();
  const accountInfo: Account[] = getAccountsFromArray(accounts, privateKeys);
  let buyer1 = accountInfo[IDX_BUYER_1].address;
  let buyer2 = accountInfo[IDX_BUYER_2].address;
  let buyer3 = accountInfo[IDX_BUYER_3].address;

  beforeEach(async () => {
    saleParams = createOpenSaleParams(accountInfo);
    nft = await Erc721.new(saleParams, { from: defaultSender });
    erc721Address = nft.address;
  });

  it("should create NFT contract", () => {
    expect(nft).toBeTruthy();
  });

  describe("Public minting", () => {
    let override: any;
    beforeAll(() => {
      override = {
        maxSupply: 3,
        maxTokensPerWallet: 2,
      };
    });

    beforeEach(async () => {
      const params = createOpenSaleParams(accountInfo, override);
      nft = await Erc721.new(params, { from: defaultSender });
      erc721Address = nft.address;

      //  Activate Sale for all these UnitTests
      await nft.toggleSaleState(multiSig, { from: defaultSender });
    });

    it("should fail if sale is not activated", async () => {
      await nft.toggleSaleState(multiSig, { from: defaultSender }); // Deactivate Sale

      let nonce = 1;
      let tokenId = 0;
      let value = ethers.utils.parseEther("0.001");
      let voucherParam = await await createVoucher(nonce, tokenId, buyer1);
      await expectRevert(
        nft.mintToken(tokenId, voucherParam, {
          from: buyer1,
          value: value,
        }),
        "15"
      );
    });

    it("should fail if msg.sender is a Contract address", async () => {
      const nonce = 1;
      let tokenId = 0;
      const value = ethers.utils.parseEther("0.001");
      const voucherParam = await createVoucher(nonce, tokenId, erc721Address);
      await expectRevert(
        nft.mintToken(tokenId, voucherParam, {
          from: erc721Address,
          value: value,
        }),
        "16"
      );
    });

    it("should fail if exceeding maxSupply", async () => {
      // maxSupply = 3;
      let nonce = 1;
      let tokenId = 0;
      let value = ethers.utils.parseEther("0.001");
      let voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      });

      nonce = 2;
      tokenId = 1;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer2);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer2,
        value,
      });

      nonce = 3;
      tokenId = 2;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer3);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer3,
        value,
      });
      //  Maxed out now

      nonce = 4;
      tokenId = 3;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer3);
      await expectRevert(
        nft.mintToken(tokenId, voucherParam, {
          from: buyer3,
          value,
        }),
        "17"
      );
    });

    it("should fail if exceeding maxTokensPerWallet", async () => {
      // maxTokensPerWallet: 2
      let nonce = 1;
      let tokenId = 0;
      let value = ethers.utils.parseEther("0.001");
      let voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      });

      nonce = 2;
      tokenId = 1;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      });
      //  Maxed out now

      nonce = 3;
      tokenId = 2;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await expectRevert(
        nft.mintToken(tokenId, voucherParam, {
          from: buyer1,
          value: value,
        }),
        "19"
      );
    });

    it("should fail if tokenId already exists", async () => {
      let nonce = 1;
      let tokenId = 0;
      let value = ethers.utils.parseEther("0.001");
      let voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      });

      nonce = 2;
      tokenId = 1;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer2);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer2,
        value,
      });

      nonce = 3;
      tokenId = 1;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer3);
      await expectRevert(
        nft.mintToken(tokenId, voucherParam, {
          from: buyer3,
          value: value,
        }),
        "ERC721: token already minted"
      );
    });

    it("minting should fail if tokenId is out of range", async () => {
      //  maxSupply = 3
      //  valid range = 0,1,2

      let nonce = 1;
      let tokenId = 0;
      let value = ethers.utils.parseEther("0.001");
      let voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      });

      nonce = 2;
      tokenId = 1;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer2);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer2,
        value,
      });

      nonce = 3;
      tokenId = 3;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await expectRevert(
        nft.mintToken(tokenId, voucherParam, {
          from: buyer1,
          value: value,
        }),
        "26"
      );
    });

    it("should succeed if all conditions are ok", async () => {
      let nonce = 1;
      let tokenId = 0;
      let value = ethers.utils.parseEther("0.001");
      let voucherParam = await createVoucher(nonce, tokenId, buyer1);
      const receipt = await nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      });

      expectEvent(receipt, "Transfer", {
        from: constants.ZERO_ADDRESS,
        to: buyer1,
        tokenId: new BN(tokenId),
      });
    });

    it("should update `totalSupply()` on successful minting", async () => {
      expect((await nft.totalSupply()).toNumber()).toEqual(0);

      let nonce = 1;
      let tokenId = 0;
      let value = ethers.utils.parseEther("0.001");
      let voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      });

      expect((await nft.totalSupply()).toNumber()).toEqual(1);
    });

    it("should reflect correct balance for minting address", async () => {
      let nonce = 1;
      let tokenId = 0;
      let value = ethers.utils.parseEther("0.001");
      let voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      });

      expect((await nft.balanceOf(buyer1)).toString()).toEqual(new BN(1).toString());
    });

    it("should fail when paused", async () => {
      await nft.togglePauseState(multiSig, { from: defaultSender });

      let nonce = 1;
      let tokenId = 0;
      let value = ethers.utils.parseEther("0.001");
      let voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await expectRevert(
        nft.mintToken(tokenId, voucherParam, {
          from: buyer1,
          value: value,
        }),
        "Pausable: paused"
      );
    });
  });

  describe("TokenURI", () => {
    beforeEach(async () => {
      await nft.toggleSaleState(multiSig, { from: defaultSender });
    });

    it("should return the correct URI for a TokenId", async () => {
      const baseURI = saleParams.baseURI;
      let tokenURI;

      let nonce = 1;
      let tokenId = 0;
      let value = ethers.utils.parseEther("0.001");
      let voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      });
      tokenURI = await nft.tokenURI(tokenId);
      expect(tokenURI).toEqual(`${baseURI}${tokenId}`);

      nonce = 2;
      tokenId = 1;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer2);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer2,
        value,
      });
      tokenURI = await nft.tokenURI(tokenId);
      expect(tokenURI).toEqual(`${baseURI}${tokenId}`);

      nonce = 3;
      tokenId = 2;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer3);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer3,
        value,
      });
      tokenURI = await nft.tokenURI(tokenId);
      expect(tokenURI).toEqual(`${baseURI}${tokenId}`);
    });

    it("should accept only valid tokenIds", async () => {
      let nonce = 1;
      let tokenId = 0;
      let value = ethers.utils.parseEther("0.001");
      let voucherParam = await createVoucher(nonce, tokenId, buyer1);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer1,
        value,
      });

      nonce = 2;
      tokenId = 1;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer2);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer2,
        value,
      });

      nonce = 3;
      tokenId = 2;
      value = ethers.utils.parseEther("0.001");
      voucherParam = await createVoucher(nonce, tokenId, buyer3);
      await nft.mintToken(tokenId, voucherParam, {
        from: buyer3,
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

  async function createVoucher(nonce: number, tokenId: number, buyer: string) {
    const now_Minus_1Hr = new Date(Date.now());
    now_Minus_1Hr.setHours(-1);
    const issueTime = Math.floor(now_Minus_1Hr.valueOf() / 1000); // NowMinus1Hr in seconds,
    const expirationDuration = 2 * 24 * 60 * 60; // 2 Days in seconds
    const pricePerToken = ethers.utils.parseEther("0.001");

    const payload = createMintTokenPayload(
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
    return voucherParam;
  }
});
