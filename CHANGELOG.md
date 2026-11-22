# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-11-22

### Fixed

- The Release and Build workflows now show in the Actions tab: GitHub had not
  registered them, their file reached `main` before it was the default branch.

### Added

- First version of the Dreame Mowers integration, built from the official
  Gladys JavaScript template.
- Dreamehome and MOVAhome accounts, in the five cloud regions (Europe, North
  America, Asia-Pacific, Russia, China).
- One Gladys device per mower of the account: mowing switch (start / pause),
  return to base, status, battery, charging and error.
- Cloud transport badge per mower (cloud / unreachable).
- Scene triggers: "Mower status changes" and "Mower reports an error".
- Scene action: "Control a mower" (start, pause, stop, return to base).
- Dashboard widget "Robot lawn mower" (battery, status, error, connection and
  three buttons).
- "Test the connection" button in the Configuration screen.
- Texts and documentation in English, French, German and Spanish.
- Catalog `countries`, `keywords` and `categories`.
- CI (Prettier, ESLint, tests on Node 22 and 24, store checks, Docker build),
  Release, multi-arch build and GitHub Release workflows, Dependabot.
- `SECURITY.md` and `CLAUDE.md`.

[Unreleased]: https://github.com/prohand/gladys-dreamemowers/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/prohand/gladys-dreamemowers/releases/tag/v1.0.1
