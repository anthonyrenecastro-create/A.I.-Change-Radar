import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadConfig } from '../server/config';
import { signBillingPayload, verifyBillingSignature } from '../server/billing';
import { AttemptLimiter, hashPassword, verifyPassword } from '../server/security';

test('passwords are salted scrypt; legacy SHA-256 digests verify once and are flagged for rehash', async () => {
  const a = await hashPassword('correct horse battery'); const b = await hashPassword('correct horse battery');
  assert.match(a, /^scrypt\$/); assert.notEqual(a, b);
  assert.deepEqual(await verifyPassword('correct horse battery', a), { ok: true, needsRehash: false });
  assert.equal((await verifyPassword('wrong', a)).ok, false);
  const legacy = createHash('sha256').update('old-password').digest('hex');
  assert.deepEqual(await verifyPassword('old-password', legacy), { ok: true, needsRehash: true });
  assert.equal((await verifyPassword('nope', legacy)).ok, false);
  assert.equal((await verifyPassword('x', 'disabled')).ok, false);
});

test('attempt limiter blocks after max failures and recovers after the window', () => {
  let t = 0; const l = new AttemptLimiter(3, 1000, () => t);
  for (let i = 0; i < 3; i++) l.fail('k');
  assert.ok(l.blockedFor('k') > 0); t = 1001; assert.equal(l.blockedFor('k'), 0);
});

test('billing signatures: valid accepted; tampered, stale, missing and empty-secret rejected', () => {
  const secret = 's'.repeat(32); const body = JSON.stringify({ a: 1 });
  const header = signBillingPayload(secret, body);
  assert.ok(verifyBillingSignature(secret, Buffer.from(body), header));
  assert.ok(!verifyBillingSignature(secret, Buffer.from(body + ' '), header));
  assert.ok(!verifyBillingSignature(secret, Buffer.from(body), signBillingPayload(secret, body, 1000)));
  assert.ok(!verifyBillingSignature(secret, Buffer.from(body), undefined));
  assert.ok(!verifyBillingSignature(secret, Buffer.from(body), 't=abc,v1=zz'));
  assert.ok(!verifyBillingSignature('', Buffer.from(body), signBillingPayload('', body)));
});

test('production config requires secrets, APP_URL and a disabled lab', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), /BILLING_WEBHOOK_SECRET/);
  assert.throws(() => loadConfig({ NODE_ENV: 'production', BILLING_WEBHOOK_SECRET: 'x'.repeat(32), APP_URL: 'https://a.example', ENABLE_LAB: 'true' } as NodeJS.ProcessEnv), /ENABLE_LAB/);
  const ok = loadConfig({ NODE_ENV: 'production', BILLING_WEBHOOK_SECRET: 'x'.repeat(32), APP_URL: 'https://a.example' } as NodeJS.ProcessEnv);
  assert.equal(ok.enableLab, false); assert.equal(ok.allowPublicDemo, false); assert.equal(ok.seedDemoOnStart, false);
});
