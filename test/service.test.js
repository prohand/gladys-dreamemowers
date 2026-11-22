import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createService, MESSAGES } from '../src/service.js';
import { commandFor, didFromExternalId, FEATURE, mowerIds } from '../src/devices/mower.js';
import { createFakeCloud, mowerRecord, PASSWORD, USERNAME } from './helpers/fakeCloud.js';

const DID = '-111222333';
const CONFIG = { username: USERNAME, password: PASSWORD, language: 'fr' };

function setup({ created = true, mowers } = {}) {
  const gladys = createFakeGladys();
  const cloud = createFakeCloud(mowers ? { mowers } : undefined);
  cloud.setProperties(DID, { '2:1': 6, '2:2': 0, '3:1': 80, '3:2': 1 });
  const service = createService(gladys, { fetch: cloud.fetch });
  service.setConfig(CONFIG);
  if (created) {
    service.deviceKnown({ external_id: mowerIds(gladys, DID).device });
  }
  return { gladys, cloud, service, ids: mowerIds(gladys, DID) };
}

test('without an account the connection status asks for one', async () => {
  const gladys = createFakeGladys();
  const service = createService(gladys, { fetch: createFakeCloud().fetch });
  service.setConfig({});
  assert.equal(await service.sync({ publishDevices: true }), null);
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: MESSAGES.notConfigured,
  });
  assert.deepEqual(await service.testConnection(), MESSAGES.notConfigured);
});

test('the mowers are published to Discovery, and Gladys accepts them', async () => {
  const { gladys, service } = setup({ created: false });
  await service.sync({ force: true, publishDevices: true });
  const [list] = gladys.fake.discoveredDevices.slice(-1);
  const devices = Array.isArray(list) ? list : gladys.fake.discoveredDevices;
  const device = devices.find((d) => d.external_id === mowerIds(gladys, DID).device);
  assert.ok(device, 'the mower is in the discovery list');
  assert.equal(device.name, 'Front lawn');
  assert.equal(device.features.length, 6);
  assert.deepEqual(gladys.fake.states, [], 'no state for a mower not created in Gladys');
});

test('a created mower gets its states, its badge and a connected status', async () => {
  const { gladys, service, ids } = setup();
  await service.sync({ force: true });
  assert.equal(gladys.fake.lastState(ids.feature(FEATURE.BATTERY)), 80);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURE.CHARGING)), 1);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURE.MOWING)), 0);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURE.STATUS)), 'En charge');
  assert.equal(gladys.fake.lastState(ids.feature(FEATURE.ERROR)), 'Aucune erreur');
  assert.deepEqual(gladys.fake.transports.at(-1), {
    device_external_id: ids.device,
    transport: 'cloud',
  });
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
});

test('an offline mower shows the unreachable badge', async () => {
  const { gladys, service, ids } = setup({ mowers: [mowerRecord({ online: false })] });
  await service.sync({ force: true });
  assert.deepEqual(gladys.fake.transports.at(-1), {
    device_external_id: ids.device,
    transport: 'unreachable',
  });
});

test('a change of activity and a new error fire the scene triggers', async () => {
  const { gladys, cloud, service, ids } = setup();
  await service.sync({ force: true });
  assert.deepEqual(gladys.fake.sceneEvents, [], 'the first read fires nothing');

  cloud.setProperties(DID, { '2:1': 1, '3:2': 2 });
  await service.sync({ force: true });
  cloud.setProperties(DID, { '2:1': 4, '2:2': 2 });
  await service.sync({ force: true });

  const events = gladys.fake.sceneEvents.map(({ key, data }) => ({ key, data }));
  assert.deepEqual(events, [
    {
      key: 'status_changed',
      data: { device: ids.device, status: 'mowing', previous_status: 'docked', battery: 80 },
    },
    {
      key: 'status_changed',
      data: { device: ids.device, status: 'error', previous_status: 'mowing', battery: 80 },
    },
    {
      key: 'error_occurred',
      data: { device: ids.device, error_code: 2, error_text: 'Tondeuse coincée (2)' },
    },
  ]);
});

test('a refused login is reported once in the Configuration screen', async () => {
  const { gladys, cloud, service } = setup();
  cloud.state.refuseLogin = true;
  assert.equal(await service.sync({ force: true }), null);
  await service.sync({ force: true });
  const failures = gladys.fake.connectionStatuses.filter((s) => !s.connected);
  assert.equal(failures.length, 1, 'the same status is not sent again');
  assert.deepEqual(failures[0].message, MESSAGES.auth);
});

test('the test button lists the mowers found', async () => {
  const { service } = setup();
  const message = await service.testConnection();
  assert.match(
    message.fr,
    /Tondeuses trouvées \(1\) : Front lawn|Tondeuses trouvées \(1\): Front lawn/,
  );
  assert.ok(message.en && message.de && message.es);
});

test('the test button explains a refused login', async () => {
  const { cloud, service } = setup();
  cloud.state.refuseLogin = true;
  assert.deepEqual(await service.testConnection(), MESSAGES.auth);
});

test('a changed language re-uses the account, a changed password logs in again', async () => {
  const { cloud, service } = setup();
  await service.sync({ force: true });
  service.setConfig({ ...CONFIG, language: 'de' });
  await service.sync({ force: true });
  assert.equal(cloud.state.tokens, 1);
  service.setConfig({ ...CONFIG, password: 'other' });
  await service.sync({ force: true });
  assert.equal(cloud.state.tokens, 2);
});

test('the features map to the right commands', () => {
  assert.equal(commandFor(FEATURE.MOWING, 1), 'start');
  assert.equal(commandFor(FEATURE.MOWING, 0), 'pause');
  assert.equal(commandFor(FEATURE.DOCK, 1), 'dock');
  assert.equal(commandFor(FEATURE.DOCK, 0, { activity: 'docked' }), null);
  assert.equal(commandFor(FEATURE.DOCK, 0, { activity: 'returning' }), 'pause');
  assert.equal(commandFor(FEATURE.STATUS, 1), null);
});

test('a command reaches the cloud', async () => {
  const { cloud, service } = setup();
  await service.sync({ force: true });
  await service.command(DID, 'dock');
  assert.deepEqual(cloud.state.actions, [{ did: DID, siid: 5, aiid: 3 }]);
});

test('the cloud id is read back from the external id', () => {
  const gladys = createFakeGladys();
  assert.equal(didFromExternalId(gladys, mowerIds(gladys, DID).device), DID);
  assert.equal(didFromExternalId(gladys, 'ext:other:mower:1'), null);
  assert.equal(didFromExternalId(gladys, undefined), null);
});

test('the created devices are loaded from Gladys and follow deletions', async () => {
  const gladys = createFakeGladys();
  gladys.fake.devices = [{ external_id: mowerIds(gladys, DID).device }];
  const cloud = createFakeCloud();
  const service = createService(gladys, { fetch: cloud.fetch });
  service.setConfig(CONFIG);
  await service.loadCreatedDevices();
  await service.sync({ force: true });
  assert.ok(gladys.fake.states.length > 0);
  service.deviceDeleted({ external_id: mowerIds(gladys, DID).device });
  assert.equal(service.isCreated({ did: DID }), false);
});
