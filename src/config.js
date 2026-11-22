// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. This module only provides the defaults
// and normalizes the received object, so the rest of the code never deals with
// `undefined`, a number sent as a string or a value outside the allowed list.
// -----------------------------------------------------------------------------

import { ACCOUNT_TYPES, REGIONS } from './dreame/cloud.js';
import { LANGUAGES } from './i18n.js';

// Gladys polls a device at most once a minute: that is the fastest refresh.
export const MIN_POLL_SECONDS = 60;
export const MAX_POLL_SECONDS = 3600;

// Defaults: they MUST match the `default` values of the manifest config_schema
// (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  account_type: 'dreame', // 'dreame' | 'mova': the app the account was created in
  username: '',
  password: '',
  region: 'eu', // cloud region of the account
  language: 'en', // language of the status and error texts published as states
  poll_frequency: 60, // seconds between two reads of the cloud
};

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const pollFrequency = Number(raw.poll_frequency ?? DEFAULT_CONFIG.poll_frequency);
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    account_type: oneOf(raw.account_type, Object.keys(ACCOUNT_TYPES), DEFAULT_CONFIG.account_type),
    username: String(raw.username ?? '').trim(),
    // Never trimmed: a password may legitimately start or end with a space.
    password: String(raw.password ?? ''),
    region: oneOf(String(raw.region ?? '').toLowerCase(), REGIONS, DEFAULT_CONFIG.region),
    language: oneOf(raw.language, LANGUAGES, DEFAULT_CONFIG.language),
    poll_frequency: Number.isFinite(pollFrequency)
      ? Math.min(MAX_POLL_SECONDS, Math.max(MIN_POLL_SECONDS, Math.round(pollFrequency)))
      : DEFAULT_CONFIG.poll_frequency,
  };
}

/** True once the account fields are filled in. */
export function isConfigured(config) {
  return Boolean(config.username) && Boolean(config.password);
}

/** The credentials part of the config: a change there means a new login. */
export function accountKey(config) {
  return JSON.stringify([config.account_type, config.region, config.username, config.password]);
}
