// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/utils/Counters.sol";

import "./Common.sol";
import "./Erc721Basic.sol";
import "./PayoutSplitterV1.sol";

/// @title Contract with custom NFT functionality.
/// @notice This contract implements all the custom functionality for the NFT project.

contract Erc721V1 is Erc721Basic {
    using Strings for uint256;
    using Counters for Counters.Counter;
    using Address for address;
    
    event NftDeployed(address indexed owner, address indexed nft, address indexed payoutSplitter);
    event SaleActiveChanged(bool isSaleActive);
    event SaleRevealed(bool isRevealed);
    event Withdraw(uint256 contractBalance, address indexed withdrawAddress, uint256 withdrawAmount, address indexed royaltyAddress, uint256 royaltyAmount);
    event PricePerTokenUpdated(address sender, uint256 newPricePerToken);
    event PayoutSplitterUpdated(address oldPayoutSplitter, address newPayoutSplitter);

    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    string public baseURI;
    string public provenance;
    uint256 public pricePerToken;
    uint256 public maxSupply;
    uint256 public maxTokensPerWallet;
    uint256 public maxTokensPerTxn;
    bool public isSaleActive;
    bool public isRevealed;
    address payable[] public payoutSplittersHistory;
    uint256 public payoutSplittersCount;

    uint256 public offsetIndexBlock;
    uint256 public offsetIndex;

    Counters.Counter private _tokenIdCounter;
    string private _contractURI;
    string[] private _roles;
    string[] private _roleAddresses;

    /**
        @param params_ The parameters sent in to initialize the Contract. Please see `struct Params` for more details on the params_.
    */
    constructor(Params memory params_) Erc721Basic(params_.name, params_.symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(DEPLOYER_ROLE, _msgSender());

        require(bytes(params_.name).length > 0, "E001");
        require(bytes(params_.baseURI).length > 0, "E002");
        require(bytes(params_.provenance).length > 0, "E003");
        require(params_.pricePerToken > 0, "E005");
        require(params_.maxSupply > 0, "E004");
        require(params_.maxTokensPerWallet > 0 && params_.maxTokensPerWallet < params_.maxSupply, "E006");
        require(params_.maxTokensPerTxn > 0 && params_.maxTokensPerTxn < params_.maxSupply, "E007");
        require(params_.roles.length == params_.roleAddresses.length, "E008");
        require(params_.roles.length > 0, "E009");

        _contractURI = params_.contractURI;     //  If N/A, then any non-zero length string can be passed in. e.g: `none`
        for(uint i = 0; i < params_.roles.length ; i++) {
            _grantRole(params_.roles[i], params_.roleAddresses[i]);
        }

        baseURI = params_.baseURI;
        provenance = params_.provenance;
        pricePerToken = params_.pricePerToken;
        maxSupply = params_.maxSupply;
        maxTokensPerWallet = params_.maxTokensPerWallet;
        maxTokensPerTxn = params_.maxTokensPerTxn;
        isRevealed = params_.isRevealed;

        address payable payoutSplitterAddress = payable(address(0));
        if (params_.totalRoyalty > 0) {
            payoutSplitterAddress = addPayoutSplitter(params_.totalRoyalty, params_.payees, params_.shares);
        }

        emit NftDeployed(_msgSender(), address(this), payoutSplitterAddress);
    }

    /**
        @dev This method can be called externally when a change or correction is reqd in the Payee/Share ratio in the PayoutSplitter.
            The new PayoutSplitter does not replace the existing PayoutSplitter, but gets added to the array, and becomes the `current` PayoutSplitter.
        @param totalRoyalty_ The total royalty to be transferred to the `PayoutSplitter` inside the `nft.withdraw()` method.
        @param payees_ The Payees participating in the PayoutSplitter.
        @param shares_ The shares assigned to each Payee participating in the PayoutSplitter.  
    */
    function addPayoutSplitter(uint96 totalRoyalty_, address[] memory payees_, uint256[] memory shares_) 
        public onlyRole(DEPLOYER_ROLE) whenNotPaused returns(address payable) {
        require(totalRoyalty_ != 0, "E011");    //  <= 100%
        require(totalRoyalty_ <= 10000, "E012");    //  <= 100%

        address payable oldPayoutSplitterAddress = payable(address(0));
        if (payoutSplittersCount > 0) {
            oldPayoutSplitterAddress = payoutSplittersHistory[payoutSplittersCount-1];
        }

        PayoutSplitterV1 payoutSplitter = new PayoutSplitterV1(
            payees_,
            shares_
        );
        address payable newPayoutSplitterAddress = payable(address(payoutSplitter));
        payoutSplittersHistory.push(newPayoutSplitterAddress);
        payoutSplittersCount++;
        
        _setDefaultRoyalty(newPayoutSplitterAddress, totalRoyalty_); //  ERC721Royalty / ERC2981
        
        emit PayoutSplitterUpdated(oldPayoutSplitterAddress, newPayoutSplitterAddress);
        return newPayoutSplitterAddress;
    }

    /**
        @dev This function toggles the `isSaleActive` state (`true` <-> `false`).
                Minting can happen only if `isSaleActive == true`.
    */
    function toggleSaleState() external onlyRole(DEPLOYER_ROLE) whenNotPaused {
        isSaleActive = !isSaleActive;
        emit SaleActiveChanged(isSaleActive);
    }

    /**
        @dev This function toggles the `pause` state (`true` <-> `false`).
                Admin tasks can be performed only if `pause != true`.
    */
    function togglePauseState() external onlyRole(DEPLOYER_ROLE) {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }

    /**
        @dev This function set the `isRevealed = true`. It can be called only once.
        @param baseURI_ This is the IPFS URI for the actual Image/Metadata that is unique for each tokenId.
    */
    function revealSale(string memory baseURI_) external onlyRole(DEPLOYER_ROLE) whenNotPaused {
        require(!isRevealed, "E014");
        require(bytes(baseURI_).length > 0, "E002");

        offsetIndexBlock = block.number;
        offsetIndex = offsetIndexBlock % maxSupply;
        baseURI = baseURI_;
        isRevealed = true;
        emit SaleRevealed(isRevealed);
    }

    /**
        @dev This function is used to reserve/mint tokens by project owners.
        @param tokenCount_ The number of tokens to be minted to `msg.sender`.
    */
    function reserveTokens(uint256 tokenCount_) external onlyRole(MINTER_ROLE) whenNotPaused {
        _mintTokens(tokenCount_);
    }

    /**
        @dev This function is used to mint tokens. It can be called by anybody.
        @param tokenCount_ The number of tokens to be minted to `msg.sender`.
    */
    function mintTokens(uint256 tokenCount_) external payable {
        require(isSaleActive, "E015");
        require((pricePerToken * tokenCount_) == msg.value, "E022");
        require(balanceOf(_msgSender()) + tokenCount_ <= maxTokensPerWallet, "E019");

        _mintTokens(tokenCount_);
    }

    /**
        @param tokenId_ The tokenId whose URI is requested.
    */
    function tokenURI(uint256 tokenId_)
        public
        view
        override(ERC721)
        returns (string memory)
    {
        require(_exists(tokenId_), "E023");

        if (isRevealed) {
            uint256 offsetTokenId = tokenId_ + offsetIndex;            
            if (offsetTokenId >= maxSupply) {
                offsetTokenId -= maxSupply;
            }
            return string(abi.encodePacked(baseURI, offsetTokenId.toString()));
        } else {
            return baseURI;
        }
    }

    /**
        @dev The (IPFS) URI that provides metadata for the Contract/Collection (https://docs.opensea.io/docs/contract-level-metadata).                
    */
    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    /**
        @dev This function is used to withdraw the contract funds into the foll. wallets.
            - msg.Sender (should be a wallet in WITHDRAW_ROLE).
            - payoutSplitter/royalty if defined.
    */
    function withdraw() external onlyRole(WITHDRAW_ROLE) whenNotPaused {
        uint balance = address(this).balance;
        require(balance > 0, "E024");
        (address payoutSplitterAddress, uint256 royaltyAmount) = this.royaltyInfo(0, balance); // Any TokenId can be passed as param. Defaulting to 0
        uint256 withdrawerAmount = balance - royaltyAmount;

        Address.sendValue(payable(_msgSender()), withdrawerAmount);
        if (payoutSplitterAddress != address(0)) {
            Address.sendValue(payable(payoutSplitterAddress), royaltyAmount);
        }
        emit Withdraw(balance, _msgSender(), withdrawerAmount, payoutSplitterAddress, royaltyAmount);
    }

    /**
        @dev This function can be used to update the pricePerToken.
            - This is usually called when having multiple pre-sales, with each pre-sale having different prices per Token.
        @param newPricePerToken_ The new pricePerToken for the NFT.
    */
    function setPricePerToken(uint256 newPricePerToken_) external onlyRole(DEPLOYER_ROLE) whenNotPaused {
        require(newPricePerToken_ > 0, "E005");
        require(newPricePerToken_ != pricePerToken, "E025");
        pricePerToken = newPricePerToken_;
        emit PricePerTokenUpdated(_msgSender(), newPricePerToken_);
    }

    /**
        @dev This function is used to mint `tokenCount_` number of tokens.
                It can be called by `mintTo()` or `reserve()` methods.
        @param tokenCount_ The number of tokens to be minted to msg.sender.
    */
    function _mintTokens(uint256 tokenCount_) private {
        require(tokenCount_ > 0, "E020");
        require(!_msgSender().isContract(), "E016");
        require(totalSupply() + tokenCount_ <= maxSupply, "E017");
        require(tokenCount_ <= maxTokensPerTxn, "E018");

        for(uint i = 1; i <= tokenCount_ ; i++) {
            uint256 tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            _safeMint(_msgSender(), tokenId);
        }
    }
}