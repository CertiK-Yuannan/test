// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "./Erc721ClosedSaleV2.sol";

/// @title DO NOT use this Contract for anything.
///        It is used only in UnitTests, to test the commn abstract Erc721SaleV2 Contract
contract Erc721SaleTest is Erc721SaleV2 {
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
  {}
}
