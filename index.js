// -----------------------------------------------------------------------------
// Entry point of the Dreame Mowers integration for Gladys Assistant.
//
// This file only wires the SDK events to the service (src/service.js), which
// reads the Dreame cloud and tells Gladys. No cloud logic here.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createService } from './src/service.js';
import { commandFor, didFromExternalId, featureKeyOf } from './src/devices/mower.js';
import { SCENE_ACTIONS } from './src/capabilities/scenes.js';
import { WIDGETS } from './src/capabilities/widget.js';

const gladys = new GladysIntegration();
const service = createService(gladys);

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> reading the mowers of the account');
  await service.sync({ force: true, publishDevices: true });
});

// --- Polling: Gladys polls each created mower every minute ------------------
// The cloud is read once per refresh interval for all the mowers.
gladys.onPoll(async (device) => {
  service.deviceKnown(device);
  await service.sync();
});

gladys.onDeviceCreated(async (device) => {
  service.deviceKnown(device);
  await service.sync({ force: true });
});

gladys.onDeviceDeleted((device) => {
  service.deviceDeleted(device);
});

// --- Command: the user acts on "Mowing" or "Return to base" ------------------
gladys.onSetValue(async (device, feature, value) => {
  const did = didFromExternalId(gladys, device.external_id);
  const command = did && commandFor(featureKeyOf(feature.external_id), value, service.mower(did));
  logger.info(`onSetValue <- ${feature.external_id} = ${value} -> ${command ?? 'nothing to send'}`);
  if (!did) {
    // Throw: the SDK sends a success:false acknowledgement to Gladys.
    throw new Error(`Unknown device ${device.external_id}`);
  }
  if (command) {
    await service.command(did, command);
  }
});

// --- Manifest action: button of the Configuration screen ---------------------
gladys.onAction('test_connection', () => service.testConnection());

// --- Scene actions (Gladys 5.1+) ---------------------------------------------
// Scene TRIGGERS need no handler: src/service.js fires them.
for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(key, (fields) => handler(gladys, { fields, service }));
}

// --- Dashboard widget (Gladys 5.1+) ------------------------------------------
for (const [key, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(key, (request) => widget.get(gladys, { ...request, service }));
  gladys.onWidgetAction(key, (actionKey, params, { settings }) =>
    widget.action(gladys, { actionKey, params, settings, service }),
  );
}

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  service.setConfig(newConfig);
  await service.sync({ force: true, publishDevices: true });
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  try {
    service.setConfig(await gladys.getConfig());
    service.forgetConnectionStatus();
    await service.loadCreatedDevices();
    await service.sync({ force: true, publishDevices: true });
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Initialization failed, check the integration logs.',
        fr: 'L’initialisation a échoué, consultez les logs de l’intégration.',
        de: 'Initialisierung fehlgeschlagen, siehe Protokolle der Integration.',
        es: 'La inicialización falló, consulte los registros de la integración.',
      })
      .catch(() => {});
  }
});

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the Dreame Mowers integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
