// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/utils/Counters.sol";

import "./Erc721SaleV2.sol";

/// @notice A struct representing the parameters passed into the ClosedSale Contracts.
///         This is used to overcome the Solidity limitation of max number of params that can be passed to a method.
struct ClosedSaleParams {
  string name; /// The name of the Nft collection.
  string symbol; /// The symbol for the Nft collection.
  string baseURI; /// The initial (IPFS) URI, which would point to the static metadata/image (until the project is Revealed).
  string contractURI; /// The (IPFS) URI that provides metadata for the Contract/Collection (https://docs.opensea.io/docs/contract-level-metadata).
  string provenance; /// The provenance for the images in the project.
  uint96 totalRoyalty; /// The total royalty to be transferred to the `PaymentSplitter` inside the `nft.withdraw()` method.
  uint256 maxSupply; /// The max number of Tokens that can be minted.
  uint256 maxTokensPerWallet; /// The max no. of tokens that can be minted per wallet.
  uint256 maxTokensPerTxn; /// The max no. of tokens that can be minted per Txn.
  address pricePayoutWallet; /// This represents the Wallet address where the contract funds will be deposited on a `withdraw()`.
  bytes32[] roles; /// The Access roles for the Nft Contracts.
  address[] roleAddresses; /// The addresses for the access roles.
  bytes32[] multisigRoles; /// The roles having Multisig Thresholds.
  uint256[] multisigThresholds; /// The Multisig threholds for a Role.
  address[] payees; /// The Payees participating in the PaymentSplitter.
  uint256[] shares; /// The shares assigned to each Payee participating in the PaymentSplitter.
}

/// @title An NFT Contract for Closed Sale. Customers cannot choose their Image/Mtadata before buying their NFT.
///        It involves an Intial Closed Sale, followed by a Reveal.
contract Erc721ClosedSaleV2 is Erc721SaleV2 {
  using Strings for uint256;
  using Counters for Counters.Counter;
  using Address for address;

  event SaleRevealed(bool isRevealed);
  event PricePerTokenUpdated(address sender, uint256 newPricePerToken);

  string public provenance;
  uint256 public maxTokensPerTxn;
  bool public isRevealed;

  uint256 public offsetIndexBlock;
  uint256 public offsetIndex;

  Counters.Counter private _tokenIdCounter;

  /**
        @param params_ The parameters sent in to initialize the Contract. Please see `struct Params` for more details on the params_.
    */
  constructor(ClosedSaleParams memory params_)
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
    require(bytes(params_.provenance).length > 0, "03");
    require(params_.maxTokensPerTxn > 0 && params_.maxTokensPerTxn <= params_.maxSupply, "07");

    provenance = params_.provenance;
    maxTokensPerTxn = params_.maxTokensPerTxn;

    emit NftDeployed(_msgSender(), address(this), currentPaymentSplitter());
  }

  /**
        @dev This function set the `isRevealed = true`. It can be called only once.
        @param baseURI_ This is the IPFS URI for the actual Image/Metadata that is unique for each tokenId.
        @param params_ Parameters for a MultiSig validation.        
    */
  function revealSale(string memory baseURI_, MultiSigParams memory params_)
    external
    onlyRole(CONTRACT_ADMIN_ROLE)
    whenNotPaused
  {
    require(!isRevealed, "14");
    require(bytes(baseURI_).length > 0, "02");
    require(
      _verifyMultiSig(
        abi.encode(
          keccak256("MultiSig(string baseURI,uint256 nonce,string functionABI)"),
          keccak256(bytes(baseURI_)),
          params_.nonce,
          keccak256(bytes("revealSale(string,MultiSigParams)"))
        ),
        params_,
        CONTRACT_ADMIN_ROLE
      ),
      "29"
    );

    offsetIndexBlock = block.number;
    offsetIndex = offsetIndexBlock % maxSupply;
    baseURI = baseURI_;
    isRevealed = true;
    emit SaleRevealed(isRevealed);
  }

  /**
        @dev This function is used to mint tokens. It can be called by anybody.
        @param tokenCount_ The number of tokens to be minted to `msg.sender`.
    */
  function mintTokens(uint256 tokenCount_, VoucherParams memory params_) external payable whenNotPaused {
    require(isSaleActive, "15");
    require(totalSupply + tokenCount_ <= maxSupply, "17");
    require(!_msgSender().isContract(), "16");
    require(balanceOf(_msgSender()) + tokenCount_ <= maxTokensPerWallet, "19");
    require(tokenCount_ > 0, "20");
    require(tokenCount_ <= maxTokensPerTxn, "18");
    require(tokenCount_ * params_.pricePerToken == msg.value, "22");

    require(
      _verifyVoucher(
        abi.encode(
          keccak256(
            "Voucher(address buyer,uint256 issueTime,uint256 expirationDuration,uint256 pricePerToken,uint256 nonce,string functionABI)"
          ),
          _msgSender(),
          params_.issueTime,
          params_.expirationDuration,
          params_.pricePerToken,
          params_.nonce,
          keccak256(bytes("mintTokens(uint256,VoucherParams)"))
        ),
        params_,
        VOUCHER_SIGNER_ROLE
      ),
      "29"
    );

    for (uint256 i = 1; i <= tokenCount_; i++) {
      _safeMint(_msgSender(), _tokenIdCounter.current());
      _tokenIdCounter.increment();
    }
  }

  /**
        @param tokenId_ The tokenId whose URI is requested.
    */
  function tokenURI(uint256 tokenId_) public view override(ERC721) returns (string memory) {
    require(_exists(tokenId_), "23");

    if (isRevealed) {
      uint256 offsetTokenId = tokenId_ + offsetIndex;
      if (offsetTokenId >= maxSupply) {
        offsetTokenId -= maxSupply;
      }
      return string(abi.encodePacked(baseURI, offsetTokenId.toString()));
    }
    return baseURI;
  }
}
