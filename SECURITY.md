# Security policy

## Supported versions

Only the latest release of the Dreame Mowers integration receives security
fixes. Update the integration from the Gladys store before reporting an issue.

| Version      | Supported |
| ------------ | --------- |
| 1.x (latest) | Yes       |
| older        | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-dreamemowers](https://github.com/prohand/gladys-dreamemowers/security),
then **Report a vulnerability**.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- any log line that helps (remove e-mails, passwords, tokens and device ids
  first).

You should get a first answer within 7 days. A fix is released as a new version
of the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)),
the Dreame / MOVA cloud, apps and mower firmware (report to Dreame).

## How the integration handles secrets

- The account password is stored in a Gladys `secret` field, never sent back
  to the browser.
- It only travels to the Dreame cloud, over HTTPS, as the salted MD5 hash the
  official app sends; the access and refresh tokens stay in memory.
- Neither the password nor the tokens are ever written to the logs.
- The image runs as a non-root user on a read-only root filesystem, and only
  talks to the Dreame cloud hosts.

## Good practices for users

- Use a password dedicated to the Dreame / MOVA account.
- Keep Gladys and the integration up to date.
