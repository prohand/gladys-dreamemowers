// -----------------------------------------------------------------------------
// The Release workflow rolls CHANGELOG.md with .github/scripts/changelog-release.mjs:
// the release commit goes straight to main, so what it writes must stay valid.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rollChangelog } from '../.github/scripts/changelog-release.mjs';

const REPO = 'https://github.com/prohand/gladys-dreamemowers';

test('the real changelog has an Unreleased section the release can roll', async () => {
  const text = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const rolled = rollChangelog(text, '9.8.7', '2026-01-02');
  assert.notEqual(rolled, text);
  assert.match(rolled, /^## \[Unreleased\]\n\n## \[9\.8\.7\] - 2026-01-02\n/m);
  assert.match(rolled, new RegExp(`^\\[9\\.8\\.7\\]: ${REPO}/`, 'm'));
});

test('the first release links to its tag, the next ones compare', () => {
  const first = rollChangelog(
    `# Changelog\n\n## [Unreleased]\n\n- Thing.\n\n[Unreleased]: ${REPO}/commits/main\n`,
    '1.0.0',
    '2026-01-02',
  );
  assert.match(first, new RegExp(`\\[1\\.0\\.0\\]: ${REPO}/releases/tag/v1\\.0\\.0`));
  const second = rollChangelog(
    first.replace('## [1.0.0]', '- Fix.\n\n## [1.0.0]'),
    '1.0.1',
    '2026-02-03',
  );
  assert.match(
    second,
    new RegExp(`\\[1\\.0\\.1\\]: ${REPO}/compare/v1\\.0\\.0\\.\\.\\.v1\\.0\\.1`),
  );
});

test('the same version is never released twice', () => {
  const text = '# Changelog\n\n## [Unreleased]\n\n## [1.0.1] - 2026-01-02\n\n- Thing.\n';
  assert.equal(rollChangelog(text, '1.0.1', '2026-01-03'), text);
});
