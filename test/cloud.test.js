import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCloudClient, DreameError, hashPassword } from '../src/dreame/cloud.js';
import { createFakeCloud, mowerRecord, PASSWORD, USERNAME } from './helpers/fakeCloud.js';

const client = (cloud, options = {}) =>
  createCloudClient({ username: USERNAME, password: PASSWORD, fetch: cloud.fetch, ...options });

test('the login sends the salted hash of the password, never the password', async () => {
  const cloud = createFakeCloud();
  await client(cloud).connect();
  const [login] = cloud.state.requests;
  assert.equal(login.hostname, 'eu.iot.dreame.tech');
  assert.equal(login.pathname, '/dreame-auth/oauth/token');
  assert.ok(!login.init.body.includes(PASSWORD), 'the password must not travel in clear');
  const body = new URLSearchParams(login.init.body);
  assert.equal(body.get('password'), hashPassword(PASSWORD));
  assert.match(body.get('password'), /^[0-9a-f]{32}$/);
  assert.equal(body.get('grant_type'), 'password');
  assert.equal(login.init.headers['Tenant-Id'], '000000');
  assert.equal(login.init.headers['Dreame-Rlc'], undefined);
});

test('a MOVA account and the China region use their own host, tenant and header', async () => {
  const cloud = createFakeCloud();
  await client(cloud, { accountType: 'mova', region: 'cn' })
    .connect()
    .catch(() => {});
  const [login] = cloud.state.requests;
  assert.equal(login.hostname, 'cn.iot.mova-tech.com');
  assert.equal(login.init.headers['Tenant-Id'], '000002');
  assert.match(login.init.headers['User-Agent'], /^Mova_Smarthome/);
  assert.ok(login.init.headers['Dreame-Rlc']);
});

test('the device list is read with the token', async () => {
  const cloud = createFakeCloud();
  const records = await client(cloud).listDevices();
  assert.equal(records.length, 1);
  const list = cloud.state.requests.at(-1);
  assert.equal(list.init.headers['Dreame-Auth'], 'token-1');
  assert.equal(list.init.headers['Content-Type'], 'application/json');
});

test('commands go to the gateway of the mower and come back as results', async () => {
  const cloud = createFakeCloud();
  const mower = mowerRecord();
  cloud.setProperties(mower.did, { '2:1': 1, '3:1': 55 });
  const api = client(cloud);
  const result = await api.getProperties(mower, [
    { siid: 2, piid: 1 },
    { siid: 3, piid: 1 },
  ]);
  assert.deepEqual(
    result.map((p) => p.value),
    [1, 55],
  );
  assert.equal(cloud.state.requests.at(-1).pathname, '/dreame-iot-com-10000/device/sendCommand');
  await api.action(mower, { siid: 5, aiid: 1 });
  assert.deepEqual(cloud.state.actions, [{ did: mower.did, siid: 5, aiid: 1 }]);
});

test('commands are sent one at a time, each with its own id', async () => {
  const cloud = createFakeCloud();
  const mower = mowerRecord();
  const api = client(cloud);
  await Promise.all([
    api.action(mower, { siid: 5, aiid: 1 }),
    api.action(mower, { siid: 5, aiid: 4 }),
    api.action(mower, { siid: 5, aiid: 3 }),
  ]);
  const ids = cloud.state.requests
    .filter((r) => r.pathname.endsWith('/sendCommand'))
    .map((r) => JSON.parse(r.init.body).id);
  assert.equal(new Set(ids).size, 3);
  assert.deepEqual(
    cloud.state.actions.map((a) => a.aiid),
    [1, 4, 3],
  );
});

test('wrong credentials are an auth error', async () => {
  const cloud = createFakeCloud();
  cloud.state.refuseLogin = true;
  await assert.rejects(client(cloud).listDevices(), (err) => {
    assert.ok(err instanceof DreameError);
    assert.equal(err.kind, 'auth');
    return true;
  });
});

test('a mower that is not connected is an offline error', async () => {
  const cloud = createFakeCloud();
  const mower = mowerRecord();
  cloud.state.offline.add(mower.did);
  await assert.rejects(client(cloud).action(mower, { siid: 5, aiid: 1 }), { kind: 'offline' });
});

test('a cloud out of reach is a network error', async () => {
  const cloud = createFakeCloud();
  cloud.state.networkDown = true;
  await assert.rejects(client(cloud).listDevices(), { kind: 'network' });
});

test('an expired token is renewed once with the refresh token', async () => {
  const cloud = createFakeCloud();
  const api = client(cloud);
  await api.listDevices();
  cloud.state.expireTokens = true;
  const records = await api.listDevices();
  assert.equal(records.length, 1);
  const logins = cloud.state.requests.filter((r) => r.pathname === '/dreame-auth/oauth/token');
  assert.equal(logins.length, 2);
  assert.equal(new URLSearchParams(logins[1].init.body).get('grant_type'), 'refresh_token');
});

test('the token is renewed before it expires', async () => {
  const cloud = createFakeCloud();
  let clock = 0;
  const api = client(cloud, { now: () => clock });
  await api.listDevices();
  clock += 7200 * 1000; // the fake cloud gives 2 hours
  await api.listDevices();
  assert.equal(cloud.state.tokens, 2);
});
