const {
  BN,
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
import { accounts, contract, privateKeys, web3 } from "@openzeppelin/test-environment";
import { constants } from "ethers";
import {
  IDX_CONTRACT_ADMIN_1,
  Account,
  getAccountsFromArray,
  IDX_PRICE_PAYOUT,
  CONTRACT_ADMIN_ROLE,
  IDX_CONTRACT_ADMIN_2,
  IDX_FINANCE_ADMIN_1,
  IDX_RANDOM_1,
  IDX_CONTRACT_ADMIN_3,
  IDX_CONTRACT_ADMIN_4,
  FINANCE_ADMIN_ROLE,
  IDX_FINANCE_ADMIN_2,
  IDX_FINANCE_ADMIN_3,
  IDX_FINANCE_ADMIN_4,
  VOUCHER_SIGNER_ROLE,
  IDX_VOUCHER_SIGNER_1,
  IDX_VOUCHER_SIGNER_2,
  IDX_VOUCHER_SIGNER_3,
  IDX_VOUCHER_SIGNER_4,
  IDX_BUYER_1,
  IDX_BUYER_2,
  IDX_RANDOM_2,
} from "../accounts";
import { ERC721_SALE_TEST, SaleParams, IERC2981, IERC721, IERC721Metadata } from "../common";

import { createClosedSaleParams, multiSigParam, roleRoyaltyPayout } from "../erc721_params";

const Erc721 = contract.fromArtifact(ERC721_SALE_TEST);

describe(ERC721_SALE_TEST, () => {
  let nft: any;
  let saleParams: SaleParams;
  let defaultSender = accounts[IDX_CONTRACT_ADMIN_1];
  let multiSig = multiSigParam();
  const accountInfo: Account[] = getAccountsFromArray(accounts, privateKeys);

  beforeEach(async () => {
    saleParams = createClosedSaleParams(accountInfo);
    nft = await Erc721.new(saleParams, { from: defaultSender });
  });

  it("should create NFT contract", () => {
    expect(nft).toBeTruthy();
  });

  describe("Contract Creation", () => {
    it("should initialize correctly", async () => {
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

    it("should support interfaces", async () => {
      let supportsInterface;

      supportsInterface = await nft.supportsInterface(IERC2981);
      expect(supportsInterface).toEqual(true);

      supportsInterface = await nft.supportsInterface(IERC721);
      expect(supportsInterface).toEqual(true);

      supportsInterface = await nft.supportsInterface(IERC721Metadata);
      expect(supportsInterface).toEqual(true);
    });

    describe("Constructor Params", () => {
      it("should accept a valid `name`", async () => {
        const params = createClosedSaleParams(accountInfo, { name: "an-nft" });
        nft = await Erc721.new(params, { from: defaultSender });
        expect(nft).not.toBeNull();
      });

      it("should reject an empty `name`", async () => {
        const params = createClosedSaleParams(accountInfo, { name: "" });
        await expectRevert(Erc721.new(params, { from: defaultSender }), "01");
      });

      it("should accept a valid `baseURI`", async () => {
        const params = createClosedSaleParams(accountInfo, { baseURI: "baseURI" });
        nft = await Erc721.new(params, { from: defaultSender });
        expect(nft).not.toBeNull();
      });

      it("should reject an empty `baseURI`", async () => {
        const params = createClosedSaleParams(accountInfo, { baseURI: "" });
        await expectRevert(Erc721.new(params, { from: defaultSender }), "02");
      });

      it("should accept a valid `maxSupply`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 10 });
        nft = await Erc721.new(params, { from: defaultSender });
        expect(nft).not.toBeNull();
      });

      it("should reject 0 `maxSupply`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 0 });
        await expectRevert(Erc721.new(params, { from: defaultSender }), "04");
      });

      it("should accept a valid `maxTokensPerWallet - min`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 10, maxTokensPerWallet: 1 });
        nft = await Erc721.new(params, { from: defaultSender });
        expect(nft).not.toBeNull();
      });

      it("should accept a valid `maxTokensPerWallet - between min/max`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 10, maxTokensPerWallet: 7 });
        nft = await Erc721.new(params, { from: defaultSender });
        expect(nft).not.toBeNull();
      });

      it("should accept a valid `maxTokensPerWallet - max`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 10, maxTokensPerWallet: 10 });
        nft = await Erc721.new(params, { from: defaultSender });
        expect(nft).not.toBeNull();
      });

      it("should reject an invalid `maxTokensPerWallet - 0`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 10, maxTokensPerWallet: 0 });
        await expectRevert(Erc721.new(params, { from: defaultSender }), "06");
      });

      it("should reject an invalid `maxTokensPerWallet - > maxSupply`", async () => {
        const params = createClosedSaleParams(accountInfo, { maxSupply: 10, maxTokensPerWallet: 11 });
        await expectRevert(Erc721.new(params, { from: defaultSender }), "06");
      });

      it("should reject an invalid `pricePayoutWallet`", async () => {
        const params = createClosedSaleParams(accountInfo, { pricePayoutWallet: constants.AddressZero });
        await expectRevert(Erc721.new(params, { from: defaultSender }), "21");
      });

      it("should accept a valid `pricePayoutWallet`", async () => {
        const params = createClosedSaleParams(accountInfo, { pricePayoutWallet: accounts[IDX_PRICE_PAYOUT] });
        expect(nft).not.toBeNull();
      });

      it("should accept a valid `roles and roleAddresses`", async () => {
        const params = createClosedSaleParams(accountInfo, {
          roles: [CONTRACT_ADMIN_ROLE],
          roleAddresses: [accounts[IDX_CONTRACT_ADMIN_2]],
        });
        nft = await Erc721.new(params, { from: defaultSender });
        expect(nft).not.toBeNull();
      });

      it("should reject a mismatch in `roles and roleAddresses counts`", async () => {
        const params = createClosedSaleParams(accountInfo, {
          roles: [CONTRACT_ADMIN_ROLE],
          roleAddresses: [accounts[IDX_CONTRACT_ADMIN_2], accounts[IDX_FINANCE_ADMIN_1]],
        });
        await expectRevert(Erc721.new(params, { from: defaultSender }), "08");
      });

      it("should reject empty `roles`", async () => {
        const params = createClosedSaleParams(accountInfo, { roles: [], roleAddresses: [] });
        await expectRevert(Erc721.new(params, { from: defaultSender }), "08");
      });
    });
  });

  describe("ERC2981", () => {
    it("should calculate royalty correctly", async () => {
      // totalRoyalty: 2500 ~  25%
      const royalty = await nft.royaltyInfo(1, web3.utils.toWei("1.0"));
      const paymentAddress = royalty[0];
      const paymentAmount = royalty[1];

      expect(paymentAmount.toString()).toEqual(web3.utils.toWei("0.25"));
      expect(paymentAddress).toEqual(await nft.paymentSplittersHistory(0));
    });
  });

  describe("Toggle Sale State", () => {
    it("should toggle state", async () => {
      let state = await nft.isSaleActive();
      expect(state).toEqual(false);

      await nft.toggleSaleState(multiSig, { from: defaultSender });
      state = await nft.isSaleActive();
      expect(state).toEqual(true);
    });

    it("should raise an event on toggling", async () => {
      const receipt = await nft.toggleSaleState(multiSig, { from: defaultSender });
      expectEvent(receipt, "SaleActiveChanged");
    });

    it("should pass when called by CONTRACT_ADMIN_ROLE", async () => {
      const isSaleActive = await nft.isSaleActive();
      let receipt = await nft.toggleSaleState(multiSig, { from: accounts[IDX_CONTRACT_ADMIN_2] });
      expectEvent(receipt, "SaleActiveChanged", { isSaleActive: !isSaleActive });
    });

    it("should fail when called by non-CONTRACT_ADMIN_ROLE", async () => {
      await expectRevert.unspecified(nft.toggleSaleState(multiSig, { from: accounts[IDX_RANDOM_1] }));
    });

    it("should fail when paused", async () => {
      await nft.togglePauseState(multiSig, { from: defaultSender });
      await expectRevert(nft.toggleSaleState(multiSig, { from: defaultSender }), "Pausable: paused");
    });
  });

  describe("Toggle Pause State", () => {
    it("should toggle state", async () => {
      let state = await nft.paused();
      expect(state).toEqual(false);

      await nft.togglePauseState(multiSig, { from: defaultSender });
      state = await nft.paused();
      expect(state).toEqual(true);
    });

    it("should raise an event on toggling", async () => {
      const receipt = await nft.togglePauseState(multiSig, { from: defaultSender });
      expectEvent(receipt, "Paused");
    });

    it("should pass when called by CONTRACT_ADMIN_ROLE", async () => {
      const receipt = await nft.togglePauseState(multiSig, { from: accounts[IDX_CONTRACT_ADMIN_2] });
      expectEvent(receipt, "Paused");
    });

    it("should fail when called by non CONTRACT_ADMIN_ROLE", async () => {
      await expectRevert.unspecified(nft.togglePauseState(multiSig, { from: accounts[IDX_FINANCE_ADMIN_1] }));
    });
  });

  describe("Adding PaymentSplitter", () => {
    it("should not create PaymentSplitter if totalRoyalty = 0", async () => {
      const params = createClosedSaleParams(accountInfo, { totalRoyalty: 0 });
      nft = await Erc721.new(params, { from: defaultSender });
      expect((await nft.paymentSplittersCount()).toNumber()).toEqual(0);
    });
  });

  describe("AccessControl", () => {
    describe("Set up Access Control correctly", () => {
      it("should add deployer to CONTRACT_ADMIN_ROLE", async () => {
        const rec = await Erc721.new(saleParams, { from: defaultSender });
        const hasRole = await nft.hasRole(CONTRACT_ADMIN_ROLE, defaultSender);
        expect(hasRole).toEqual(true);
      });

      it("should process the input param roles/addresses correctly", async () => {
        expect(await nft.hasRole(CONTRACT_ADMIN_ROLE, accounts[IDX_CONTRACT_ADMIN_1])).toEqual(true);
        expect(await nft.hasRole(CONTRACT_ADMIN_ROLE, accounts[IDX_CONTRACT_ADMIN_2])).toEqual(true);
        expect(await nft.hasRole(CONTRACT_ADMIN_ROLE, accounts[IDX_CONTRACT_ADMIN_3])).toEqual(true);
        expect(await nft.hasRole(CONTRACT_ADMIN_ROLE, accounts[IDX_CONTRACT_ADMIN_4])).toEqual(true);

        expect(await nft.hasRole(FINANCE_ADMIN_ROLE, accounts[IDX_FINANCE_ADMIN_1])).toEqual(true);
        expect(await nft.hasRole(FINANCE_ADMIN_ROLE, accounts[IDX_FINANCE_ADMIN_2])).toEqual(true);
        expect(await nft.hasRole(FINANCE_ADMIN_ROLE, accounts[IDX_FINANCE_ADMIN_3])).toEqual(true);
        expect(await nft.hasRole(FINANCE_ADMIN_ROLE, accounts[IDX_FINANCE_ADMIN_4])).toEqual(true);

        expect(await nft.hasRole(VOUCHER_SIGNER_ROLE, accounts[IDX_VOUCHER_SIGNER_1])).toEqual(true);
        expect(await nft.hasRole(VOUCHER_SIGNER_ROLE, accounts[IDX_VOUCHER_SIGNER_2])).toEqual(true);
        expect(await nft.hasRole(VOUCHER_SIGNER_ROLE, accounts[IDX_VOUCHER_SIGNER_3])).toEqual(true);
        expect(await nft.hasRole(VOUCHER_SIGNER_ROLE, accounts[IDX_VOUCHER_SIGNER_4])).toEqual(true);
      });
    });
  });

  describe("Update Roles, Royalties, PricePayoutWallet", () => {
    let params = roleRoyaltyPayout(); //  Default empty values for Roles, Royalties, PricePayoutWallet

    function callUpdate(params: any, from: string) {
      return nft.updateRoleRoyaltyPayout(
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
          from,
        }
      );
    }

    it("should not update any info if empty values are passed in", async () => {
      const currentPricePayoutWallet = await nft.pricePayoutWallet();

      const receipt = await callUpdate(params, defaultSender);

      expectEvent(receipt, "UpdatedRoleRoyaltyPricePayout");
      expect((await nft.paymentSplittersCount()).toNumber()).toEqual(1); //  Does not increse from default
      expect(await nft.pricePayoutWallet()).toEqual(currentPricePayoutWallet);
    });

    describe("Update Roles", () => {
      it("should fail if grantRroles and grantRoleAddresses are mismatched", async () => {
        const grantRoles: string[] = [FINANCE_ADMIN_ROLE];
        const grantRoleAddresses: string[] = [accounts[IDX_BUYER_1], accounts[IDX_BUYER_2]];
        const revokeRoles: string[] = [];
        const revokeRoleAddresses: string[] = [];
        params = {
          ...params,
          roles: { grantRoles, grantRoleAddresses, revokeRoles, revokeRoleAddresses },
        };

        await expectRevert(callUpdate(params, defaultSender), "08");
      });

      it("should fail if revokeRoles and revokeRoleAddresses are mismatched", async () => {
        const grantRoles: string[] = [];
        const grantRoleAddresses: string[] = [];
        const revokeRoles: string[] = [FINANCE_ADMIN_ROLE];
        const revokeRoleAddresses: string[] = [accounts[IDX_BUYER_1], accounts[IDX_BUYER_2]];
        params = {
          ...params,
          roles: { grantRoles, grantRoleAddresses, revokeRoles, revokeRoleAddresses },
        };

        await expectRevert(callUpdate(params, defaultSender), "08");
      });

      it("should update grants even when revokes are not provided", async () => {
        const grantRoles: string[] = [FINANCE_ADMIN_ROLE];
        const grantRoleAddresses: string[] = [accounts[IDX_BUYER_1]];
        const revokeRoles: string[] = [];
        const revokeRoleAddresses: string[] = [];
        params = {
          ...params,
          roles: { grantRoles, grantRoleAddresses, revokeRoles, revokeRoleAddresses },
        };

        const receipt = await callUpdate(params, defaultSender);
        expectEvent(receipt, "RoleGranted");
      });

      it("should update revokes even when grants are not provided", async () => {
        //  Grant Role first and then attempt to Revoke.
        let grantRoles: string[] = [FINANCE_ADMIN_ROLE];
        let grantRoleAddresses: string[] = [accounts[IDX_BUYER_1]];
        let revokeRoles: string[] = [];
        let revokeRoleAddresses: string[] = [];
        params = {
          ...params,
          roles: { grantRoles, grantRoleAddresses, revokeRoles, revokeRoleAddresses },
        };
        await callUpdate(params, defaultSender);

        grantRoles = [];
        grantRoleAddresses = [];
        revokeRoles = [FINANCE_ADMIN_ROLE];
        revokeRoleAddresses = [accounts[IDX_BUYER_1]];
        params = {
          ...params,
          roles: { grantRoles, grantRoleAddresses, revokeRoles, revokeRoleAddresses },
        };

        const receipt = await callUpdate(params, defaultSender);
        expectEvent(receipt, "RoleRevoked");
      });

      it("should update grants and revokes when both are provided", async () => {
        const grantRoles: string[] = [FINANCE_ADMIN_ROLE];
        const grantRoleAddresses: string[] = [accounts[IDX_BUYER_1]];
        const revokeRoles: string[] = [FINANCE_ADMIN_ROLE];
        const revokeRoleAddresses: string[] = [accounts[IDX_BUYER_1]];
        params = {
          ...params,
          roles: { grantRoles, grantRoleAddresses, revokeRoles, revokeRoleAddresses },
        };

        const receipt = await callUpdate(params, defaultSender);
        expectEvent(receipt, "RoleGranted");
        expectEvent(receipt, "RoleRevoked");
      });

      it("should update when called by a CONTRACT_ADMIN_ROLE", async () => {
        const grantRoles: string[] = [FINANCE_ADMIN_ROLE];
        const grantRoleAddresses: string[] = [accounts[IDX_BUYER_1]];
        const revokeRoles: string[] = [FINANCE_ADMIN_ROLE];
        const revokeRoleAddresses: string[] = [accounts[IDX_BUYER_1]];
        params = {
          ...params,
          roles: { grantRoles, grantRoleAddresses, revokeRoles, revokeRoleAddresses },
        };

        const receipt = await callUpdate(params, accounts[IDX_CONTRACT_ADMIN_2]);
        expectEvent(receipt, "RoleGranted");
        expectEvent(receipt, "RoleRevoked");
      });

      it("should fail when called by a non CONTRACT_ADMIN_ROLE", async () => {
        const grantRoles: string[] = [FINANCE_ADMIN_ROLE];
        const grantRoleAddresses: string[] = [accounts[IDX_BUYER_1]];
        const revokeRoles: string[] = [FINANCE_ADMIN_ROLE];
        const revokeRoleAddresses: string[] = [accounts[IDX_BUYER_1]];
        params = {
          ...params,
          roles: { grantRoles, grantRoleAddresses, revokeRoles, revokeRoleAddresses },
        };

        await expectRevert.unspecified(callUpdate(params, accounts[IDX_FINANCE_ADMIN_1]));
      });

      it("should fail when paused", async () => {
        await nft.togglePauseState(multiSig, { from: defaultSender });

        const grantRoles: string[] = [FINANCE_ADMIN_ROLE];
        const grantRoleAddresses: string[] = [accounts[IDX_BUYER_1]];
        const revokeRoles: string[] = [FINANCE_ADMIN_ROLE];
        const revokeRoleAddresses: string[] = [accounts[IDX_BUYER_1]];
        params = {
          ...params,
          roles: { grantRoles, grantRoleAddresses, revokeRoles, revokeRoleAddresses },
        };
        await expectRevert(callUpdate(params, defaultSender), "Pausable: paused");
      });
    });

    describe("Update Royalties", () => {
      it("should add PaymentSplitter", async () => {
        params = {
          ...params,
          royalties: { totalRoyalty: saleParams.totalRoyalty, payees: saleParams.payees, shares: saleParams.shares },
        };

        const receipt = await callUpdate(params, defaultSender);

        expectEvent(receipt, "PaymentSplitterUpdated");
        expect((await nft.paymentSplittersCount()).toNumber()).toEqual(2);
        expect(await nft.paymentSplittersHistory(1)).not.toBeNull();
      });

      it("should ignore adding a PaymentSplitter if `totalRoyalty = 0` is passed in", async () => {
        params = {
          ...params,
          royalties: { totalRoyalty: 0, payees: saleParams.payees, shares: saleParams.shares },
        };

        const receipt = await callUpdate(params, defaultSender);

        expect((await nft.paymentSplittersCount()).toNumber()).toEqual(1); //  Does not increse from default
      });

      it("should fail if invalid `totalRoyalty - > 100` is passed in", async () => {
        params = {
          ...params,
          royalties: { totalRoyalty: 10001, payees: saleParams.payees, shares: saleParams.shares },
        };

        await expectRevert(callUpdate(params, defaultSender), "11");
      });

      it("should fail if mismatched payee/shares is passed in", async () => {
        params = {
          ...params,
          royalties: { totalRoyalty: saleParams.totalRoyalty, payees: saleParams.payees, shares: [] },
        };

        await expectRevert.unspecified(callUpdate(params, defaultSender));
      });

      it("should maintain history of added PaymentSplitters", async () => {
        expect((await nft.paymentSplittersCount()).toNumber()).toEqual(1); //  Initial Default

        params = {
          ...params,
          royalties: { totalRoyalty: saleParams.totalRoyalty, payees: saleParams.payees, shares: saleParams.shares },
        };

        await callUpdate(params, defaultSender);
        expect((await nft.paymentSplittersCount()).toNumber()).toEqual(2); //  Incremented by 1

        await callUpdate(params, defaultSender);
        expect((await nft.paymentSplittersCount()).toNumber()).toEqual(3); //  Incremented by 1

        await callUpdate(params, defaultSender);
        expect((await nft.paymentSplittersCount()).toNumber()).toEqual(4); //  Incremented by 1
      });

      it("should fail when paused", async () => {
        params = {
          ...params,
          royalties: { totalRoyalty: saleParams.totalRoyalty, payees: saleParams.payees, shares: saleParams.shares },
        };

        await nft.togglePauseState(multiSig, { from: defaultSender });

        await expectRevert(callUpdate(params, defaultSender), "Pausable: paused");
      });

      it("should pass when called by CONTRACT_ADMIN_ROLE", async () => {
        params = {
          ...params,
          royalties: { totalRoyalty: saleParams.totalRoyalty, payees: saleParams.payees, shares: saleParams.shares },
        };

        const receipt = await callUpdate(params, accounts[IDX_CONTRACT_ADMIN_2]);

        expectEvent(receipt, "PaymentSplitterUpdated");
      });

      it("should fail when called by non CONTRACT_ADMIN_ROLE", async () => {
        params = {
          ...params,
          royalties: { totalRoyalty: saleParams.totalRoyalty, payees: saleParams.payees, shares: saleParams.shares },
        };

        await expectRevert.unspecified(callUpdate(params, accounts[IDX_FINANCE_ADMIN_1]));
      });
    });

    describe("Update PricePayoutWallet", () => {
      it("should fail when more than one Price Payout Wallet is passed in", async () => {
        params = {
          ...params,
          pricePayoutWallets: [accounts[IDX_RANDOM_1], accounts[IDX_RANDOM_2]],
        };

        await expectRevert(callUpdate(params, defaultSender), "08");
      });

      it("should fail when an invalid Price Payout Wallet is passed in", async () => {
        params = {
          ...params,
          pricePayoutWallets: [constants.AddressZero],
        };

        await expectRevert(callUpdate(params, defaultSender), "21");
      });

      it("should ignore updating the Wallet if no wallet is passed in", async () => {
        const currentPricePayoutWallet = await nft.pricePayoutWallet();

        params = {
          ...params,
          pricePayoutWallets: [],
        };

        const receipt = await callUpdate(params, defaultSender);
        expect(await nft.pricePayoutWallet()).toEqual(currentPricePayoutWallet);
      });

      it("should pass when called by CONTRACT_ADMIN_ROLE", async () => {
        params = {
          ...params,
          pricePayoutWallets: [accounts[IDX_RANDOM_1]],
        };

        const receipt = await callUpdate(params, accounts[IDX_CONTRACT_ADMIN_2]);

        expectEvent(receipt, "UpdatedRoleRoyaltyPricePayout");
        expect(await nft.pricePayoutWallet()).toEqual(accounts[IDX_RANDOM_1]);
      });

      it("should fail when called by non CONTRACT_ADMIN_ROLE", async () => {
        params = {
          ...params,
          pricePayoutWallets: [],
        };

        await expectRevert.unspecified(callUpdate(params, accounts[IDX_FINANCE_ADMIN_1]));
      });

      it("should fail when paused", async () => {
        params = {
          ...params,
          pricePayoutWallets: [accounts[IDX_RANDOM_1]],
        };

        await nft.togglePauseState(multiSig, { from: defaultSender });
        await expectRevert(callUpdate(params, defaultSender), "Pausable: paused");
      });
    });
  });

  describe("Multisig Nonce", () => {
    it("should fail if called by a non CONTRACT_ADMIN_ROLE", async () => {
      await expectRevert.unspecified(nft.markMultisigNonceUsed(1, { from: accounts[IDX_FINANCE_ADMIN_1] }));
    });

    it("should succeed if called by a CONTRACT_ADMIN_ROLE", async () => {
      await nft.markMultisigNonceUsed(1, { from: accounts[IDX_CONTRACT_ADMIN_2] });
    });
  });
});
