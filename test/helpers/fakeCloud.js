// -----------------------------------------------------------------------------
// An in-memory Dreame cloud, behind a `fetch` the client accepts as its own.
//
// It answers the three calls the integration makes (token, device list,
// sendCommand), records every request, and lets a test change the mowers,
// refuse the login, take a mower offline or break the network.
// -----------------------------------------------------------------------------

export const PASSWORD = 'secret-password';
export const USERNAME = 'me@example.com';

/** A mower as the device list returns it. */
export function mowerRecord(overrides = {}) {
  return {
    did: '-111222333',
    model: 'dreame.mower.p2255',
    customName: 'Front lawn',
    ver: '4.3.6_0447',
    battery: 80,
    latestStatus: 6,
    online: true,
    bindDomain: '10000.mt.eu.iot.dreame.tech:19973',
    ...overrides,
  };
}

export function createFakeCloud({ mowers = [mowerRecord()] } = {}) {
  const state = {
    mowers,
    // MIoT properties per did: { 'siid:piid': value }
    properties: {},
    requests: [],
    actions: [],
    tokens: 0,
    refuseLogin: false,
    networkDown: false,
    expireTokens: false,
    offline: new Set(),
  };

  const json = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  async function fetch(url, init) {
    const { pathname, hostname } = new URL(url);
    state.requests.push({ url, hostname, pathname, init });
    if (state.networkDown) {
      throw new Error('getaddrinfo ENOTFOUND');
    }
    if (pathname === '/dreame-auth/oauth/token') {
      const body = new URLSearchParams(init.body);
      if (body.get('grant_type') === 'refresh_token') {
        if (body.get('refresh_token') !== 'refresh-1') {
          return json(401, { error_description: 'Invalid refresh token' });
        }
      } else if (state.refuseLogin || body.get('username') !== USERNAME) {
        return json(400, { error: 'invalid_grant', error_description: 'Bad credentials' });
      }
      state.tokens += 1;
      return json(200, {
        access_token: `token-${state.tokens}`,
        refresh_token: 'refresh-1',
        expires_in: 7200,
        tenant_id: '000000',
        region: 'eu',
        uid: 'AB12',
      });
    }
    const token = init.headers['Dreame-Auth'];
    if (!token || state.expireTokens) {
      state.expireTokens = false;
      return json(401, { msg: 'Token expired' });
    }
    if (pathname === '/dreame-user-iot/iotuserbind/device/listV2') {
      return json(200, { code: 0, data: { page: { records: state.mowers } } });
    }
    if (/^\/dreame-iot-com-\d+\/device\/sendCommand$/.test(pathname)) {
      const body = JSON.parse(init.body);
      if (state.offline.has(body.did)) {
        return json(200, { code: 80001, msg: 'device offline' });
      }
      const { method, params } = body.data;
      if (method === 'get_properties') {
        const values = state.properties[body.did] ?? {};
        return json(200, {
          code: 0,
          data: {
            result: params.map(({ siid, piid }) => {
              const value = values[`${siid}:${piid}`];
              return value === undefined
                ? { siid, piid, code: -4003 }
                : { siid, piid, code: 0, value };
            }),
          },
        });
      }
      if (method === 'action') {
        state.actions.push({ did: body.did, siid: params.siid, aiid: params.aiid });
        return json(200, { code: 0, data: { result: { code: 0 } } });
      }
    }
    return json(404, { code: 404, msg: 'not found' });
  }

  return {
    fetch,
    state,
    /** Set the MIoT properties a mower answers. */
    setProperties(did, values) {
      state.properties[did] = { ...state.properties[did], ...values };
    },
  };
}
