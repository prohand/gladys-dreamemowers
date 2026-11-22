// -----------------------------------------------------------------------------
// The mowers of one Dreame / MOVA account, as last read from the cloud.
//
// One read covers every mower: the device list already carries the online flag,
// the battery and the last status; the mowers that are online are then asked
// for the four properties the list does not carry fresh (status, error,
// battery, charging). Gladys polls each device every minute, so the reads are
// shared: `refresh` runs at most once per refresh interval, whichever device
// asked, and concurrent callers wait for the same read.
//
// Between two reads the module compares the states and reports what changed
// (`transitions`): the scene triggers are fired from there.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { createCloudClient, DreameError } from './cloud.js';
import { activityOf, ACTIVITY, COMMANDS, isMowerModel, MODEL_NAMES, PROPERTIES } from './spec.js';

const logger = createLogger({ name: 'account' });

// Gladys' poll ticks drift by a few milliseconds: a read due within the next
// half-minute runs now, so a 60 s interval does not slip to 120 s.
const REFRESH_TOLERANCE_MS = 30 * 1000;

/**
 * @typedef {object} Mower
 * @property {string} did cloud id of the mower
 * @property {string} name name given in the app, or the model name
 * @property {string} model MIoT model, e.g. `dreame.mower.p2255`
 * @property {string} modelName commercial name, e.g. `Dreame A1`
 * @property {string | null} firmware
 * @property {string | undefined} bindDomain command gateway of the mower
 * @property {boolean} online connected to the cloud
 * @property {number | null} status raw status (2:1)
 * @property {string} activity see ACTIVITY in spec.js
 * @property {number | null} error raw error code (2:2), 0 = none
 * @property {number | null} battery percent
 * @property {boolean} charging
 */

function toNumber(value) {
  const number = Number(value);
  return value === null || value === undefined || !Number.isFinite(number) ? null : number;
}

/** What the device list says about one mower. */
export function mowerFromRecord(record) {
  const model = String(record.model ?? '');
  const modelName = MODEL_NAMES[model] ?? record.deviceInfo?.displayName ?? model;
  const status = toNumber(record.latestStatus);
  return {
    did: String(record.did),
    name: (record.customName && String(record.customName).trim()) || modelName || 'Dreame mower',
    model,
    modelName,
    firmware: record.ver ?? null,
    bindDomain: record.bindDomain,
    online: record.online !== false,
    status,
    activity: activityOf(status),
    error: null,
    battery: toNumber(record.battery),
    charging: false,
  };
}

/** Merge the answer of `get_properties` into a mower. */
export function applyProperties(mower, properties) {
  const valueOf = ({ siid, piid }) => {
    const found = properties.find(
      (p) => p.siid === siid && p.piid === piid && (p.code === undefined || p.code === 0),
    );
    return found ? toNumber(found.value) : null;
  };
  const status = valueOf(PROPERTIES.STATUS) ?? mower.status;
  const charging = valueOf(PROPERTIES.CHARGING);
  return {
    ...mower,
    status,
    activity: activityOf(status),
    error: valueOf(PROPERTIES.ERROR) ?? mower.error,
    battery: valueOf(PROPERTIES.BATTERY) ?? mower.battery,
    // 1 = charging. A mower that does not report it is charging while its
    // status says so.
    charging: charging === null ? status === 6 : charging === 1,
  };
}

/**
 * What changed between two reads of the same mower, for the scene triggers.
 * The first read of a mower reports nothing: it is not a change.
 */
export function transitions(previous, current) {
  if (!previous) {
    return [];
  }
  const found = [];
  if (previous.activity !== current.activity && current.activity !== ACTIVITY.UNKNOWN) {
    found.push({
      type: 'status_changed',
      did: current.did,
      status: current.activity,
      previous_status: previous.activity,
    });
  }
  if (current.error && current.error !== previous.error) {
    found.push({ type: 'error_occurred', did: current.did, error_code: current.error });
  }
  return found;
}

/**
 * Create the account tracker.
 * @param {object} config normalized config
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch] injected in the tests
 * @param {() => number} [options.now] injected in the tests
 */
export function createAccount(config, { fetch, now = Date.now } = {}) {
  const cloud = createCloudClient({
    username: config.username,
    password: config.password,
    region: config.region,
    accountType: config.account_type,
    fetch,
    now,
  });
  /** @type {Map<string, Mower>} */
  let mowers = new Map();
  let lastRefresh = 0;
  let pending = null;
  let lastError = null;

  async function readMower(record) {
    const mower = mowerFromRecord(record);
    if (!mower.online) {
      return mower;
    }
    try {
      const properties = await cloud.getProperties(mower, Object.values(PROPERTIES));
      return applyProperties(mower, properties);
    } catch (err) {
      if (err instanceof DreameError && err.kind === 'offline') {
        return { ...mower, online: false };
      }
      // The list values are still good: keep them, the next read retries.
      logger.warn(`Reading ${mower.name} failed: ${err.message}`);
      return applyProperties(mower, []);
    }
  }

  async function doRefresh() {
    const records = (await cloud.listDevices()).filter((record) => isMowerModel(record.model));
    const next = new Map();
    const changes = [];
    for (const record of records) {
      const mower = await readMower(record);
      changes.push(...transitions(mowers.get(mower.did), mower));
      next.set(mower.did, mower);
    }
    mowers = next;
    lastRefresh = now();
    lastError = null;
    logger.debug(`Read ${next.size} mower(s) from the cloud`);
    return { mowers: [...next.values()], transitions: changes };
  }

  /**
   * Read the cloud now (or join the read in progress).
   * @returns {Promise<{ mowers: Mower[], transitions: object[] }>}
   */
  function refresh() {
    if (!pending) {
      pending = doRefresh()
        .catch((err) => {
          lastError = err;
          // A failed read waits for the next interval too: retrying a refused
          // login every minute could get the account locked by the cloud.
          lastRefresh = now();
          throw err;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  return {
    refresh,

    /**
     * Read the cloud if the last read is older than the interval.
     * @param {number} intervalSeconds refresh interval of the config
     * @returns {Promise<{ mowers: Mower[], transitions: object[] } | null>} null when not due
     */
    async refreshIfDue(intervalSeconds) {
      if (pending) {
        return pending;
      }
      if (lastRefresh && now() - lastRefresh < intervalSeconds * 1000 - REFRESH_TOLERANCE_MS) {
        return null;
      }
      return refresh();
    },

    /** Log in and list the mowers (the "Test the connection" button). */
    async test() {
      await cloud.connect();
      return refresh();
    },

    /**
     * Send a command to a mower.
     * @param {string} did cloud id of the mower
     * @param {keyof COMMANDS} command start | pause | stop | dock
     */
    async command(did, command) {
      const action = COMMANDS[command];
      if (!action) {
        throw new Error(`Unknown command: ${command}`);
      }
      const mower = mowers.get(did);
      if (!mower) {
        throw new Error(`Unknown mower: ${did}`);
      }
      logger.info(`Command ${command} -> ${mower.name}`);
      await cloud.action(mower, action);
    },

    /** @param {string} did */
    get(did) {
      return mowers.get(did);
    },

    /** Every mower of the last read. */
    list() {
      return [...mowers.values()];
    },

    /** Error of the last read, null when it went fine. */
    get lastError() {
      return lastError;
    },
  };
}
