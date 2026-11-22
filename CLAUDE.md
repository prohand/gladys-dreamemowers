# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step, one runtime
dependency: `@gladysassistant/integration-sdk`) for **Dreame and MOVA robot lawn mowers**,
started from the official template
[GladysAssistant/integration-template-js](https://github.com/GladysAssistant/integration-template-js).
Requires Gladys 5.3+ (`keywords` and `countries` in the manifest). Cloud only
(`"transports": ["cloud"]`): the mowers have no local API.

Scene triggers (status changed, error occurred), a scene action (start / pause / stop / dock)
and a "Robot lawn mower" dashboard widget.

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/cloud.test.js              # one file
node --test --test-name-pattern "offline"   # one test by name
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
```

CI runs `format:check`, `lint`, `test` (Node 22 and 24), the store admission checks and a Docker
build on pull requests. Releases: **Actions → Release** only (bumps `package.json`, manifest
`version` + `docker_image`, rolls `CHANGELOG.md`, re-runs Prettier, tags, builds, GitHub Release).

## Architecture

```
index.js                    SDK bootstrap + wiring only (no cloud logic)
src/config.js               defaults + normalization (must match the manifest defaults)
src/i18n.js                 LANGUAGES = en, fr, de, es; pick / localize
src/service.js              the one place that reads the cloud and tells Gladys (sync)
src/dreame/cloud.js         HTTPS client of the Dreamehome / MOVAhome cloud (login, list, sendCommand)
src/dreame/account.js       mowers of the account, shared refresh, transitions between reads
src/dreame/spec.js          MIoT siid/piid/aiid, status and error codes, texts in 4 languages
src/devices/mower.js        Gladys device of a mower: features, states, transport, commands
src/capabilities/scenes.js  scene triggers keys + scene action handler
src/capabilities/widget.js  dashboard widget content + button actions
```

### Invariants worth knowing

- **One cloud read for every mower**: Gladys polls each device every minute; `account.refreshIfDue`
  reads the cloud at most once per configured interval and concurrent callers share the read. A
  failed read also waits for the next interval (a refused login retried every minute could lock
  the account).
- **One command in flight**: the cloud pairs a command and its answer by the request id; the
  client queues them (`cloud.js`).
- **States only for created devices**: a mower listed in Discovery but not added has no feature
  to receive states. The created set comes from `getDevices()` at connection, `onDeviceCreated`,
  `onPoll`, and loses entries on `onDeviceDeleted`.
- **Polling**: `poll_frequency` is the Gladys enum in ms (`EVERY_MINUTES`); the configured
  `poll_frequency` is seconds and is never published as is.
- **Every feature declares `min`/`max`** (NOT NULL in Gladys): text features are `0`/`0`.
- **The status is a code, the text is a translation**: `spec.js` maps the raw 2:1 status to an
  `ACTIVITY` (what scenes filter on) and to a text in the configured language (what the `Status`
  feature shows). An unknown code keeps its number.
- **The first read fires no scene event**: transitions compare two reads of the same mower.
- **Secrets**: the password and the tokens are never logged; the password only leaves hashed.
- Trigger, action, widget, feature and config keys are stored by users: never rename them.

### Manifest

`test/manifest.test.js` keeps `gladys-assistant-integration.json` in sync with the code:
config keys and defaults vs `DEFAULT_CONFIG`, select options vs the values the code accepts,
handlers for every action / scene action / widget, triggers fired vs declared, `en/fr/de/es`
in every text, store length limits, `keywords`, `countries`, `transports`, `gladys_version >=5.3.0`.

## Testing

No network: `test/helpers/fakeCloud.js` is an in-memory Dreame cloud behind an injected `fetch`
(login, device list, sendCommand, offline mower, refused login, expired token, network down).
Gladys is the SDK's `createFakeGladys()`, which refuses the payloads the real host API refuses.

## Conventions

Prettier formats, ESLint catches mistakes. Comments explain **why**. User-facing text is
`{ en, fr, de, es }`; user docs in `docs/en.md`, `docs/fr.md`, `docs/de.md` and `docs/es.md`,
kept in sync. Every change is described under `## [Unreleased]` in `CHANGELOG.md`.
