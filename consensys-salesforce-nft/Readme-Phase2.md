# Salesforce / CodeScience / ConsenSys NFT Project

## Introduction:
The purpose of this project is to develop an NFT platform on Salesforce's CommerceCloud environment.

**CodeScience :** Responsible for developing the Front End.  
**ConsenSys :** Responsible for developing the SmartContracts.

## SmartContract Development:
- EVM based chains
- Solidity
- Truffle development tools
- Ganache
- Rinkeby

## SmartContract Design:
The SmartContracts have been developed in accordance to the requirements provided by Salesforce. The custom functionality that is required will be developed in a multi-phased approach.

The following are the features for the different phases:

### Phase 1 ( *POC* ): 
- Out of scope for this Repository ( *the code has been pulled out into a separate repository* )

### Phase 2 ( *Current Phase* ):
- Provenance Hash.
- Randomization in associating the TokenId with the Image/Metadata.
- Closed Initial-Sale with a Reveal at a later date.
- Access Control provided with Roles.
- 0-based, sequentially generated TokenIds.
- Support for Erc2981 ( *Royalty Std.* )
- Provision to have multiple Pre-Sales events, with the option to update the price/token for each sale.
- Activate/Deactivate Sales.
- Multiple Events emitted by SmartContract, per custom action performed.
- Allowing the minting of multiple tokens per Transaction.
- Restricting max tokens minted per Transaction.
- Restricting max tokens per Wallet.
- Providing a Max Supply, thus limiting the supply of tokens.
- Royalties for Pre-Sales ( *incorporated into the SmartContract* ), and Secondary Sales ( *provided to marketplace* ).
- Incorporting multiple Split-Payments for Royalties from the sales proceeds.
- Pausing/Unpausing administrative actions.
- Early Minting or Reserved Minting by the Owner.
- Compatible with marketplaces for secondary sales ( *e.g: OpenSea* )

### Phase 3:
- TBD

## SmartContracts:
The contracts in this project have been derived from Openzepellin's contracts.

    Erc721Base is
        Openzeppelin.ERC721
        Openzeppelin.ERC721Enumerable
        Openzeppelin.ERC721Royalty
        Openzeppelin.ERC721Pausable
        Openzeppelin.AccessControl 

    Erc721V1 is
        Erc721Base

    PayoutSplitter is
        Openzeppelin.PaymentSplitter

## Naming Conventions
- *private* variables/methods are prefixed with `_` ( *e.g: `string private _contractURI;`* )
- *public* variables/methods have no suffix/prefix ( *e.g: `uint256 public maxSupply;`* )
- *method parameters* are suffixed with `_` ( *e.g: `function mintTokens(uint256 tokenCount_ ) external payable { }`* )

## Error Messages
In order to optimize the code size in the Contract ( *due to **Spurious Dragon** EIP-170 contract size limit* ), all Error messages in `require( )` statements have been replaced with Error Codes. The *description* for each of the Error Code can be found in the following file:
`scripts/err_codes.ts`.

This is only for the SmartContracts in this repository. All base class SmartContracts ( *Openzepplin* ) have not been changed, and display their original Error Messages.
