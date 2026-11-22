# Dreame Mowers for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
controls **Dreame** and **MOVA** robot lawn mowers through the Dreamehome /
MOVAhome cloud, built with the JavaScript SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
from the official
[integration template](https://github.com/GladysAssistant/integration-template-js).

- **Cloud** transport (the mowers have no local API).
- Gladys **5.3.0** or later.
- Texts and documentation in **English, French, German and Spanish**.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## Features

| Surface              | What                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| Devices              | One per mower: mowing, return to base, status, battery, charging, error |
| Transport badge      | `cloud` when the mower answers, `unreachable` otherwise                 |
| Scene trigger        | `status_changed` — mowing, paused, returning, docked, error             |
| Scene trigger        | `error_occurred` — new error code, with its text                        |
| Scene action         | `mower_command` — start, pause, stop, dock (output `sent`)              |
| Dashboard widget     | `mower` — battery, status, error, connection, 3 buttons                 |
| Configuration action | `test_connection` — logs in and lists the mowers found                  |

Catalog: category `appliances`, search `keywords` (Dreame, MOVA, lawn mower,
tondeuse, Mähroboter, cortacésped…) and the `countries` where the mowers are
sold.

## Project structure

```
.
├─ index.js                          # SDK bootstrap + event wiring
├─ src/
│  ├─ service.js                     # reads the cloud, tells Gladys
│  ├─ config.js                      # config defaults + normalization
│  ├─ i18n.js                        # en / fr / de / es helpers
│  ├─ dreame/
│  │  ├─ cloud.js                    # Dreamehome / MOVAhome HTTPS client
│  │  ├─ account.js                  # mowers of the account, shared refresh
│  │  └─ spec.js                     # MIoT codes, statuses, errors (4 languages)
│  ├─ devices/mower.js               # Gladys device of a mower
│  └─ capabilities/
│     ├─ scenes.js                   # scene triggers + scene action
│     └─ widget.js                   # dashboard widget
├─ docs/{en,fr,de,es}.md             # user documentation (re-hosted by Gladys)
├─ test/                             # unit tests (`node --test`), fake cloud
├─ gladys-assistant-integration.json # manifest
├─ Dockerfile                        # Node 24 Alpine, non-root, read-only rootfs ready
├─ CHANGELOG.md · SECURITY.md · CLAUDE.md
└─ .github/                          # CI, Release, build, GitHub releases, Dependabot
```

## How it talks to the mowers

1. Login on `https://<region>.iot.dreame.tech:13267` (or `iot.mova-tech.com`)
   with the app account; the password is sent as the salted hash the app uses.
2. The device list gives every mower, its online flag, battery and last status.
3. Online mowers are asked for the MIoT properties `2:1` (status), `2:2`
   (error), `3:1` (battery) and `3:2` (charging).
4. Commands are MIoT actions: `5:1` start, `5:4` pause, `5:2` stop, `5:3` dock.

The codes live in [`src/dreame/spec.js`](src/dreame/spec.js).

## Run it locally

```bash
npm install
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="dreame-mowers" \
LOG_LEVEL=debug \
npm start
```

## Quality checks

```bash
npm run format:check   # Prettier
npm run lint           # ESLint
npm test               # node --test, no network (fake Dreame cloud + fake Gladys)
```

The same checks run in CI on Node 22 and 24, with the store admission checks
and a Docker build on pull requests (`.github/workflows/ci.yml`).

## Release

1. Describe the changes under `## [Unreleased]` in `CHANGELOG.md`.
2. **Actions → Release → Run workflow**, pick `patch`, `minor` or `major`.

The workflow bumps `package.json` and the manifest (`version`, `docker_image`),
rolls the changelog, tags `vX.Y.Z`, builds the `linux/amd64` + `linux/arm64`
image to `ghcr.io/prohand/gladys-dreamemowers`, publishes the GitHub Release
and runs the full store validation.

Before the first release: add the GitHub topic `gladys-assistant-integration`
and turn on **Private vulnerability reporting** (see [SECURITY.md](SECURITY.md)).

## Disclaimer

Not affiliated with Dreame or MOVA. The integration uses the same cloud API as
the official mobile apps; Dreame may change it at any time.

## License

Apache-2.0
