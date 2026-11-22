import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyProperties,
  createAccount,
  mowerFromRecord,
  transitions,
} from '../src/dreame/account.js';
import { normalizeConfig } from '../src/config.js';
import { createFakeCloud, mowerRecord, PASSWORD, USERNAME } from './helpers/fakeCloud.js';

const config = normalizeConfig({ username: USERNAME, password: PASSWORD });

test('a device list record becomes a mower', () => {
  const mower = mowerFromRecord(mowerRecord());
  assert.equal(mower.name, 'Front lawn');
  assert.equal(mower.modelName, 'Dreame A1');
  assert.equal(mower.battery, 80);
  assert.equal(mower.activity, 'docked');
  assert.equal(mower.online, true);
});

test('a mower without a name is called by its model', () => {
  assert.equal(mowerFromRecord(mowerRecord({ customName: '' })).name, 'Dreame A1');
  assert.equal(
    mowerFromRecord(mowerRecord({ customName: null, model: 'dreame.mower.new1' })).name,
    'dreame.mower.new1',
  );
});

test('the properties override the list values, an unreadable one keeps them', () => {
  const mower = applyProperties(mowerFromRecord(mowerRecord()), [
    { siid: 2, piid: 1, code: 0, value: 1 },
    { siid: 2, piid: 2, code: 0, value: 0 },
    { siid: 3, piid: 1, code: -4003 },
    { siid: 3, piid: 2, code: 0, value: 2 },
  ]);
  assert.equal(mower.status, 1);
  assert.equal(mower.activity, 'mowing');
  assert.equal(mower.error, 0);
  assert.equal(mower.battery, 80);
  assert.equal(mower.charging, false);
});

test('changes between two reads are reported once', () => {
  const before = { did: 'a', activity: 'docked', error: 0 };
  assert.deepEqual(transitions(undefined, before), [], 'the first read is not a change');
  assert.deepEqual(transitions(before, { ...before }), []);
  assert.deepEqual(transitions(before, { ...before, activity: 'mowing' }), [
    { type: 'status_changed', did: 'a', status: 'mowing', previous_status: 'docked' },
  ]);
  const stuck = { did: 'a', activity: 'error', error: 2 };
  assert.deepEqual(
    transitions({ ...before, activity: 'mowing' }, stuck).map((t) => t.type),
    ['status_changed', 'error_occurred'],
  );
  assert.deepEqual(transitions(stuck, { ...stuck }), [], 'the same error is not new');
});

test('one read lists the mowers only, and asks the online ones for their properties', async () => {
  const cloud = createFakeCloud({
    mowers: [
      mowerRecord(),
      mowerRecord({ did: '42', online: false, customName: 'Back lawn' }),
      { did: '7', model: 'dreame.vacuum.r2228', customName: 'Vacuum' },
    ],
  });
  cloud.setProperties('-111222333', { '2:1': 1, '2:2': 0, '3:1': 64, '3:2': 2 });
  const account = createAccount(config, { fetch: cloud.fetch });
  const { mowers } = await account.refresh();
  assert.deepEqual(
    mowers.map((m) => m.name),
    ['Front lawn', 'Back lawn'],
  );
  assert.equal(mowers[0].battery, 64);
  assert.equal(mowers[0].activity, 'mowing');
  const commands = cloud.state.requests.filter((r) => r.pathname.endsWith('/sendCommand'));
  assert.equal(commands.length, 1, 'the offline mower is not asked');
});

test('a mower the cloud says is offline is marked so', async () => {
  const cloud = createFakeCloud();
  cloud.state.offline.add('-111222333');
  const account = createAccount(config, { fetch: cloud.fetch });
  const { mowers } = await account.refresh();
  assert.equal(mowers[0].online, false);
});

test('reads are shared: one per interval, whichever device asks', async () => {
  const cloud = createFakeCloud();
  let clock = 1_000_000;
  const account = createAccount(config, { fetch: cloud.fetch, now: () => clock });
  const [first, second] = await Promise.all([account.refreshIfDue(60), account.refreshIfDue(60)]);
  assert.equal(first, second, 'concurrent callers share the read');
  assert.equal(await account.refreshIfDue(60), null, 'not due yet');
  clock += 45 * 1000; // within the 30 s tolerance of a 60 s interval
  assert.ok(await account.refreshIfDue(60));
  const lists = cloud.state.requests.filter((r) => r.pathname.endsWith('/listV2'));
  assert.equal(lists.length, 2);
});

test('a refused login is not retried before the next interval', async () => {
  const cloud = createFakeCloud();
  cloud.state.refuseLogin = true;
  let clock = 1_000_000;
  const account = createAccount(config, { fetch: cloud.fetch, now: () => clock });
  await assert.rejects(account.refreshIfDue(300), { kind: 'auth' });
  assert.equal(await account.refreshIfDue(300), null);
  assert.equal(account.lastError.kind, 'auth');
  clock += 300 * 1000;
  await assert.rejects(account.refreshIfDue(300), { kind: 'auth' });
});

test('commands go to the right action of the right mower', async () => {
  const cloud = createFakeCloud();
  const account = createAccount(config, { fetch: cloud.fetch });
  await account.refresh();
  for (const command of ['start', 'pause', 'stop', 'dock']) {
    await account.command('-111222333', command);
  }
  assert.deepEqual(
    cloud.state.actions.map((a) => `${a.siid}:${a.aiid}`),
    ['5:1', '5:4', '5:2', '5:3'],
  );
  await assert.rejects(account.command('-111222333', 'fly'), /Unknown command/);
  await assert.rejects(account.command('nope', 'start'), /Unknown mower/);
});
