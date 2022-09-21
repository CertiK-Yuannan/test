const PayoutSplitter = artifacts.require("PayoutSplitterV1");

contract("PayoutSplitterV1", function (accounts) {
  xdescribe("", () => {   //  Disabling Phase-2 Tests
    let payoutSplitter;
    const payees = [accounts[1], accounts[2]];
    const payeeShares = [2500, 7500]; //  25% , 75% shares

    beforeEach(async () => {
      payoutSplitter = await PayoutSplitter.new(payees, payeeShares);
    });

    it("should be initialized correctly", async () => {
      const actualTotalShares = await payoutSplitter.totalShares();
      assert.equal(actualTotalShares, payeeShares[0] + payeeShares[1]);

      const actualPayee0 = await payoutSplitter.payee(0);
      const actualPayee1 = await payoutSplitter.payee(1);
      assert.equal(actualPayee0, payees[0]);
      assert.equal(actualPayee1, payees[1]);

      const actualSharesPayee0 = await payoutSplitter.shares(payees[0]);
      const actualSharesPayee1 = await payoutSplitter.shares(payees[1]);
      assert.equal(actualSharesPayee0, payeeShares[0]);
      assert.equal(actualSharesPayee1, payeeShares[1]);

      const actualTotalReleased = await payoutSplitter.totalReleased();
      const actualTotalReleasedPayee0 = await payoutSplitter.released(payees[0]);
      const actualTotalReleasedPayee1 = await payoutSplitter.released(payees[1]);
      assert.equal(actualTotalReleased, 0);
      assert.equal(actualTotalReleasedPayee0, 0);
      assert.equal(actualTotalReleasedPayee1, 0);
    });
  });
});