import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountKey, DEFAULT_CONFIG, isConfigured, normalizeConfig } from '../src/config.js';

test('an empty config gets the defaults', () => {
  const config = normalizeConfig();
  assert.equal(config.account_type, DEFAULT_CONFIG.account_type);
  assert.equal(config.region, 'eu');
  assert.equal(config.language, 'en');
  assert.equal(config.poll_frequency, 60);
  assert.equal(isConfigured(config), false);
});

test('values outside the allowed lists fall back to the defaults', () => {
  const config = normalizeConfig({
    account_type: 'roomba',
    region: 'mars',
    language: 'it',
    poll_frequency: 'often',
  });
  assert.equal(config.account_type, 'dreame');
  assert.equal(config.region, 'eu');
  assert.equal(config.language, 'en');
  assert.equal(config.poll_frequency, 60);
});

test('the refresh interval stays between one minute and one hour', () => {
  assert.equal(normalizeConfig({ poll_frequency: 5 }).poll_frequency, 60);
  assert.equal(normalizeConfig({ poll_frequency: '300' }).poll_frequency, 300);
  assert.equal(normalizeConfig({ poll_frequency: 99999 }).poll_frequency, 3600);
});

test('the e-mail is trimmed, the password is kept as typed', () => {
  const config = normalizeConfig({
    username: ' me@example.com ',
    password: ' pass ',
    region: 'US',
  });
  assert.equal(config.username, 'me@example.com');
  assert.equal(config.password, ' pass ');
  assert.equal(config.region, 'us');
  assert.ok(isConfigured(config));
});

test('the account key only follows the credentials', () => {
  const base = normalizeConfig({ username: 'a', password: 'b' });
  assert.equal(accountKey(base), accountKey({ ...base, language: 'fr', poll_frequency: 120 }));
  assert.notEqual(accountKey(base), accountKey({ ...base, region: 'us' }));
});
