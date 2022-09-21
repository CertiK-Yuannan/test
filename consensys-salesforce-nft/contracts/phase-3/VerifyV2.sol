// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

import "./RoleV2.sol";

struct MultiSigParams {
  uint256 nonce;
  bytes[] signatures;
}

struct VoucherParams {
  address buyer;
  uint256 issueTime;
  uint256 expirationDuration;
  uint256 pricePerToken;
  uint256 nonce;
  bytes signature;
}

/// @title Contract that verifies Vouchers and MultiSigs.
abstract contract VerifyV2 is EIP712, RoleV2 {
  mapping(uint256 => bool) internal _multisigNonces;
  mapping(uint256 => bool) internal _voucherNonces;
  mapping(bytes32 => uint256) private _roleThreshold;
  mapping(uint256 => mapping(address => bool)) private _nonceSigners;

  constructor(bytes32[] memory multisigRoles_, uint256[] memory multisigThresholds_) EIP712("Erc721Verifier", "V2") {
    for (uint256 i = 0; i < multisigRoles_.length; i++) {
      _roleThreshold[multisigRoles_[i]] = multisigThresholds_[i];
    }
  }

  /**
   * @dev Verify MultiSig payload (Overloaded Fn).
   * @param params_ The Multisig Params
   * @param role_ The role against which the Multisig signatures are verified with
   * @param functionABI_ The function that is being called in this Multisig
   */
  function _verifyMultiSig(
    MultiSigParams memory params_,
    bytes32 role_,
    string memory functionABI_
  ) internal returns (bool) {
    bytes memory stuff = abi.encode(
      keccak256("MultiSig(uint256 nonce,string functionABI)"),
      params_.nonce,
      keccak256(bytes(functionABI_))
    );
    return _verifyMultiSig(stuff, params_, role_);
  }

  /**
   * @dev Verify MultiSig payload (Overloaded Fn).
   * @param stuff_ The abiEncodedKeccak256 data
   * @param params_ The Multisig Params
   * @param role_ The role against which the Multisig signatures are verified with
   */
  function _verifyMultiSig(
    bytes memory stuff_,
    MultiSigParams memory params_,
    bytes32 role_
  ) internal returns (bool) {
    if (_roleThreshold[role_] == 0) {
      return true;
    }
    // Check if this nonce has already been used.
    require(!_multisigNonces[params_.nonce], "27");

    // Mark this nonce as used up.
    _multisigNonces[params_.nonce] = true;

    // Begin mutisig validation

    // Check if the number of signatures match the threshold
    require(_roleThreshold[role_] == params_.signatures.length, "28");

    address[] memory signers = new address[](params_.signatures.length);

    for (uint256 i = 0; i < params_.signatures.length; i++) {
      address recoveredSigner = ECDSA.recover(_hashTypedDataV4(keccak256(stuff_)), params_.signatures[i]);
      signers[i] = recoveredSigner;

      //    Check if this Account has already signed for this nonce.
      require(!_nonceSigners[params_.nonce][recoveredSigner], "31");

      // Check if this Account belongs to the necessary Role
      require(hasRole(role_, recoveredSigner), "32");

      // Make note of the signing account.
      _nonceSigners[params_.nonce][recoveredSigner] = true;
    }

    // Clear this nonce signature set (clean up storage)
    for (uint256 i = 0; i < signers.length; i++) {
      delete _nonceSigners[params_.nonce][signers[i]];
    }

    return true;
  }

  /**
   * @dev Verify Voucher payload.
   * @param stuff_ The abiEncodedKeccak256 data
   * @param params_ The Voucher Params
   * @param role_ The role against which the Voucher signature is verified with
   */
  function _verifyVoucher(
    bytes memory stuff_,
    VoucherParams memory params_,
    bytes32 role_
  ) internal returns (bool) {
    // Check if this nonce has already been used.
    require(!_voucherNonces[params_.nonce], "27");

    // Mark this nonce as used up.
    _voucherNonces[params_.nonce] = true;

    //  Check if voucher time-frame is valid
    //  issueTime <= block.timestamp <= (issueTime+expirationDuration)
    require(
      params_.issueTime <= block.timestamp && block.timestamp <= (params_.issueTime + params_.expirationDuration),
      "35"
    );

    //  Verify Signer
    require(hasRole(role_, ECDSA.recover(_hashTypedDataV4(keccak256(stuff_)), params_.signature)), "32");

    return true;
  }
}
