// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Contract with some basic ERC721 functionality.
/// @notice No custom functionality implemented here, just inherits and overrides.
/// @dev This is an abstract contract and needs to be extended.
///         We need to inherit from `Ownable` as this is a requirement for SecondaryMarket Place (e.g: Opensea).
///         We are also inheriting from `AccessControl` as Roles are used by the Project for admin tasks.

abstract contract Erc721Basic is
    ERC721,
    ERC721Enumerable,
    ERC721Royalty,
    ERC721Pausable,
    Ownable,
    AccessControl
{
    /**
        @param _name The name of the NFT Collection
        @param _symbol The symbol of the NFT collection
    */
    constructor(string memory _name, string memory _symbol)
        ERC721(_name, _symbol)
    {}

    /**
        @param from The seller of the Token
        @param to The buyer of the token
        @param tokenId The token being transferred
    */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable, ERC721Pausable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    /**
        @param tokenId The tokenId to be burned
    */
    function _burn(uint256 tokenId) internal override(ERC721, ERC721Royalty) {
        super._burn(tokenId);
    }

    /**
        @param interfaceId The interfaceId supported by the Contract
    */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721Royalty, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Grants `role` to `account`.
     * @param role An existing role in which to add the account
     * @param account The account to add into an existing role
     */
    function grantRole(bytes32 role, address account) public override whenNotPaused {
        super.grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     * @param role An existing role in which to revoke the account
     * @param account The account to revoke from an existing role
     */
    function revokeRole(bytes32 role, address account) public override whenNotPaused {
        super.revokeRole(role, account);
    }

    /**
     * @dev Revokes `role` from the calling account.
     * @param role An existing role in which to renounce the account
     * @param account The account to renounce from an existing role
     */
    function renounceRole(bytes32 role, address account) public override whenNotPaused{
        super.renounceRole(role, account);
    }
}
