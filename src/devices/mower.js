// -----------------------------------------------------------------------------
// Device type: ROBOT LAWN MOWER (Dreame / MOVA).
//
// Gladys has no "lawn mower" category yet, so the mower is built from standard
// features every dashboard box and scene already understands:
//
//   - Mowing          switch    1 = start mowing, 0 = pause        (command)
//   - Return to base  switch    1 = go back to the station         (command)
//   - Status          text      "Mowing", "Charging"… in the configured language
//   - Battery         battery   percent
//   - Charging        battery   1 while the battery charges
//   - Error           text      "No error", "Mower stuck (2)"…
//
// One Gladys device per mower of the account: the external id is built from the
// cloud id of the mower (`did`), which never changes.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
  DEVICE_TRANSPORTS,
} from '@gladysassistant/integration-sdk';
import { ACTIVITY, errorText, statusText } from '../dreame/spec.js';

export const DEVICE_TYPE = 'mower';

/** Feature keys: part of the external ids, never renamed. */
export const FEATURE = {
  MOWING: 'mowing',
  DOCK: 'dock',
  STATUS: 'status',
  BATTERY: 'battery',
  CHARGING: 'charging',
  ERROR: 'error',
};

/** The external ids of one mower. */
export function mowerIds(gladys, did) {
  return gladys.externalIds(DEVICE_TYPE, did);
}

/** The cloud id of a mower, from the external id of its device (null if not ours). */
export function didFromExternalId(gladys, externalId) {
  const prefix = mowerIds(gladys, '').device;
  return typeof externalId === 'string' && externalId.startsWith(prefix) && externalId !== prefix
    ? externalId.slice(prefix.length)
    : null;
}

const binary = (name, externalId, category, type, readOnly) => ({
  name,
  external_id: externalId,
  category,
  type,
  min: 0,
  max: 1,
  read_only: readOnly,
  has_feedback: true,
  keep_history: true,
});

const text = (name, externalId) => ({
  name,
  external_id: externalId,
  category: DEVICE_FEATURE_CATEGORIES.TEXT,
  type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
  // A text has no range: 0/0, but the columns are NOT NULL in Gladys.
  min: 0,
  max: 0,
  read_only: true,
  has_feedback: false,
  keep_history: false,
});

/**
 * The discovery payload of one mower.
 * @param {object} gladys SDK instance
 * @param {import('../dreame/account.js').Mower} mower
 */
export function buildMowerDevice(gladys, mower) {
  const ids = mowerIds(gladys, mower.did);
  return {
    name: mower.name,
    external_id: ids.device,
    model: mower.modelName,
    // Gladys polls every minute; the account reads the cloud at the interval
    // of the config and shares the read between the mowers.
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: [
      binary(
        'Mowing',
        ids.feature(FEATURE.MOWING),
        DEVICE_FEATURE_CATEGORIES.SWITCH,
        DEVICE_FEATURE_TYPES.SWITCH.BINARY,
        false,
      ),
      binary(
        'Return to base',
        ids.feature(FEATURE.DOCK),
        DEVICE_FEATURE_CATEGORIES.SWITCH,
        DEVICE_FEATURE_TYPES.SWITCH.BINARY,
        false,
      ),
      text('Status', ids.feature(FEATURE.STATUS)),
      {
        name: 'Battery',
        external_id: ids.feature(FEATURE.BATTERY),
        category: DEVICE_FEATURE_CATEGORIES.BATTERY,
        type: DEVICE_FEATURE_TYPES.BATTERY.INTEGER,
        unit: DEVICE_FEATURE_UNITS.PERCENT,
        min: 0,
        max: 100,
        read_only: true,
        has_feedback: false,
        keep_history: true,
      },
      binary(
        'Charging',
        ids.feature(FEATURE.CHARGING),
        DEVICE_FEATURE_CATEGORIES.BATTERY,
        DEVICE_FEATURE_TYPES.BATTERY.CHARGING,
        true,
      ),
      text('Error', ids.feature(FEATURE.ERROR)),
    ],
  };
}

/**
 * The states of one mower, in the `publishStates` format.
 * @param {object} gladys SDK instance
 * @param {import('../dreame/account.js').Mower} mower
 * @param {string} language language of the texts
 */
export function mowerStates(gladys, mower, language) {
  const ids = mowerIds(gladys, mower.did);
  const states = [
    {
      device_feature_external_id: ids.feature(FEATURE.MOWING),
      state: mower.activity === ACTIVITY.MOWING ? 1 : 0,
    },
    {
      device_feature_external_id: ids.feature(FEATURE.DOCK),
      state: mower.activity === ACTIVITY.RETURNING ? 1 : 0,
    },
    {
      device_feature_external_id: ids.feature(FEATURE.STATUS),
      text: statusText(mower.status, language),
    },
    { device_feature_external_id: ids.feature(FEATURE.CHARGING), state: mower.charging ? 1 : 0 },
    {
      device_feature_external_id: ids.feature(FEATURE.ERROR),
      text: errorText(mower.error, language),
    },
  ];
  if (mower.battery !== null) {
    states.push({ device_feature_external_id: ids.feature(FEATURE.BATTERY), state: mower.battery });
  }
  return states;
}

/** Transport badge: the mowers only speak through the cloud. */
export function mowerTransport(gladys, mower) {
  return {
    external_id: mowerIds(gladys, mower.did).device,
    transport: mower.online ? DEVICE_TRANSPORTS.CLOUD : DEVICE_TRANSPORTS.UNREACHABLE,
  };
}

/**
 * Which command a value written to a feature means. Null: nothing to send.
 * @param {string} featureKey a value of {@link FEATURE}
 * @param {number} value 0 or 1
 * @param {import('../dreame/account.js').Mower} [mower] last known state
 */
export function commandFor(featureKey, value, mower) {
  const on = Number(value) === 1;
  if (featureKey === FEATURE.MOWING) {
    return on ? 'start' : 'pause';
  }
  if (featureKey === FEATURE.DOCK) {
    if (on) {
      return 'dock';
    }
    // Switching "Return to base" off while it drives back stops it there.
    return mower?.activity === ACTIVITY.RETURNING ? 'pause' : null;
  }
  return null;
}

/** The feature key of a feature external id (`…:mowing` -> `mowing`). */
export function featureKeyOf(externalId) {
  return String(externalId).split(':').pop();
}
