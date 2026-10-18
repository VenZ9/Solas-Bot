const test = require('node:test');
const assert = require('node:assert/strict');
const { registerClient, getClient, gracefulShutdown } = require('../src/utils/lifecycle');
const { initDatabase, closeDatabase } = require('../src/database');

test('System Lifecycle & Graceful Shutdown', async (t) => {
  await t.test('registerClient stores and retrieves client reference', () => {
    const dummyClient = { id: 'dummy_client' };
    registerClient(dummyClient);
    assert.equal(getClient(), dummyClient);
  });

  await t.test('gracefulShutdown cleanly terminates client, db, and sweepers without terminating process', async () => {
    // Set up test environment
    closeDatabase();
    initDatabase(':memory:');

    let clientDestroyCalled = false;
    let exitCode = null;

    const mockClient = {
      destroy() {
        clientDestroyCalled = true;
      },
    };
    registerClient(mockClient);

    const mockExit = (code) => {
      exitCode = code;
    };

    // Execute graceful shutdown with mock exit function
    await gracefulShutdown('TEST_SIGNAL', mockExit);

    assert.equal(clientDestroyCalled, true, 'client.destroy should have been called');
    assert.equal(exitCode, 0, 'exit code should be 0');
  });
});
