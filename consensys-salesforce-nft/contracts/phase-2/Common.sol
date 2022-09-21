// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

/// @title Common functionality.

/// @notice A struct representing the parameters passed into the factory Contracts.
///         This is used to overcome the Solidity limitation of max number of params that can be passed to a method.
struct Params {
    string name; /// The name of the Nft collection
    string symbol; /// The symbol for the Nft collection
    string baseURI; /// The initial (IPFS) URI, which would point to the static metadata/image (until the project is Revealed)
    string contractURI; /// The (IPFS) URI that provides metadata for the Contract/Collection (https://docs.opensea.io/docs/contract-level-metadata)
    string provenance; /// The provenance for the images in the project
    uint96 totalRoyalty; /// The total royalty to be transferred to the `PayoutSplitter` inside the `nft.withdraw()` method
    uint256 pricePerToken; /// The price to be charged for each minted token
    uint256 maxSupply; /// The max number of Tokens that can be minted
    uint256 maxTokensPerWallet; /// The max no. of tokens that can be minted per wallet
    uint256 maxTokensPerTxn; /// The max no. of tokens that can be minted per Txn
    bool isRevealed; /// Specifies if the project will have an instant reveal
    bytes32[] roles; /// The Access roles for the Nft Contracts
    address[] roleAddresses; /// The addresses for the access roles
    address[] payees; /// The Payees participating in the PayoutSplitter
    uint256[] shares; /// The shares assigned to each Payee participating in the PayoutSplitter
}