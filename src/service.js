// -----------------------------------------------------------------------------
// The integration's state, between Gladys and the Dreame cloud.
//
// index.js only wires the SDK events to this object. It keeps:
//   - the normalized config, and the account built from it (a new login only
//     when the credentials change);
//   - the devices the user actually created in Gladys: states are only
//     published for those (a mower listed in Discovery but never added has no
//     feature to receive them);
//   - the last connection status sent, so it is sent again only when it
//     changes.
//
// `sync` is the one place that reads the cloud and tells Gladys: devices,
// states, transport badges, scene events, connection status, widget refresh.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { accountKey, isConfigured, normalizeConfig } from './config.js';
import { createAccount } from './dreame/account.js';
import { DreameError } from './dreame/cloud.js';
import { errorText } from './dreame/spec.js';
import {
  buildMowerDevice,
  didFromExternalId,
  mowerIds,
  mowerStates,
  mowerTransport,
} from './devices/mower.js';
import { localize, pick } from './i18n.js';

const logger = createLogger({ name: 'service' });

// An unchanged value is re-sent every 30 minutes, so it stays recently dated.
const STATE_HEARTBEAT_MS = 30 * 60 * 1000;

// Key of the dashboard widget (manifest `widgets`).
export const MOWER_WIDGET = 'mower';

export const MESSAGES = {
  notConfigured: {
    en: 'Enter the e-mail and password of your Dreame or MOVA account.',
    fr: 'Saisissez l’e-mail et le mot de passe de votre compte Dreame ou MOVA.',
    de: 'Gib die E-Mail und das Passwort deines Dreame- oder MOVA-Kontos ein.',
    es: 'Introduzca el correo y la contraseña de su cuenta Dreame o MOVA.',
  },
  auth: {
    en: 'Login refused: check the e-mail, the password, the app and the region.',
    fr: 'Connexion refusée : vérifiez l’e-mail, le mot de passe, l’application et la région.',
    de: 'Anmeldung abgelehnt: E-Mail, Passwort, App und Region prüfen.',
    es: 'Acceso rechazado: compruebe el correo, la contraseña, la app y la región.',
  },
  network: {
    en: 'The Dreame cloud does not answer, retrying at the next refresh.',
    fr: 'Le cloud Dreame ne répond pas, nouvel essai au prochain rafraîchissement.',
    de: 'Die Dreame-Cloud antwortet nicht, neuer Versuch bei der nächsten Aktualisierung.',
    es: 'La nube de Dreame no responde, se reintentará en la próxima actualización.',
  },
  api: {
    en: 'The Dreame cloud returned an error, check the integration logs.',
    fr: 'Le cloud Dreame a renvoyé une erreur, consultez les logs de l’intégration.',
    de: 'Die Dreame-Cloud meldet einen Fehler, siehe Protokolle der Integration.',
    es: 'La nube de Dreame devolvió un error, consulte los registros de la integración.',
  },
};

/** The message shown in the Configuration screen for a failed read. */
export function messageFor(err) {
  return MESSAGES[err instanceof DreameError ? err.kind : 'api'] ?? MESSAGES.api;
}

/**
 * @param {object} gladys SDK instance
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch] injected in the tests
 * @param {() => number} [options.now] injected in the tests
 */
export function createService(gladys, { fetch, now } = {}) {
  let config = normalizeConfig();
  let account = null;
  let accountId = null;
  const created = new Set();
  let lastConnection = null;

  function setConfig(raw) {
    config = normalizeConfig(raw);
    const id = isConfigured(config) ? accountKey(config) : null;
    if (id !== accountId) {
      accountId = id;
      account = id ? createAccount(config, { fetch, now }) : null;
      lastConnection = null;
    }
    return config;
  }

  async function reportConnection(connected, message) {
    const key = JSON.stringify([connected, message?.en ?? null]);
    if (key === lastConnection) {
      return;
    }
    lastConnection = key;
    await gladys.setConnectionStatus(connected, message);
  }

  const isCreated = (mower) => created.has(mowerIds(gladys, mower.did).device);

  async function publishSceneEvents(changes) {
    for (const change of changes) {
      const mower = account.get(change.did);
      const device = mowerIds(gladys, change.did).device;
      const data =
        change.type === 'status_changed'
          ? {
              device,
              status: change.status,
              previous_status: change.previous_status,
              battery: mower?.battery ?? null,
            }
          : {
              device,
              error_code: change.error_code,
              error_text: errorText(change.error_code, config.language),
            };
      logger.info(`Scene event ${change.type} <- ${mower?.name ?? change.did}`);
      await gladys.publishSceneEvent(change.type, data);
    }
  }

  /**
   * Read the cloud and tell Gladys.
   * @param {object} [options]
   * @param {boolean} [options.force] read now, even if the last read is recent
   * @param {boolean} [options.publishDevices] also (re)publish the discovery list
   * @returns {Promise<object[] | null>} the mowers, null when nothing was read
   */
  async function sync({ force = false, publishDevices = false } = {}) {
    if (!account) {
      await reportConnection(false, MESSAGES.notConfigured);
      if (publishDevices) {
        await gladys.publishDiscoveredDevices([]);
      }
      return null;
    }
    let result;
    try {
      result = force ? await account.refresh() : await account.refreshIfDue(config.poll_frequency);
    } catch (err) {
      logger.warn(`Reading the Dreame cloud failed: ${err.message}`);
      await reportConnection(false, messageFor(err));
      return null;
    }
    if (!result) {
      return null;
    }
    const { mowers, transitions } = result;
    if (publishDevices) {
      await gladys.publishDiscoveredDevices(mowers.map((mower) => buildMowerDevice(gladys, mower)));
    }
    const mine = mowers.filter(isCreated);
    const states = mine.flatMap((mower) => mowerStates(gladys, mower, config.language));
    if (states.length > 0) {
      await gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
    }
    if (mine.length > 0) {
      await gladys.publishTransports(mine.map((mower) => mowerTransport(gladys, mower)));
    }
    await publishSceneEvents(transitions);
    await reportConnection(true);
    gladys.requestWidgetRefresh(MOWER_WIDGET);
    return mowers;
  }

  return {
    setConfig,
    sync,

    get config() {
      return config;
    },

    /** After a reconnection, send the connection status again even if unchanged. */
    forgetConnectionStatus() {
      lastConnection = null;
    },

    /** Seed the created devices from Gladys (at every connection). */
    async loadCreatedDevices() {
      const devices = await gladys.getDevices();
      created.clear();
      for (const device of devices ?? []) {
        if (didFromExternalId(gladys, device.external_id)) {
          created.add(device.external_id);
        }
      }
    },

    /** A device Gladys polls or just created is one to publish states for. */
    deviceKnown(device) {
      if (didFromExternalId(gladys, device?.external_id)) {
        created.add(device.external_id);
      }
    },

    deviceDeleted(device) {
      created.delete(device?.external_id);
    },

    /** The mowers of the last read. */
    mowers() {
      return account ? account.list() : [];
    },

    /** @param {string} did */
    mower(did) {
      return account?.get(did);
    },

    /** @param {object} device a mower of the last read */
    isCreated,

    /**
     * Send a command to a mower, then read it again so Gladys shows what the
     * mower really did (`has_feedback`).
     * @param {string} did cloud id of the mower
     * @param {string} command start | pause | stop | dock
     */
    async command(did, command) {
      if (!account) {
        throw new Error(pick('en', MESSAGES.notConfigured));
      }
      await account.command(did, command);
      // The mower takes a few seconds to change its status: read it back
      // shortly, without holding the command acknowledgement.
      const timer = setTimeout(() => {
        sync({ force: true }).catch((err) => logger.warn(`Refresh after command failed: ${err}`));
      }, 5000);
      timer.unref?.();
    },

    /** Handler of the "Test the connection" button. */
    async testConnection() {
      if (!account) {
        return MESSAGES.notConfigured;
      }
      try {
        await account.test();
      } catch (err) {
        await reportConnection(false, messageFor(err));
        return messageFor(err);
      }
      const mowers = (await sync({ force: true, publishDevices: true })) ?? account.list();
      const names = mowers.map((mower) => mower.name).join(', ');
      return localize((language) =>
        mowers.length === 0
          ? pick(language, {
              en: 'Connected, but no mower is bound to this account.',
              fr: 'Connecté, mais aucune tondeuse n’est liée à ce compte.',
              de: 'Verbunden, aber diesem Konto ist kein Mäher zugeordnet.',
              es: 'Conectado, pero no hay ningún robot vinculado a esta cuenta.',
            })
          : `${pick(language, {
              en: 'Connected. Mowers found',
              fr: 'Connecté. Tondeuses trouvées',
              de: 'Verbunden. Gefundene Mäher',
              es: 'Conectado. Robots encontrados',
            })} (${mowers.length}): ${names}`,
      );
    },
  };
}
