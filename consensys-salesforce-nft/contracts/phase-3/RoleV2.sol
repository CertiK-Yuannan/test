// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";

import "./oz-overrides/AccessControlV2.sol";

/// @title Contract that manages RBAC.
///         We need to inherit from `Ownable` as this is a requirement for SecondaryMarket Place (e.g: Opensea).
///         We are also inheriting from `AccessControlV2` as Roles are used by the Project for admin tasks.

abstract contract RoleV2 is Ownable, AccessControlV2, ERC721Pausable {
  bytes32 internal constant CONTRACT_ADMIN_ROLE = keccak256("CONTRACT_ADMIN_ROLE");
  bytes32 internal constant FINANCE_ADMIN_ROLE = keccak256("FINANCE_ADMIN_ROLE");
  bytes32 internal constant VOUCHER_SIGNER_ROLE = keccak256("VOUCHER_SIGNER_ROLE");

  constructor() {
    _grantRole(CONTRACT_ADMIN_ROLE, _msgSender());
  }

  /**
        @param interfaceId_ The interfaceId supported by the Contract
    */
  function supportsInterface(bytes4 interfaceId_) public view virtual override(ERC721, AccessControlV2) returns (bool) {
    return super.supportsInterface(interfaceId_);
  }

  /**
   * @dev Grants and/or Revokes `role` to `account`.
   * @param grantRoles_ An existing role in which to add the account
   * @param grantRoleAddresses_ The account to add into an existing role
   * @param revokeRoles_ An existing role from which to remove the account
   * @param revokeRoleAddresses_ The account to remove from an existing role
   */
  function _updateRoles(
    bytes32[] memory grantRoles_,
    address[] memory grantRoleAddresses_,
    bytes32[] memory revokeRoles_,
    address[] memory revokeRoleAddresses_
  ) internal {
    require(
      grantRoles_.length == grantRoleAddresses_.length && revokeRoles_.length == revokeRoleAddresses_.length,
      "08"
    );

    if (grantRoles_.length > 0) {
      for (uint256 i = 0; i < grantRoles_.length; i++) {
        _grantRole(grantRoles_[i], grantRoleAddresses_[i]);
      }
    }

    if (revokeRoles_.length > 0) {
      for (uint256 i = 0; i < revokeRoles_.length; i++) {
        _revokeRole(revokeRoles_[i], revokeRoleAddresses_[i]);
      }
    }
  }

  /**
   * @dev setting `role` to `account`.
   * @param roles_ An existing role in which to add the account
   * @param roleAddresses_ The account to add into an existing role
   */
  function _setRoles(bytes32[] memory roles_, address[] memory roleAddresses_) internal {
    for (uint256 i = 0; i < roles_.length; i++) {
      _grantRole(roles_[i], roleAddresses_[i]);
    }
  }
}
