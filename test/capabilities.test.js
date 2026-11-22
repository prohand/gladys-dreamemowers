import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createService, MOWER_WIDGET } from '../src/service.js';
import { mowerIds } from '../src/devices/mower.js';
import { SCENE_ACTIONS } from '../src/capabilities/scenes.js';
import { WIDGETS } from '../src/capabilities/widget.js';
import { createFakeCloud, mowerRecord, PASSWORD, USERNAME } from './helpers/fakeCloud.js';

const DID = '-111222333';
const widget = WIDGETS[MOWER_WIDGET];

async function setup({ created = false } = {}) {
  const gladys = createFakeGladys();
  const cloud = createFakeCloud({
    mowers: [mowerRecord(), mowerRecord({ did: '42', customName: 'Back' })],
  });
  cloud.setProperties(DID, { '2:1': 4, '2:2': 7, '3:1': 15 });
  const service = createService(gladys, { fetch: cloud.fetch });
  service.setConfig({ username: USERNAME, password: PASSWORD });
  if (created) {
    service.deviceKnown({ external_id: mowerIds(gladys, DID).device });
  }
  await service.sync({ force: true });
  return { gladys, cloud, service };
}

const get = (gladys, service, settings = {}) =>
  widget.get(gladys, { settings, language: 'en', units: 'metric', service });

test('the widget content is rendered exactly as sent', async () => {
  const { gladys, service } = await setup();
  const content = await get(gladys, service);
  assert.deepEqual(validateWidgetContent(content), []);
  const status = content.components.find((c) => c.type === 'status');
  assert.equal(status.items[1].color, 'danger', 'an error shows in red');
  assert.equal(status.items[1].value.en, 'Blade disc blocked (7)');
});

test('the widget binds the battery live once the mower is created', async () => {
  const { gladys, service } = await setup({ created: true });
  const content = await get(gladys, service);
  assert.deepEqual(validateWidgetContent(content), []);
  const gauge = content.components.find((c) => c.type === 'gauge');
  assert.equal(gauge.device_feature, mowerIds(gladys, DID).feature('battery'));
});

test('the widget shows the mower chosen in its settings', async () => {
  const { gladys, service } = await setup();
  const content = await get(gladys, service, { device: mowerIds(gladys, '42').device });
  assert.equal(content.components[0].text, 'Back');
});

test('without a mower the widget explains what to do', async () => {
  const gladys = createFakeGladys();
  const service = createService(gladys, { fetch: createFakeCloud().fetch });
  service.setConfig({});
  const content = await get(gladys, service);
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].type, 'text');
});

test('every button of the widget is handled and answers a short toast', async () => {
  const { gladys, cloud, service } = await setup();
  const buttons = (await get(gladys, service)).components.filter((c) => c.type === 'button');
  assert.equal(buttons.length, 3);
  for (const { action } of buttons) {
    const toast = await widget.action(gladys, {
      actionKey: action.key,
      params: action.params,
      settings: {},
      service,
    });
    assert.ok(toast.en.length <= 200);
    assert.ok(toast.fr && toast.de && toast.es);
  }
  assert.deepEqual(
    cloud.state.actions.map((a) => a.aiid),
    [1, 4, 3],
  );
  await assert.rejects(
    widget.action(gladys, { actionKey: 'fly', params: { did: DID }, settings: {}, service }),
    /Unknown widget action/,
  );
});

test('the scene action sends the command and says so', async () => {
  const { gladys, cloud, service } = await setup();
  const device = mowerIds(gladys, DID).device;
  assert.deepEqual(
    await SCENE_ACTIONS.mower_command(gladys, { fields: { device, command: 'stop' }, service }),
    { sent: true },
  );
  assert.deepEqual(cloud.state.actions, [{ did: DID, siid: 5, aiid: 2 }]);
});

test('the scene action reports an unreachable mower as an output, not a failure', async () => {
  const { gladys, cloud, service } = await setup();
  cloud.state.offline.add(DID);
  const device = mowerIds(gladys, DID).device;
  assert.deepEqual(
    await SCENE_ACTIONS.mower_command(gladys, { fields: { device, command: 'start' }, service }),
    { sent: false },
  );
  assert.deepEqual(
    await SCENE_ACTIONS.mower_command(gladys, {
      fields: { device: 'ext:other:x', command: 'start' },
      service,
    }),
    { sent: false },
  );
});
