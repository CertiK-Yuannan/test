// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/finance/PaymentSplitter.sol";

/// @title Contract with PaymentSplitter functionality.

contract PayoutSplitterV1 is PaymentSplitter {
    /**
     * @dev Creates an instance of `PaymentSplitter` where each account in `payees` is assigned the number of shares at
     * the matching position in the `shares` array.
     *
     * All addresses in `payees` must be non-zero. Both arrays must have the same non-zero length, and there must be no
     * duplicates in `payees`.
     *
     * @param payees_ The Payees participating in the PaymentSplitter
     * @param shares_ The shares assigned to each Payee participating in the PaymentSplitter
     */    
    constructor(address[] memory payees_, uint256[] memory shares_)
        PaymentSplitter(payees_, shares_)
    {}
}
