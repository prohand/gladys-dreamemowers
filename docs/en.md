# Dreame Mowers

Control your **Dreame** and **MOVA** robot lawn mowers from Gladys Assistant:
status, battery, start, pause, return to base, scenes and a dashboard widget.

The mowers have no local API: like the Dreame app, the integration goes
through the **Dreame cloud** (internet connection required).

## Supported mowers

Every mower bound to a Dreamehome or MOVAhome account whose model starts with
`dreame.mower.` or `mova.mower.`: Dreame A1, A1 Pro, A2, A3 AWD, MOVA 600,
1000, LiDAX, Viax… A model missing from this list still shows up, under its
technical name.

## Configuration

1. Open the **Configuration** tab of the integration.
2. **App**: Dreamehome or MOVAhome, the app your account was created in.
3. **E-mail** and **Password** of that account.
   An account created with "Sign in with Google / Apple" has no password:
   set one first in the app (Profile → Account and security).
4. **Region**: the region chosen when the account was created (Europe for
   most European users).
5. **Language of the states**: language of the Status and Error texts.
6. **Refresh interval**: how often the cloud is read, every minute at least.
7. Click **Test the connection**: the mowers found are listed under the button.
8. Open the **Discovery** tab and add your mowers.

## What each mower shows

| Feature        | Type             | Use                                  |
| -------------- | ---------------- | ------------------------------------ |
| Mowing         | switch           | On = start mowing, Off = pause       |
| Return to base | switch           | On = go back to the station          |
| Status         | text             | Mowing, Paused, Charging, Returning… |
| Battery        | battery (%)      | Charge level                         |
| Charging       | battery (binary) | 1 while the battery charges          |
| Error          | text             | "No error", "Mower stuck (2)"…       |

A badge on each device shows whether the mower answers through the cloud
(**cloud**) or not (**unreachable**: out of Wi-Fi / 4G, switched off…).

## Scenes

Under the **Integrations** category of the scene editor:

- **Mower status changes** (trigger) — when the mower starts mowing, pauses,
  returns, docks or stops on an error. Optionally pick the mower and the new
  status. Variables: `{{triggerEvent.data.status}}`,
  `{{triggerEvent.data.previous_status}}`, `{{triggerEvent.data.battery}}`.
- **Mower reports an error** (trigger) — a new error (stuck, tilted, blade
  blocked…). Variables: `{{triggerEvent.data.error_code}}`,
  `{{triggerEvent.data.error_text}}`.
- **Control a mower** (action) — start, pause, stop or return to base. Its
  output **Command sent** says whether the cloud accepted the command.

Examples: send a notification when the mower is stuck; send it back to its
base when rain starts; start it every morning when nobody is in the garden.

## Dashboard widget

Add the **Robot lawn mower** box to a dashboard: battery, status, error,
connection and three buttons (Mow, Pause, Back to base). In its settings,
choose the mower to show (empty: the first mower of the account).

## Troubleshooting

- **Login refused**: check the e-mail, the password, the app (Dreamehome or
  MOVAhome) and the region. Log in once in the app with the same e-mail and
  password.
- **No mower found**: the mower must appear in the app of that same account
  (a shared mower appears too).
- **Unreachable**: the mower is not connected to the cloud. Check its Wi-Fi or
  4G and that it is switched on.
- **The state changes late**: the cloud is read at the refresh interval; after
  a command, the mower is read again 5 seconds later.

## Privacy

The password is stored in a Gladys secret field and only sent, hashed, to the
Dreame cloud. Nothing else leaves your Gladys.
