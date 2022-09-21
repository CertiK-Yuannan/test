// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";

import "./VerifyV2.sol";

/// @title Common ancestor for the project's Open/Closed Sales.

abstract contract Erc721SaleV2 is ERC721, ERC721Royalty, VerifyV2 {
  event NftDeployed(address indexed owner, address indexed nft, address indexed paymentSplitter);
  event SaleActiveChanged(bool isSaleActive);
  event Withdraw(
    uint256 contractBalance,
    address indexed pricePayoutWallet,
    uint256 withdrawAmount,
    address indexed royaltyAddress,
    uint256 royaltyAmount
  );
  event PaymentSplitterUpdated(address oldPaymentSplitter, address newPaymentSplitter);
  event TokensPaused(uint256[] tokenIds, bool pause, address sender);
  event UpdatedRoleRoyaltyPricePayout(
    bytes32[] grantRoles,
    address[] grantRoleAddresses,
    bytes32[] revokeRoles,
    address[] revokeRoleAddresses,
    uint96 totalRoyalty,
    address[] payees,
    uint256[] shares,
    address[] pricePayoutWallets
  );

  string public baseURI;
  string public contractURI;
  uint256 public maxSupply;
  uint256 public totalSupply = 0;
  uint256 public maxTokensPerWallet;
  uint256 public paymentSplittersCount;
  address public pricePayoutWallet;
  address payable[] public paymentSplittersHistory;
  bool public isSaleActive;

  mapping(uint256 => bool) private _pausedTokenIds;

  constructor(
    string memory name_,
    string memory symbol_,
    string memory baseURI_,
    string memory contractURI_,
    uint256 maxSupply_,
    uint256 maxTokensPerWallet_,
    address pricePayoutWallet_,
    bytes32[] memory roles_,
    address[] memory roleAddresses_,
    bytes32[] memory multisigRoles_,
    uint256[] memory multisigThresholds_,
    uint96 totalRoyalty_,
    address[] memory payees_,
    uint256[] memory shares_
  ) ERC721(name_, symbol_) VerifyV2(multisigRoles_, multisigThresholds_) {
    require(bytes(name_).length > 0, "01");
    require(bytes(baseURI_).length > 0, "02");
    require(maxSupply_ > 0, "04");
    require(maxTokensPerWallet_ > 0 && maxTokensPerWallet_ <= maxSupply_, "06");
    require(pricePayoutWallet_ != address(0), "21");
    require(roles_.length == roleAddresses_.length && roles_.length > 0, "08");
    require(multisigRoles_.length == multisigThresholds_.length, "30");

    baseURI = baseURI_;
    contractURI = contractURI_; //  If N/A, then any non-zero length string can be passed in. e.g: `none`
    maxSupply = maxSupply_;
    maxTokensPerWallet = maxTokensPerWallet_;
    pricePayoutWallet = pricePayoutWallet_;

    _setRoles(roles_, roleAddresses_);
    _addPaymentSplitter(totalRoyalty_, payees_, shares_);
  }

  function _beforeTokenTransfer(
    address from_,
    address to_,
    uint256 tokenId_
  ) internal override(ERC721, ERC721Pausable) {
    require(!_pausedTokenIds[tokenId_], "34");

    if (from_ == address(0)) {
      totalSupply++;
    } else if (to_ == address(0)) {
      totalSupply--;
    }
    super._beforeTokenTransfer(from_, to_, tokenId_);
  }

  /**
        @param tokenId_ The tokenId to be burned
    */
  function _burn(uint256 tokenId_) internal override(ERC721, ERC721Royalty) {
    super._burn(tokenId_);
  }

  /**
        @param interfaceId_ The interfaceId supported by the Contract
    */
  function supportsInterface(bytes4 interfaceId_) public view override(ERC721, ERC721Royalty, RoleV2) returns (bool) {
    return super.supportsInterface(interfaceId_);
  }

  /**
        @dev Returns the current PaymentSplitter active in the Contract.
            If no royalties have been set, then it returns address(0) 
    */
  function currentPaymentSplitter() public view returns (address) {
    if (paymentSplittersCount > 0) {
      return paymentSplittersHistory[paymentSplittersCount - 1];
    }
    return address(0);
  }

  /**
        @dev This function toggles the `isSaleActive` state (`true` <-> `false`).
                Minting can happen only if `isSaleActive == true`.
        @param params_ Parameters for a MultiSig validation.
    */
  function toggleSaleState(MultiSigParams memory params_) external onlyRole(CONTRACT_ADMIN_ROLE) whenNotPaused {
    require(_verifyMultiSig(params_, CONTRACT_ADMIN_ROLE, "toggleSaleState(MultiSigParams)"), "29");

    isSaleActive = !isSaleActive;
    emit SaleActiveChanged(isSaleActive);
  }

  /**
        @dev This function toggles the `pause` state (`true` <-> `false`).
                Admin tasks can be performed only if `pause != true`.
        @param params_ Parameters for a MultiSig validation.                
    */
  function togglePauseState(MultiSigParams memory params_) external onlyRole(CONTRACT_ADMIN_ROLE) {
    require(_verifyMultiSig(params_, CONTRACT_ADMIN_ROLE, "togglePauseState(MultiSigParams)"), "29");

    if (paused()) {
      _unpause();
    } else {
      _pause();
    }
  }

  /**
        @dev This function is used to withdraw the contract funds into the foll. wallets.
            - msg.Sender (should be a wallet in FINANCE_ADMIN_ROLE).
            - paymentSplitter/royalty if defined.
        @param params_ Parameters for a MultiSig validation.            
    */
  function withdraw(MultiSigParams memory params_) external onlyRole(FINANCE_ADMIN_ROLE) whenNotPaused {
    require(_verifyMultiSig(params_, FINANCE_ADMIN_ROLE, "withdraw(MultiSigParams)"), "29");

    uint256 balance = address(this).balance;
    require(balance > 0, "24");
    (address paymentSplitterAddress, uint256 royaltyAmount) = this.royaltyInfo(0, balance); // Any TokenId can be passed as param. Defaulting to 0
    uint256 withdrawerAmount = balance - royaltyAmount;

    Address.sendValue(payable(pricePayoutWallet), withdrawerAmount);
    if (paymentSplitterAddress != address(0)) {
      Address.sendValue(payable(paymentSplitterAddress), royaltyAmount);
    }
    emit Withdraw(balance, pricePayoutWallet, withdrawerAmount, paymentSplitterAddress, royaltyAmount);
  }

  /**
        @dev This method can be called to pause/unpause any Transfers related to a TokenId.
        @param tokenIds_ The list of tokenIds to be paused/unpaused.
        @param pause_ A boolean determining a pause/unpause action (true:pause, false:unpause).
        @param params_ Parameters for a MultiSig validation.
    */
  function pauseTokens(
    uint256[] memory tokenIds_,
    bool pause_,
    MultiSigParams memory params_
  ) external onlyRole(CONTRACT_ADMIN_ROLE) whenNotPaused {
    require(tokenIds_.length > 0, "33");

    require(
      _verifyMultiSig(
        abi.encode(
          keccak256("MultiSig(uint256[] tokenIds,bool pause,uint256 nonce,string functionABI)"),
          keccak256(abi.encodePacked(tokenIds_)),
          pause_,
          params_.nonce,
          keccak256(bytes("pauseTokens(uint256[],bool,MultiSigParams)"))
        ),
        params_,
        CONTRACT_ADMIN_ROLE
      ),
      "29"
    );

    //  Add or Remove Pause for tokenIds in the list
    for (uint256 i = 0; i < tokenIds_.length; i++) {
      //  Check if TokenId exists before attempting to Pause it. Ignore if it doesnt exist.
      if (pause_ && _exists(tokenIds_[i])) {
        _pausedTokenIds[tokenIds_[i]] = true;
      } else if (!pause_) {
        //  If Token Id does not exist, nothing will be deleted by the below Statement
        delete _pausedTokenIds[tokenIds_[i]];
      }
    }
    emit TokensPaused(tokenIds_, pause_, _msgSender());
  }

  /**
        @dev This method can be called to update Roles, Royalties(PaymentSplitter) and PricePayoutWallet.
        @param grantRoles_ The roles to grant access to.
        @param grantRoleAddresses_ The addresses for the granted roles.
        @param revokeRoles_ The roles to revoke access from.
        @param revokeRoleAddresses_ The addresses for the revoked roles.
        @param totalRoyalty_ The total royalty to be transferred to the `PaymentSplitter` inside the `nft.withdraw()` method.
        @param payees_ The Payees participating in the PaymentSplitter.
        @param shares_ The shares assigned to each Payee participating in the PaymentSplitter.
        @param pricePayoutWallets_ The list of tokenIds to be paused/unpaused.
    */
  function updateRoleRoyaltyPayout(
    bytes32[] memory grantRoles_,
    address[] memory grantRoleAddresses_,
    bytes32[] memory revokeRoles_,
    address[] memory revokeRoleAddresses_,
    uint96 totalRoyalty_,
    address[] memory payees_,
    uint256[] memory shares_,
    address[] memory pricePayoutWallets_,
    MultiSigParams memory params_
  ) external onlyRole(CONTRACT_ADMIN_ROLE) whenNotPaused {
    require(
      _verifyMultiSig(
        abi.encode(
          keccak256(
            "MultiSig(bytes32[] grantRoles,address[] grantRoleAddresses,bytes32[] revokeRoles,address[] revokeRoleAddresses,uint96 totalRoyalty,address[] payees,uint256[] shares,address[] pricePayoutWallets,uint256 nonce,string functionABI)"
          ),
          keccak256(abi.encodePacked(grantRoles_)),
          keccak256(abi.encodePacked(grantRoleAddresses_)),
          keccak256(abi.encodePacked(revokeRoles_)),
          keccak256(abi.encodePacked(revokeRoleAddresses_)),
          totalRoyalty_,
          keccak256(abi.encodePacked(payees_)),
          keccak256(abi.encodePacked(shares_)),
          keccak256(abi.encodePacked(pricePayoutWallets_)),
          params_.nonce,
          keccak256(
            bytes(
              "updateRoleRoyaltyPayout(bytes32[],address[],bytes32[],address[],uint96,address[],uint256[],address[],MultiSigParams)"
            )
          )
        ),
        params_,
        CONTRACT_ADMIN_ROLE
      ),
      "29"
    );

    _updateRoles(grantRoles_, grantRoleAddresses_, revokeRoles_, revokeRoleAddresses_);
    _addPaymentSplitter(totalRoyalty_, payees_, shares_);
    _updatePricePayoutWallet(pricePayoutWallets_);

    emit UpdatedRoleRoyaltyPricePayout(
      grantRoles_,
      grantRoleAddresses_,
      revokeRoles_,
      revokeRoleAddresses_,
      totalRoyalty_,
      payees_,
      shares_,
      pricePayoutWallets_
    );
  }

  /**
        @dev This method can be called externally when a change or correction is reqd in the Payee/Share ratio in the PaymentSplitter.
            The new PaymentSplitter does not replace the existing PaymentSplitter, but gets added to the array, and becomes the `current` PaymentSplitter.
        @param totalRoyalty_ The total royalty to be transferred to the `PaymentSplitter` inside the `nft.withdraw()` method.
        @param payees_ The Payees participating in the PaymentSplitter.
        @param shares_ The shares assigned to each Payee participating in the PaymentSplitter.  
    */
  function _addPaymentSplitter(
    uint96 totalRoyalty_,
    address[] memory payees_,
    uint256[] memory shares_
  ) internal {
    require(totalRoyalty_ >= 0 && totalRoyalty_ <= 10000, "11");

    if (totalRoyalty_ > 0) {
      address payable oldPaymentSplitterAddress = payable(currentPaymentSplitter());

      PaymentSplitter paymentSplitter = new PaymentSplitter(payees_, shares_);
      address payable newPaymentSplitterAddress = payable(address(paymentSplitter));
      paymentSplittersHistory.push(newPaymentSplitterAddress);
      paymentSplittersCount++;

      _setDefaultRoyalty(newPaymentSplitterAddress, totalRoyalty_); //  ERC721Royalty / ERC2981

      emit PaymentSplitterUpdated(oldPaymentSplitterAddress, newPaymentSplitterAddress);
    }
  }

  function _updatePricePayoutWallet(address[] memory pricePayoutWallets_) internal {
    require(pricePayoutWallets_.length <= 1, "08");

    if (pricePayoutWallets_.length == 1) {
      require(pricePayoutWallets_[0] != address(0), "21");
      pricePayoutWallet = pricePayoutWallets_[0];
    }
  }

  /**
        @dev This method can be called to mark a Multisig Nonce as "used" in a Multisig Rejection workflow.
              This prevents the nonce from being used again in a Multisig Txn
        @param nonce_ The nonce to be marked as used.
    */
  function markMultisigNonceUsed(uint256 nonce_) external onlyRole(CONTRACT_ADMIN_ROLE) {
    _multisigNonces[nonce_] = true;
  }
}
