// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Erc721SaleV2.sol";

/// @notice A struct representing the parameters passed into the OpenSale Contracts.
///         This is used to overcome the Solidity limitation of max number of params that can be passed to a method.
struct OpenSaleParams {
  string name; /// The name of the Nft collection.
  string symbol; /// The symbol for the Nft collection.
  string baseURI; /// The initial (IPFS) URI, which would point to the static metadata/image (until the project is Revealed).
  string contractURI; /// The (IPFS) URI that provides metadata for the Contract/Collection (https://docs.opensea.io/docs/contract-level-metadata).
  uint96 totalRoyalty; /// The total royalty to be transferred to the `PaymentSplitter` inside the `nft.withdraw()` method.
  uint256 maxSupply; /// The max number of Tokens that can be minted.
  uint256 maxTokensPerWallet; /// The max no. of tokens that can be minted per wallet.
  address pricePayoutWallet; /// This represents the Wallet address where the contract funds will be deposited on a `withdraw()`.
  bytes32[] roles; /// The Access roles for the Nft Contracts.
  address[] roleAddresses; /// The addresses for the access roles.
  bytes32[] multisigRoles; /// The roles having Multisig Thresholds.
  uint256[] multisigThresholds; /// The Multisig threholds for a Role.
  address[] payees; /// The Payees participating in the PaymentSplitter.
  uint256[] shares; /// The shares assigned to each Payee participating in the PaymentSplitter.
}

/// @title An NFT Contract for Open Sale. Customers get to choose their Image/Metadata before buying the NFT.
contract Erc721OpenSaleV2 is Erc721SaleV2 {
  using Strings for uint256;
  using Address for address;

  /**
        @param params_ The parameters sent in to initialize the Contract. Please see `struct Params` for more details on the params_.
    */
  constructor(OpenSaleParams memory params_)
    Erc721SaleV2(
      params_.name,
      params_.symbol,
      params_.baseURI,
      params_.contractURI,
      params_.maxSupply,
      params_.maxTokensPerWallet,
      params_.pricePayoutWallet,
      params_.roles,
      params_.roleAddresses,
      params_.multisigRoles,
      params_.multisigThresholds,
      params_.totalRoyalty,
      params_.payees,
      params_.shares
    )
  {
    emit NftDeployed(_msgSender(), address(this), currentPaymentSplitter());
  }

  /**
        @dev This function is used to mint a token. It can be called by anybody.
        @param tokenId_ The tokenId of the Token to be minted.
    */
  function mintToken(uint256 tokenId_, VoucherParams memory params_) external payable whenNotPaused {
    require(isSaleActive, "15");
    require((totalSupply + 1) <= maxSupply, "17");
    require(!_msgSender().isContract(), "16");
    require(balanceOf(_msgSender()) + 1 <= maxTokensPerWallet, "19");
    require(tokenId_ >= 0 && tokenId_ <= (maxSupply - 1), "26");
    require(params_.pricePerToken == msg.value, "22");

    require(
      _verifyVoucher(
        abi.encode(
          keccak256(
            "Voucher(uint256 tokenId,address buyer,uint256 issueTime,uint256 expirationDuration,uint256 pricePerToken,uint256 nonce,string functionABI)"
          ),
          tokenId_,
          _msgSender(),
          params_.issueTime,
          params_.expirationDuration,
          params_.pricePerToken,
          params_.nonce,
          keccak256(bytes("mintToken(uint256,VoucherParams)"))
        ),
        params_,
        VOUCHER_SIGNER_ROLE
      ),
      "29"
    );

    _safeMint(_msgSender(), tokenId_);
  }

  /**
        @param tokenId_ The tokenId whose URI is requested.
    */
  function tokenURI(uint256 tokenId_) public view override(ERC721) returns (string memory) {
    require(_exists(tokenId_), "23");
    return string(abi.encodePacked(baseURI, tokenId_.toString()));
  }
}
