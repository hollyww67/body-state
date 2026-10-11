// Test-only provider contracts. Not imported into the production application.
const assert = require('node:assert/strict');
function providers() {
  const payments = new Map();
  const receipts = new Map();
  return {
    payment(key, amount) {
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid minor units');
      const old = payments.get(key);
      if (old && old.amount !== amount) throw new Error('Idempotency conflict');
      if (!old) payments.set(key, { id: `mock-${payments.size + 1}`, amount, status: 'pending', url: 'https://example.invalid/mock-payment' });
      return payments.get(key);
    },
    receipt(key) {
      if (!receipts.has(key)) receipts.set(key, { id: `mock-receipt-${receipts.size + 1}`, status: 'accepted', fiscalized: false });
      return receipts.get(key);
    },
  };
}
module.exports = { providers };
if (require.main === module) {
  const mock = providers();
  assert.equal(mock.payment('one', 100), mock.payment('one', 100));
  assert.throws(() => mock.payment('one', 200));
  assert.throws(() => mock.payment('negative', -1));
  assert.equal(mock.receipt('one'), mock.receipt('one'));
  assert.equal(mock.receipt('one').fiscalized, false);
  console.log('PASS offline payment/KKT contract fixtures; no real payment or fiscalization');
}
