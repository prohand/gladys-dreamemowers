// -----------------------------------------------------------------------------
// Dreamehome / MOVAhome cloud client.
//
// The mowers have no local API: the Dreame app, and this integration, reach
// them through the vendor cloud, over HTTPS:
//
//   1. log in with the app account (OAuth2 "password" grant) -> access token;
//   2. list the devices bound to the account (status, battery, online flag);
//   3. relay MIoT commands (`get_properties`, `action`) to one device.
//
// The client identifiers below (User-Agent, Basic credentials, tenant, password
// salt) are those of the public Dreame / MOVA mobile apps, the same for every
// user: they are not secrets. The user's password and tokens ARE: they are
// never logged.
//
// No dependency: Node's global `fetch`. Tests inject a fake one.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';

/** One entry per brand: the two apps share the API, not the host or tenant. */
export const ACCOUNT_TYPES = {
  dreame: {
    host: 'iot.dreame.tech',
    tenant: '000000',
    userAgent: 'Dreame_Smarthome/1.5.59 (iPhone; iOS 16.0; Scale/3.00)',
  },
  mova: {
    host: 'iot.mova-tech.com',
    tenant: '000002',
    userAgent: 'Mova_Smarthome/1.5.59 (iPhone; iOS 16.0; Scale/3.00)',
  },
};

/** Cloud regions offered by the apps (the region chosen when the account was created). */
export const REGIONS = ['eu', 'us', 'cn', 'ru', 'sg'];

const PORT = 13267;
const BASIC_AUTH = 'Basic ZHJlYW1lX2FwcHYxOkFQXmR2QHpAU1FZVnhOODg=';
const PASSWORD_SALT = 'RAylYC%fmSKp7%Tq';
// The China region also wants this header, sent by the app there.
const CN_RLC = '1c80b3787b2266776bcdc481f37d8fa42ba10a30af81a6df-1';

const PATHS = {
  TOKEN: '/dreame-auth/oauth/token',
  DEVICES: '/dreame-user-iot/iotuserbind/device/listV2',
  SEND_COMMAND: (bindDomain) => `/dreame-iot-com${hostSuffix(bindDomain)}/device/sendCommand`,
};

/** The cloud answers this code when the device is not connected to it. */
export const OFFLINE_CODE = 80001;

// Renew the token two minutes before the cloud says it expires.
const TOKEN_MARGIN_MS = 120 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;

/**
 * An error the rest of the integration can act on: `kind` says what failed.
 *   - `auth`: wrong e-mail / password / region (fix the configuration);
 *   - `offline`: the mower is not connected to the cloud (out of Wi-Fi/4G);
 *   - `network`: the cloud did not answer (retry later);
 *   - `api`: the cloud answered with an error code.
 */
export class DreameError extends Error {
  constructor(kind, message, code) {
    super(message);
    this.name = 'DreameError';
    this.kind = kind;
    this.code = code;
  }
}

/** `10000.mt.eu.iot.dreame.tech:19973` -> `-10000` (the command gateway). */
function hostSuffix(bindDomain) {
  if (typeof bindDomain !== 'string' || bindDomain.length === 0) {
    return '';
  }
  return `-${bindDomain.split('.')[0]}`;
}

/** The app sends md5(password + salt), never the password itself. */
export function hashPassword(password) {
  return createHash('md5')
    .update(`${password ?? ''}${PASSWORD_SALT}`, 'utf8')
    .digest('hex');
}

/**
 * Create a cloud client for one account.
 *
 * @param {object} options
 * @param {string} options.username e-mail (or phone) of the Dreame / MOVA account
 * @param {string} options.password its password
 * @param {string} [options.region] one of {@link REGIONS}
 * @param {string} [options.accountType] a key of {@link ACCOUNT_TYPES}
 * @param {typeof fetch} [options.fetch] injected in the tests
 * @param {() => number} [options.now] injected in the tests
 */
export function createCloudClient({
  username,
  password,
  region = 'eu',
  accountType = 'dreame',
  fetch: fetchImpl = globalThis.fetch,
  now = Date.now,
}) {
  const brand = ACCOUNT_TYPES[accountType] ?? ACCOUNT_TYPES.dreame;
  let country = REGIONS.includes(region) ? region : 'eu';
  let accessToken = null;
  let refreshToken = null;
  let expiresAt = 0;
  let tenant = brand.tenant;
  let requestId = Math.floor(Math.random() * 100) + 1;
  // One command at a time: the cloud pairs a command with the device's answer
  // by the id it carries, two commands in flight get each other's answers.
  let queue = Promise.resolve();

  const baseUrl = () => `https://${country}.${brand.host}:${PORT}`;

  function baseHeaders() {
    const headers = {
      Accept: '*/*',
      'Accept-Language': 'en-US;q=0.8',
      'User-Agent': brand.userAgent,
      Authorization: BASIC_AUTH,
      'Tenant-Id': tenant,
    };
    if (country === 'cn') {
      headers['Dreame-Rlc'] = CN_RLC;
    }
    return headers;
  }

  async function post(url, { headers, body }) {
    try {
      return await fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new DreameError('network', `Dreame cloud unreachable: ${err.message}`);
    }
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  /** Get a token, with the refresh token when there is one. */
  async function login() {
    const grant = refreshToken
      ? `refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
      : `password&username=${encodeURIComponent(username ?? '')}` +
        `&password=${hashPassword(password)}&type=account`;
    const response = await post(`${baseUrl()}${PATHS.TOKEN}`, {
      headers: { ...baseHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `platform=IOS&scope=all&grant_type=${grant}`,
    });
    const data = await readJson(response);
    if (response.ok && data?.access_token) {
      accessToken = data.access_token;
      refreshToken = data.refresh_token ?? null;
      expiresAt = now() + Number(data.expires_in ?? 3600) * 1000 - TOKEN_MARGIN_MS;
      tenant = data.tenant_id ?? tenant;
      if (REGIONS.includes(data.region)) {
        country = data.region;
      }
      return;
    }
    if (refreshToken) {
      // An expired or revoked refresh token: start over with the password.
      refreshToken = null;
      return login();
    }
    accessToken = null;
    throw new DreameError(
      'auth',
      data?.error_description || `Dreame login refused (HTTP ${response.status})`,
    );
  }

  async function ensureToken() {
    if (!accessToken || now() >= expiresAt) {
      await login();
    }
  }

  /** An authenticated JSON call; renews the token once when the cloud refuses it. */
  async function call(path, body, retried = false) {
    await ensureToken();
    const response = await post(`${baseUrl()}${path}`, {
      headers: { ...baseHeaders(), 'Content-Type': 'application/json', 'Dreame-Auth': accessToken },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 401 && !retried) {
      accessToken = null;
      return call(path, body, true);
    }
    const data = await readJson(response);
    if (!response.ok || !data) {
      throw new DreameError('api', `Dreame cloud error (HTTP ${response.status})`);
    }
    if (data.code === OFFLINE_CODE) {
      throw new DreameError('offline', data.msg || 'The mower is offline', data.code);
    }
    if (data.code !== 0) {
      throw new DreameError('api', data.msg || `Dreame cloud error ${data.code}`, data.code);
    }
    return data.data;
  }

  /** Send one MIoT command to a device, after the ones already queued. */
  function sendCommand(device, method, params) {
    const run = async () => {
      const id = requestId;
      requestId += 1;
      const data = await call(PATHS.SEND_COMMAND(device.bindDomain), {
        did: String(device.did),
        id,
        data: { did: String(device.did), id, method, params },
      });
      return data?.result;
    };
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  }

  return {
    /** Log in now (the "Test the connection" button). */
    async connect() {
      accessToken = null;
      await login();
    },

    /** Every device bound to the account, as the cloud lists them. */
    async listDevices() {
      const data = await call(PATHS.DEVICES);
      const records = data?.page?.records;
      return Array.isArray(records) ? records : [];
    },

    /**
     * Read properties of a device.
     * @param {{ did: string, bindDomain?: string }} device
     * @param {Array<{ siid: number, piid: number }>} properties
     * @returns {Promise<Array<{ siid: number, piid: number, value: unknown, code?: number }>>}
     */
    async getProperties(device, properties) {
      const result = await sendCommand(
        device,
        'get_properties',
        properties.map(({ siid, piid }) => ({ did: String(device.did), siid, piid })),
      );
      return Array.isArray(result) ? result : [];
    },

    /**
     * Run an action on a device.
     * @param {{ did: string, bindDomain?: string }} device
     * @param {{ siid: number, aiid: number }} action
     */
    async action(device, { siid, aiid }, input = []) {
      return sendCommand(device, 'action', { did: String(device.did), siid, aiid, in: input });
    },

    /** Region the cloud placed the account in (it may correct the configured one). */
    get region() {
      return country;
    },
  };
}
