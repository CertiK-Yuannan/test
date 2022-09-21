const {
  BN,
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  constants,
} = require('@openzeppelin/test-helpers');

const { createParams } = require("./common.js");
const Erc721V1 = artifacts.require('Erc721V1');
const PayoutSplitter = artifacts.require('PayoutSplitterV1');

//  ERC165 InterfaceIds
const IERC2981 = "0x2a55205a";
const IERC721 = "0x80ac58cd";
const IERC721Metadata = "0x5b5e139f";
const IERC721Enumerable = "0x780e9d63";
const NEW_BASE_URI = "http://ipfs.io/ipfs/new-base-uri/";

contract('Erc721V1', async accounts => {
  describe("", () => {
    let nft;
    let params;

    beforeEach(async () => {
      params = createParams(accounts);
      nft = await Erc721V1.new(params);
    });

    it("should be initialized correctly", async () => {
      assert.equal(await nft.name(), params.name);
      assert.equal(await nft.symbol(), params.symbol);
      assert.equal(await nft.baseURI(), params.baseURI);
      assert.equal(await nft.contractURI(), params.contractURI);
      assert.equal(await nft.provenance(), params.provenance);
      assert.equal(await nft.pricePerToken(), params.pricePerToken);
      assert.equal((await nft.maxSupply()).toNumber(), params.maxSupply);
      assert.equal((await nft.maxTokensPerWallet()).toNumber(), params.maxTokensPerWallet);
      assert.equal((await nft.maxTokensPerTxn()).toNumber(), params.maxTokensPerTxn);
      assert.equal((await nft.totalSupply()).toNumber(), 0);
      assert.equal(await nft.isRevealed(), params.isRevealed);

      assert.equal(await nft.paused(), false);
      assert.equal((await web3.eth.getBalance(nft.address)).toString(), new BN(0).toString());
      assert.equal((await nft.payoutSplittersCount()).toNumber(), 1);
    });

    it("should support interfaces", async () => {
      let supportsInterface;

      supportsInterface = await nft.supportsInterface(IERC2981);
      assert.equal(supportsInterface, true);

      supportsInterface = await nft.supportsInterface(IERC721);
      assert.equal(supportsInterface, true);

      supportsInterface = await nft.supportsInterface(IERC721Metadata);
      assert.equal(supportsInterface, true);

      supportsInterface = await nft.supportsInterface(IERC721Enumerable);
      assert.equal(supportsInterface, true);
    });

    describe("Erc721V1 Contract Validations", async () => {
      it("should reject empty `name`", async () => {
        const params = createParams(accounts, { name: "" });

        await expectRevert(
          Erc721V1.new(params),
          "E001",
        );
      });

      it("should reject empty `baseURI`", async () => {
        const params = createParams(accounts, { baseURI: "" });

        await expectRevert(
          Erc721V1.new(params),
          "E002",
        );
      });

      it("should reject empty `provenance`", async () => {
        const params = createParams(accounts, { provenance: "" });

        await expectRevert(
          Erc721V1.new(params),
          "E003",
        );
      });

      it("should reject 0 `pricePerToken`", async () => {
        const params = createParams(accounts, { pricePerToken: 0 });

        await expectRevert(
          Erc721V1.new(params),
          "E005",
        );
      });

      it("should reject 0 `maxSupply`", async () => {
        const params = createParams(accounts, { maxSupply: 0 });

        await expectRevert(
          Erc721V1.new(params),
          "E004",
        );
      });

      it("should reject incorrect `maxTokenPerWallet`", async () => {
        const params = createParams(accounts, { maxTokensPerWallet: 15 });

        await expectRevert(
          Erc721V1.new(params),
          "E006",
        );
      });

      it("should reject incorrect `maxTokensPerTxn`", async () => {
        const params = createParams(accounts, { maxTokensPerTxn: 15 });

        await expectRevert(
          Erc721V1.new(params),
          "E007",
        );
      });

      it("should reject mismatch in `roles` and `roleAddresses", async () => {
        const params = createParams(accounts, { roles: [] });

        await expectRevert(
          Erc721V1.new(params),
          "E008",
        );
      });

      it("should reject empty `roles`", async () => {
        const params = createParams(accounts, { roles: [], roleAddresses: [] });

        await expectRevert(
          Erc721V1.new(params),
          "E009",
        );
      });
    });

    describe("PayoutSplitter", async () => {
      it("should not create PayoutSplitter if totalRoyalty = 0", async () => {
        params = createParams(accounts, { totalRoyalty: 0 });
        nft = await Erc721V1.new(params);

        assert.equal((await nft.payoutSplittersCount()).toNumber(), 0);
      });

      it("should add valid PayoutSplitter", async () => {
        params = createParams(accounts);

        assert.equal((await nft.payoutSplittersCount()).toNumber(), 1);
        const receipt = await nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares);
        assert.equal((await nft.payoutSplittersCount()).toNumber(), 2); //  Incremented by 1

        const oldPayoutSplitter = await nft.payoutSplittersHistory(0);
        const newPayoutSplitter = await nft.payoutSplittersHistory(1);

        expectEvent(receipt, "PayoutSplitterUpdated",
          { oldPayoutSplitter, newPayoutSplitter }
        );
      });

      it("should not add invalid PayoutSplitter - 0 totalRoyalty", async () => {
        params = createParams(accounts);

        assert.equal((await nft.payoutSplittersCount()).toNumber(), 1);
        await expectRevert(
          nft.addPayoutSplitter(0, params.payees, params.shares),
          "E011"
        );
        assert.equal((await nft.payoutSplittersCount()).toNumber(), 1); //  remains the same
      });

      it("should not add invalid PayoutSplitter - > 100% royalty", async () => {
        params = createParams(accounts, { totalRoyalty: 12000 });

        assert.equal((await nft.payoutSplittersCount()).toNumber(), 1);
        await expectRevert(
          nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares),
          "E012"
        );
        assert.equal((await nft.payoutSplittersCount()).toNumber(), 1); //  remains the same
      });

      it("should maintain history of added PayoutSplitters", async () => {
        params = createParams(accounts);

        assert.equal((await nft.payoutSplittersCount()).toNumber(), 1);

        await nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares);
        assert.equal((await nft.payoutSplittersCount()).toNumber(), 2); //  Incremented by 1

        await nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares);
        assert.equal((await nft.payoutSplittersCount()).toNumber(), 3); //  Incremented by 1

        await nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares);
        assert.equal((await nft.payoutSplittersCount()).toNumber(), 4); //  Incremented by 1
      });
    });

    describe("ERC2981", async () => {
      it("should calculate royalty correctly", async () => {
        params = createParams(accounts, { totalRoyalty: 2500 });  //  25%
        await nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares);

        const royalty = await nft.royaltyInfo(1, web3.utils.toWei("1.0"));
        const payoutAddress = royalty[0];
        const payoutAmount = royalty[1];

        assert.equal(payoutAmount, web3.utils.toWei("0.25"));
      });
    });

    describe("AccessControl", async () => {
      let deployerAcct;
      let defaultAdminRole;
      let deployerRole;
      let minterRole;
      let withdrawRole;
      let roleAndAddress;

      before(async () => {
        deployerAcct = accounts[0];
        defaultAdminRole = await nft.DEFAULT_ADMIN_ROLE();
        deployerRole = await nft.DEPLOYER_ROLE();
        minterRole = await nft.MINTER_ROLE();
        withdrawRole = await nft.WITHDRAW_ROLE();

        roleAndAddress = createRoleAndAddress([
          [defaultAdminRole, accounts[2]],
          [deployerRole, accounts[3]],
          [minterRole, accounts[4]],
          [withdrawRole, accounts[5]],
        ]);
      });

      beforeEach(async () => {
        params = createParams(accounts, roleAndAddress);
        const gasEstimate = await Erc721V1.new.estimateGas(params);
        nft = await Erc721V1.new(params, { gas: gasEstimate });
      });

      it("should add deployer to DEFAULT_ADMIN_ROLE", async () => {
        const hasRole = await nft.hasRole(defaultAdminRole, deployerAcct);
        assert.isTrue(hasRole)
      });

      it("should add deployer to DEPLOYER_ROLE", async () => {
        const hasRole = await nft.hasRole(deployerRole, deployerAcct);
        assert.isTrue(hasRole)
      });

      it("should process the input param roles/addresses correctly", async () => {
        assert.isTrue(await nft.hasRole(defaultAdminRole, accounts[2]));
        assert.isTrue(await nft.hasRole(deployerRole, accounts[3]));
        assert.isTrue(await nft.hasRole(minterRole, accounts[4]));
        assert.isTrue(await nft.hasRole(withdrawRole, accounts[5]));
      });

      it("should allow only deployerRole to call `addPayoutSplitter`", async () => {
        await nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares, { from: accounts[0] });
        assert.isTrue(true);

        await nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares, { from: accounts[3] });
        assert.isTrue(true);

        await expectRevert.unspecified(
          nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares, { from: accounts[4] }));

        await expectRevert.unspecified(
          nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares, { from: accounts[5] }));

        await expectRevert.unspecified(
          nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares, { from: accounts[6] }));
      });

      it("should allow defaultAdminRole only to call grantRole", async () => {
        const testAccount = accounts[7];
        //  accounts[0], accounts[2] belong to defaultAdminRole
        await nft.grantRole(deployerRole, testAccount, { from: accounts[0] });
        await nft.grantRole(deployerRole, testAccount, { from: accounts[2] });

        await expectRevert.unspecified(
          nft.grantRole(deployerRole, testAccount, { from: accounts[3] })
        );
        await expectRevert.unspecified(
          nft.grantRole(deployerRole, testAccount, { from: accounts[4] })
        );
      });

      it("should allow defaultAdminRole only to call revokeRole", async () => {
        const testAccount = accounts[7];
        //  accounts[0], accounts[2] belong to defaultAdminRole
        await nft.revokeRole(deployerRole, testAccount, { from: accounts[0] });
        await nft.revokeRole(deployerRole, testAccount, { from: accounts[2] });

        await expectRevert.unspecified(
          nft.revokeRole(deployerRole, testAccount, { from: accounts[3] })
        );
        await expectRevert.unspecified(
          nft.revokeRole(deployerRole, testAccount, { from: accounts[4] })
        );
      });

      it("should allow grant/revoke role/accounts", async () => {
        const testAccount = accounts[7];

        await expectRevert.unspecified(
          nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares, { from: testAccount }));

        //  grantRole/account ...
        await nft.grantRole(deployerRole, testAccount);
        //  ... and execute method - expect Sucess
        await nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares, { from: testAccount });
        assert.isTrue(true);

        //  revokeRole/account ...
        await nft.revokeRole(deployerRole, testAccount);
        //  ... and execute method - expect Failure
        await expectRevert.unspecified(
          nft.addPayoutSplitter(params.totalRoyalty, params.payees, params.shares, { from: testAccount }));
      });

      function createRoleAndAddress(params) {
        const roleAndAddresses = {
          roles: [],
          roleAddresses: []
        };

        for (i = 0; i < params.length; i++) {
          roleAndAddresses.roles.push(params[i][0]);
          roleAndAddresses.roleAddresses.push(params[i][1]);
        }

        return roleAndAddresses;
      }
    });

    describe("Sale Activities", async () => {
      it("`isSaleActive` should be false on deployment", async () => {
        assert.equal(await nft.isSaleActive(), false);
      });

      it("`toggleSaleState` should toggle isSaleState correctly", async () => {
        const isSaleActive = await nft.isSaleActive();

        let receipt = await nft.toggleSaleState();
        expectEvent(receipt, "SaleActiveChanged",
          { isSaleActive: !isSaleActive }
        );
        assert.equal(await nft.isSaleActive(), !isSaleActive);

        receipt = await nft.toggleSaleState();
        expectEvent(receipt, "SaleActiveChanged",
          { isSaleActive: isSaleActive }
        );
        assert.equal(await nft.isSaleActive(), isSaleActive);
      });

      it("`isRevealed` should be false on deployment", async () => {
        assert.equal(await nft.isRevealed(), false);
      });

      it("`revealSale` should fail if invalid baseURI is passed in", async () => {
        await expectRevert(nft.revealSale(""), "E002");
      });

      it("`revealSale` should work correctly", async () => {
        let receipt = await nft.revealSale(NEW_BASE_URI);
        expectEvent(receipt, "SaleRevealed", { isRevealed: true });
        assert.equal(await nft.isRevealed(), true);
      });

      it("`revealSale` should work only once", async () => {
        let receipt = await nft.revealSale(NEW_BASE_URI);
        expectEvent(receipt, "SaleRevealed", { isRevealed: true });
        assert.equal(await nft.isRevealed(), true); //  Works Once

        await expectRevert(
          nft.revealSale(NEW_BASE_URI), //  Fails when tried again
          "E014"
        );
      });

      it("`toggleState()` can only be called by deployer", async () => {
        const isSaleActive = await nft.isSaleActive();
        let receipt = await nft.toggleSaleState({ from: accounts[0] }); //  Deployer Address
        expectEvent(receipt, "SaleActiveChanged",
          { isSaleActive: !isSaleActive }
        );

        await expectRevert.unspecified(nft.toggleSaleState({ from: accounts[1] }));  //  Random Address
      });

      it("`revealSale()` can only be called by deployer", async () => {
        let receipt = await nft.revealSale(NEW_BASE_URI, { from: accounts[0] }); //  Deployer Address
        expectEvent(receipt, "SaleRevealed", { isRevealed: true });

        await expectRevert.unspecified(nft.revealSale(NEW_BASE_URI, { from: accounts[1] }));  //  Random Address
      });

      it("should not update pricePerToken if set to 0", async () => {
        await expectRevert(
          nft.setPricePerToken(0, { from: accounts[0] }),
          "E005"
        );
      });

      it("should not update pricePerToken if set to current pricePerToken", async () => {
        await expectRevert(
          nft.setPricePerToken(params.pricePerToken, { from: accounts[0] }),
          "E025"
        );
      });

      it("should update pricePerToken if new value is valid and called by address in DEPLOYER_ROLE", async () => {
        const newPricePerToken = web3.utils.toWei("0.05");
        const receipt = await nft.setPricePerToken(newPricePerToken, { from: accounts[0] });
        const actualPricePerToken = await nft.pricePerToken();

        expectEvent(receipt, "PricePerTokenUpdated",
          {
            sender: accounts[0],
            newPricePerToken
          }
        );
        assert.equal(newPricePerToken, actualPricePerToken);
      });

      it("should not update pricePerToken if called by address not in DEPLOYER_ROLE", async () => {
        const newPricePerToken = web3.utils.toWei("0.05");
        await expectRevert.unspecified(
          nft.setPricePerToken(newPricePerToken, { from: accounts[5] })
        );
      });
    });

    describe("Minting Tokens", async () => {
      let roleAndAddress;
      let buyerAddress;
      let buyerAddress2;
      let buyerAddress3;
      let override;
      let value;

      before(async () => {
        minterRole = await nft.MINTER_ROLE();
        minterAddress = accounts[4];
        buyerAddress = accounts[6];
        buyerAddress2 = accounts[7];
        buyerAddress3 = accounts[8];

        roleAndAddress = {
          roles: [minterRole],
          roleAddresses: [minterAddress]
        };

        override = {
          ...roleAndAddress,
        }
      });

      beforeEach(async () => {
        params = createParams(accounts, override);
        value = new BN(params.pricePerToken);
        const gasEstimate = await Erc721V1.new.estimateGas(params);
        nft = await Erc721V1.new(params, { gas: gasEstimate });
        await nft.toggleSaleState();
      });

      describe("Public Minting", async () => {
        it("minting should fail if tokenCount == 0", async () => {
          await expectRevert(
            nft.mintTokens(0, { from: buyerAddress, value: 0 }),
            "E020"
          );
        });

        it("minting should fail if isSaleActive==false", async () => {
          await nft.toggleSaleState();    //  Set isSaleActive = false
          await expectRevert(
            nft.mintTokens(1, { from: buyerAddress, value }),
            "E015"
          );
        });

        it("minting should fail if value passed in is greater than `pricePerToken`", async () => {
          const gtValue = web3.utils.toWei("0.09");
          await expectRevert(
            nft.mintTokens(1, { from: buyerAddress, value: gtValue }),
            "E022"
          );
        });

        it("minting should fail if value passed in is lesser than `pricePerToken`", async () => {
          const ltValue = web3.utils.toWei("0.07");
          await expectRevert(
            nft.mintTokens(1, { from: buyerAddress, value: ltValue }),
            "E022"
          );
        });

        it("minting should fail if purchasing multiple tokens, but value passed in is equal to 1 `pricePerToken`", async () => {
          await expectRevert(
            nft.mintTokens(2, { from: buyerAddress, value: value }),
            "E022"
          );
        });

        it("minting should fail if msg.sender is a Contract address", async () => {
          await expectRevert(
            nft.mintTokens(1, { from: nft.address, value }),
            "E016"
          );
        });

        it("minting should fail if exceeding maxSupply", async () => {
          // maxSupply = 10;        

          await nft.mintTokens(3, { from: buyerAddress, value: value.mul(new BN(3)) });
          await nft.mintTokens(2, { from: buyerAddress, value: value.mul(new BN(2)) });
          await nft.mintTokens(3, { from: buyerAddress2, value: value.mul(new BN(3)) });
          await nft.mintTokens(2, { from: buyerAddress3, value: value.mul(new BN(2)) });
          //  Maxed out now

          await expectRevert(
            nft.mintTokens(1, { from: buyerAddress3, value }),
            "E017"
          );
        });

        it("minting should fail if exceeding maxTokensPerTxn", async () => {
          await expectRevert(
            nft.mintTokens(4, { from: buyerAddress, value: value.mul(new BN(4)) }),
            "E018"
          );
        });

        it("minting should fail if exceeding maxTokensPerWallet", async () => {
          await expectRevert(
            nft.mintTokens(6, { from: buyerAddress, value: value.mul(new BN(6)) }),
            "E019"
          );
        });

        it("minting should succeed if all conditions are ok", async () => {
          const receipt = await nft.mintTokens(1, { from: buyerAddress, value });
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: buyerAddress, tokenId: new BN(0) }
          );
        });

        it("contract should accumulate money on successful mints", async () => {
          let balance = new BN(0);
          assert.equal(await web3.eth.getBalance(nft.address), balance);

          await nft.mintTokens(1, { from: buyerAddress, value });
          balance = balance.add(value);
          assert.equal(await web3.eth.getBalance(nft.address), balance);

          await nft.mintTokens(1, { from: buyerAddress, value });
          balance = balance.add(value);
          assert.equal(await web3.eth.getBalance(nft.address), balance);
        });

        it("minting should succeed multiple times on the same wallet if all conditions are ok", async () => {
          let receipt = await nft.mintTokens(1, { from: buyerAddress, value });
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: buyerAddress, tokenId: new BN(0) }
          );

          receipt = await nft.mintTokens(1, { from: buyerAddress, value });
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: buyerAddress, tokenId: new BN(1) }
          );

          receipt = await nft.mintTokens(1, { from: buyerAddress, value });
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: buyerAddress, tokenId: new BN(2) }
          );
        });

        it("batch minting should succeed if all conditions are ok", async () => {
          const receipt = await nft.mintTokens(3, { from: buyerAddress, value: value.mul(new BN(3)) });
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: buyerAddress, tokenId: new BN(0) }
          );
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: buyerAddress, tokenId: new BN(1) }
          );
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: buyerAddress, tokenId: new BN(2) }
          );
        });

        it("minting should fail if exceeding maxTokensPerWallet across multiple Txns", async () => {
          const receipt = await nft.mintTokens(2, { from: buyerAddress, value: value.mul(new BN(2)) });
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: buyerAddress, tokenId: new BN(0) }
          );
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: buyerAddress, tokenId: new BN(1) }
          );
          //  Maxed Out

          await expectRevert(
            nft.mintTokens(4, { from: buyerAddress, value: value.mul(new BN(4)) }),
            "E019"
          );
        });

        it("`totalSupply()` is updated on successful minting", async () => {
          assert.equal((await nft.totalSupply()).toNumber(), 0);
          await nft.mintTokens(3, { from: buyerAddress, value: value.mul(new BN(3)) });
          assert.equal((await nft.totalSupply()).toNumber(), 3);
        });

        it("should reflect correct balance for minting address", async () => {
          await nft.mintTokens(3, { from: buyerAddress, value: value.mul(new BN(3)) });
          assert.equal((await nft.balanceOf(buyerAddress)).toString(), new BN(3).toString());
        });
      });

      describe("Reserve/Owner Minting", async () => {
        it("reserve/ownerMinting should fail if tokenCount == 0", async () => {
          await expectRevert(
            nft.reserveTokens(0, { from: minterAddress }),
            "E020"
          );
        });

        it("reserve/ownerMinting should fail if exceeding maxSupply", async () => {
          // maxSupply = 10;        

          await nft.reserveTokens(3, { from: minterAddress });
          await nft.reserveTokens(2, { from: minterAddress });
          await nft.reserveTokens(3, { from: minterAddress });
          await nft.reserveTokens(2, { from: minterAddress });
          //  Maxed out now

          await expectRevert(
            nft.reserveTokens(1, { from: minterAddress }),
            "E017"
          );
        });

        it("reserve/ownerMinting should fail if exceeding maxTokensPerTxn", async () => {
          await expectRevert(
            nft.reserveTokens(4, { from: minterAddress }),
            "E018"
          );
        });

        it("reserve/ownerMinting should succeed if all conditions are ok", async () => {
          const receipt = await nft.reserveTokens(1, { from: minterAddress });
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: minterAddress, tokenId: new BN(0) }
          );
        });

        it("reserve/ownerMinting should succeed multiple times on the same wallet if all conditions are ok", async () => {
          let receipt = await nft.reserveTokens(1, { from: minterAddress });
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: minterAddress, tokenId: new BN(0) }
          );

          receipt = await nft.reserveTokens(1, { from: minterAddress });
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: minterAddress, tokenId: new BN(1) }
          );

          receipt = await nft.reserveTokens(1, { from: minterAddress });
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: minterAddress, tokenId: new BN(2) }
          );
        });

        it("batch minting should succeed if all conditions are ok", async () => {
          const receipt = await nft.reserveTokens(3, { from: minterAddress });
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: minterAddress, tokenId: new BN(0) }
          );
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: minterAddress, tokenId: new BN(1) }
          );
          expectEvent(receipt, "Transfer",
            { from: constants.ZERO_ADDRESS, to: minterAddress, tokenId: new BN(2) }
          );
        });

        it("`totalSupply()` is updated on successful minting", async () => {
          assert.equal((await nft.totalSupply()).toNumber(), 0);
          await nft.reserveTokens(3, { from: minterAddress });
          assert.equal((await nft.totalSupply()).toNumber(), 3);
        });

        it("should reflect correct balance for minting address", async () => {
          await nft.reserveTokens(3, { from: minterAddress });
          assert.equal((await nft.balanceOf(minterAddress)).toString(), new BN(3).toString());
        });
      });
    });

    describe("Sale - Pre/Post Reveal", async => {
      let buyerAddress;
      let buyerAddress2;
      let buyerAddress3;
      let value;

      before(async () => {
        buyerAddress = accounts[6];
        buyerAddress2 = accounts[7];
        buyerAddress3 = accounts[8];
      });

      beforeEach(async () => {
        params = createParams(accounts);
        value = new BN(params.pricePerToken);
        const gasEstimate = await Erc721V1.new.estimateGas(params);
        nft = await Erc721V1.new(params, { gas: gasEstimate });
        await nft.toggleSaleState();
      });

      it("should work correctly", async () => {
        const staticURI = params.baseURI;

        //  Mint all Tokens - maxSupply: 10
        await nft.mintTokens(3, { from: buyerAddress, value: value.mul(new BN(3)) });
        await nft.mintTokens(2, { from: buyerAddress, value: value.mul(new BN(2)) });
        await nft.mintTokens(3, { from: buyerAddress2, value: value.mul(new BN(3)) });
        await nft.mintTokens(2, { from: buyerAddress3, value: value.mul(new BN(2)) });

        //  Sale is not revealed:
        //    ... offsetIndex should be = 0
        assert.equal(await nft.offsetIndex(), 0);
        //    ... tokenURI should still be = staticURI
        for (i = 0; i < params.maxSupply; i++) {
          assert.equal(await nft.tokenURI(i), staticURI);
        }

        //  Reveal Sale now !
        const receipt = await nft.revealSale(NEW_BASE_URI);
        const maxSupply = (await nft.maxSupply()).toNumber();
        const offsetIndex = (await nft.offsetIndex()).toNumber();

        expectEvent(receipt, "SaleRevealed", { isRevealed: true });
        //    ... tokenURI should be properly offset
        for (i = 0; i < params.maxSupply; i++) {
          const expectedURI = generateNewURI(i, offsetIndex, maxSupply);
          const actualURI = await nft.tokenURI(i);
          assert.equal(actualURI, expectedURI);
        }
      });

      it("`tokenURI()` should accept only valid tokenIds", async () => {
        await nft.mintTokens(3, { from: buyerAddress, value: value.mul(new BN(3)) });
        // 0,1,2 are minted and are valid
        await nft.tokenURI(0);
        await nft.tokenURI(1);
        await nft.tokenURI(2);

        // 3 onwards are not minted yet and so are invalid
        await expectRevert(nft.tokenURI(3), "E023");
        await expectRevert(nft.tokenURI(4), "E023");
        await expectRevert(nft.tokenURI(5), "E023");
      });

      function generateNewURI(tokenId, offsetIndex, maxSupply) {
        let offsetTokenId = tokenId + offsetIndex;
        if (offsetTokenId >= maxSupply) {
          offsetTokenId -= maxSupply;
        }
        return NEW_BASE_URI + offsetTokenId;
      }
    });

    describe("Withdraw Funds", async () => {
      let withdrawRole;
      let roleAndAddress;
      let buyerAddress;
      let withdrawAddress;
      let payee1Address;
      let payee2Address;
      let payee1Share;
      let payee2Share;
      let override;
      let value;
      let gasEstimate;

      before(async () => {
        withdrawRole = await nft.WITHDRAW_ROLE();
        withdrawAddress = accounts[6];
        buyerAddress = accounts[7];

        payee1Address = accounts[8];
        payee2Address = accounts[9];
        payee1Share = 7500; //  75%
        payee2Share = 2500; //  25%

        roleAndAddress = {
          roles: [withdrawRole],
          roleAddresses: [withdrawAddress]
        };
      });

      describe("Royalty NOT included", async () => {
        beforeEach(async () => {
          override = {
            totalRoyalty: 0,
            payees: [],
            shares: [],
            ...roleAndAddress,
          };
          params = createParams(accounts, override);
          value = new BN(params.pricePerToken);
          gasEstimate = await Erc721V1.new.estimateGas(params);
          nft = await Erc721V1.new(params, { gas: gasEstimate });
          await nft.toggleSaleState();
        });

        it("should not create PayoutSplitter", async () => {
          assert.equal(await nft.payoutSplittersCount(), 0);
        });

        it("should revert if called by address NOT in WITHDRAW_ROLE", async () => {
          await expectRevert.unspecified(nft.withdraw({ from: buyerAddress }));
        });

        it("should revert if the contract's balance is 0", async () => {
          assert.equal((await web3.eth.getBalance(nft.address)).toString(), new BN(0).toString());
          await expectRevert(
            nft.withdraw({ from: withdrawAddress }),
            "E024"
          );
        });

        it("should work correctly if all conditions are correct", async () => {
          //  Mint Tokens to add funds to Contract
          const funds = value.mul(new BN(3));
          await nft.mintTokens(3, { from: buyerAddress, value: funds });
          const contractBalance = await web3.eth.getBalance(nft.address);
          assert.equal((contractBalance).toString(), funds.toString());

          // Withdraw
          const receipt = await nft.withdraw({ from: withdrawAddress });

          // Verify

          //    Contract funds should be 0
          assert.equal((await web3.eth.getBalance(nft.address)).toString(), new BN(0).toString());

          //    event emitted sucessfully
          expectEvent(receipt, "Withdraw",
            {
              contractBalance,
              withdrawAddress,
              withdrawAmount: funds,
              royaltyAddress: constants.ZERO_ADDRESS,
              royaltyAmount: new BN(0)
            }
          );
        });
      });

      describe("Royalty included", async () => {
        let payoutSplitter;
        let payoutSplitterAddress;

        beforeEach(async () => {
          override = {
            ...roleAndAddress,
            totalRoyalty: 2500, // 25%
            payees: [
              payee1Address,
              payee2Address,
            ],
            shares: [payee1Share, payee2Share],
            pricePerToken: web3.utils.toWei("0.01")
          };
          params = createParams(accounts, override);
          value = new BN(params.pricePerToken);
          gasEstimate = await Erc721V1.new.estimateGas(params);
          nft = await Erc721V1.new(params, { gas: gasEstimate });

          payoutSplitterAddress = await nft.payoutSplittersHistory(0);
          payoutSplitter = await PayoutSplitter.at(payoutSplitterAddress);

          await nft.toggleSaleState();
        });

        it("should create PayoutSplitter", async () => {
          assert.equal((new BN(await nft.payoutSplittersCount())).toString(), (new BN(1)).toString());
        });

        it("should revert if called by address NOT in WITHDRAW_ROLE", async () => {
          await expectRevert.unspecified(nft.withdraw({ from: buyerAddress }));
        });

        it("should revert if the contract's balance is 0", async () => {
          assert.equal((await web3.eth.getBalance(nft.address)).toString(), new BN(0).toString());
          await expectRevert(
            nft.withdraw({ from: withdrawAddress }),
            "E024"
          );
        });

        it("should work correctly if all conditions are correct", async () => {
          //  Mint Tokens to add funds to Contract
          const funds = value;  // 0.01 ether
          const royalty = await nft.royaltyInfo(1, funds);  //  25% royalty
          await nft.mintTokens(1, { from: buyerAddress, value: funds });

          const contractBalance = await web3.eth.getBalance(nft.address);
          assert.equal((contractBalance).toString(), funds.toString());

          // Withdraw
          const receipt = await nft.withdraw({ from: withdrawAddress });

          // Verify

          //    Contract funds should be 0
          assert.equal((await web3.eth.getBalance(nft.address)).toString(), new BN(0).toString());

          //    event emitted sucessfully
          expectEvent(receipt, "Withdraw",
            {
              contractBalance,
              withdrawAddress,
              withdrawAmount: funds.sub(royalty[1]),
              royaltyAddress: payoutSplitterAddress,
              royaltyAmount: royalty[1]
            }
          );
        });

        it("should calculate and pay royalties to payees correctly - release made by deployer", async () => {
          //  Mint Tokens to add funds to Contract
          const funds = value;  // 0.01 ether
          const royalty = await nft.royaltyInfo(1, funds);  //  25% royalty
          await nft.mintTokens(1, { from: buyerAddress, value: funds });
          await web3.eth.getBalance(nft.address);

          // Withdraw
          await nft.withdraw({ from: withdrawAddress });

          //  payoutSplitter should contain the royalties
          assert.equal(await web3.eth.getBalance(payoutSplitterAddress), royalty[1]);

          //  release to Payee1
          const payee1Amount = royalty[1].mul(new BN(payee1Share)).div(new BN(10000));
          const payee1balance = await web3.eth.getBalance(payee1Address);
          await payoutSplitter.release(payee1Address);
          assert.equal((await web3.eth.getBalance(payee1Address)).toString(), ((new BN(payee1balance)).add(payee1Amount)).toString());

          //  release to Payee2
          const payee2Amount = royalty[1].mul(new BN(payee2Share)).div(new BN(10000));
          const payee2balance = await web3.eth.getBalance(payee2Address);
          await payoutSplitter.release(payee2Address);
          assert.equal((await web3.eth.getBalance(payee2Address)).toString(), ((new BN(payee2balance)).add(payee2Amount)).toString());

          //  payoutSplitter should contain 0 after releasing to payees
          assert.equal(await web3.eth.getBalance(payoutSplitterAddress), 0);
        });

        it("should calculate and pay royalties to payees correctly - release made by randomAddress", async () => {
          //  Mint Tokens to add funds to Contract
          const funds = value;  // 0.01 ether
          const royalty = await nft.royaltyInfo(1, funds);  //  25% royalty
          await nft.mintTokens(1, { from: buyerAddress, value: funds });
          await web3.eth.getBalance(nft.address);

          // Withdraw
          await nft.withdraw({ from: withdrawAddress });

          //  payoutSplitter should contain the royalties
          assert.equal(await web3.eth.getBalance(payoutSplitterAddress), royalty[1]);

          const randomAddress = accounts[3];
          //  release to Payee1
          const payee1Amount = royalty[1].mul(new BN(payee1Share)).div(new BN(10000));
          const payee1balance = await web3.eth.getBalance(payee1Address);
          await payoutSplitter.release(payee1Address, { from: randomAddress });
          assert.equal((await web3.eth.getBalance(payee1Address)).toString(), ((new BN(payee1balance)).add(payee1Amount)).toString());

          //  release to Payee2
          const payee2Amount = royalty[1].mul(new BN(payee2Share)).div(new BN(10000));
          const payee2balance = await web3.eth.getBalance(payee2Address);
          await payoutSplitter.release(payee2Address, { from: randomAddress });
          assert.equal((await web3.eth.getBalance(payee2Address)).toString(), ((new BN(payee2balance)).add(payee2Amount)).toString());

          //  payoutSplitter should contain 0 after releasing to payees
          assert.equal(await web3.eth.getBalance(payoutSplitterAddress), 0);
        });

      });
    });

    describe("Pausable", async () => {
      let minterRole;
      let testAccount;
      let deployerAccount;

      before(async () => {
        minterRole = await nft.MINTER_ROLE();
        testAccount = accounts[5];
        deployerAccount = accounts[0];
      });

      describe("Admin tasks - WhenNotPaused", async () => {
        it("should execute `grantRole()`", async () => {
          await nft.grantRole(minterRole, testAccount, { from: deployerAccount });
        });

        it("should execute `revokeRole()`", async () => {
          await nft.revokeRole(minterRole, testAccount, { from: deployerAccount });
        });

        it("should execute `renouceRole()`", async () => {
          await nft.renounceRole(minterRole, testAccount, { from: testAccount });
        });

        it("should execute `addPayoutSplitter()`", async () => {
          await nft.addPayoutSplitter(2500, params.payees, params.shares);
        });

        it("should execute `mintTokens()`", async () => {
          let value = new BN(params.pricePerToken);
          await nft.toggleSaleState();

          const r = await nft.mintTokens(1, { from: testAccount, value });
        });

        it("should execute `reserveTokens()`", async () => {
          await nft.grantRole(minterRole, testAccount, { from: deployerAccount });
          await nft.reserveTokens(3, { from: testAccount });
        });

        it("should execute `revealSale()`", async () => {
          await nft.revealSale(NEW_BASE_URI);
        });

        it("should execute `toggleSaleState()`", async () => {
          await nft.toggleSaleState();
        });

        it("should execute `setPricePerToken()`", async () => {
          await nft.setPricePerToken(web3.utils.toWei("0.05"), { from: deployerAccount });
        });

        it("should execute `withdraw()`", async () => {
          let value = new BN(params.pricePerToken);
          await nft.toggleSaleState();
          await nft.mintTokens(1, { from: testAccount, value });

          await nft.withdraw({ from: accounts[4] });
        });
      });

      describe("Admin tasks - WhenPaused", async () => {
        it("should revert `grantRole()`", async () => {
          await nft.togglePauseState({ from: deployerAccount });

          await expectRevert(
            nft.grantRole(minterRole, testAccount, { from: deployerAccount }),
            "Pausable: paused"
          );
        });

        it("should revert `revokeRole()`", async () => {
          await nft.togglePauseState({ from: deployerAccount });

          await expectRevert(
            nft.revokeRole(minterRole, testAccount, { from: deployerAccount }),
            "Pausable: paused"
          );
        });

        it("should revert `renouceRole()`", async () => {
          await nft.togglePauseState({ from: deployerAccount });

          await expectRevert(
            nft.renounceRole(minterRole, testAccount, { from: testAccount }),
            "Pausable: paused"
          );
        });

        it("should revert `addPayoutSplitter()`", async () => {
          await nft.togglePauseState({ from: deployerAccount });

          await expectRevert(
            nft.addPayoutSplitter(2500, params.payees, params.shares),
            "Pausable: paused"
          );
        });

        it("should revert `mintTokens()`", async () => {
          let value = new BN(params.pricePerToken);
          await nft.toggleSaleState();
          gasEstimate = await nft.mintTokens.estimateGas(1, { from: testAccount, value });
          await nft.togglePauseState({ from: deployerAccount });

          await expectRevert(
            nft.mintTokens(1, { from: testAccount, value, gas: gasEstimate }),
            "ERC721Pausable: token transfer while paused"
          );
        });

        it("should revert `reserveTokens()`", async () => {
          await nft.grantRole(minterRole, testAccount, { from: deployerAccount });
          await nft.togglePauseState({ from: deployerAccount });

          await expectRevert(
            nft.reserveTokens(3, { from: testAccount }),
            "Pausable: paused"
          );
        });

        it("should revert `revealSale()`", async () => {
          await nft.togglePauseState({ from: deployerAccount });

          await expectRevert(
            nft.revealSale(NEW_BASE_URI),
            "Pausable: paused"
          );
        });

        it("should revert `toggleSaleState()`", async () => {
          await nft.togglePauseState({ from: deployerAccount });

          await expectRevert(
            nft.toggleSaleState(),
            "Pausable: paused"
          );
        });

        it("should revert `setPricePerToken()`", async () => {
          await nft.togglePauseState({ from: deployerAccount });

          await expectRevert(
            nft.setPricePerToken(web3.utils.toWei("0.05"), { from: deployerAccount }),
            "Pausable: paused"
          );
        });

        it("should revert `withdraw()`", async () => {
          let value = new BN(params.pricePerToken);
          await nft.toggleSaleState();
          await nft.mintTokens(1, { from: testAccount, value });
          await nft.togglePauseState({ from: deployerAccount });

          await expectRevert(
            nft.withdraw({ from: accounts[4] }),
            "Pausable: paused"
          );
        });
      });

      describe("Access Control", async () => {
        it("should execute when called by address in DEPLOYER_ROLE", async () => {
          await nft.togglePauseState({ from: deployerAccount });
        });

        it("should revert when called by address not in DEPLOYER_ROLE", async () => {
          await expectRevert.unspecified(
            nft.togglePauseState({ from: testAccount })
          );
        });
      });
    })
  });
});