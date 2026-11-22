// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The store indexer validates the manifest shape; only these tests know which
// handlers the code registers, and the store rules easiest to miss.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG } from '../src/config.js';
import { REGIONS, ACCOUNT_TYPES } from '../src/dreame/cloud.js';
import { ACTIVITY, ACTIVITY_LABELS, COMMANDS } from '../src/dreame/spec.js';
import { SCENE_ACTIONS, SCENE_TRIGGER_KEYS } from '../src/capabilities/scenes.js';
import { WIDGETS } from '../src/capabilities/widget.js';
import { LANGUAGES } from '../src/i18n.js';

const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('../gladys-assistant-integration.json'));
const pkg = JSON.parse(await read('../package.json'));
const indexSource = await read('../index.js');

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

// Every list of form fields the manifest can declare (same field grammar).
const allFields = [
  ...manifest.config_schema,
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

// The vocabulary the store indexes: an unknown category is silently dropped.
const CATEGORIES = [
  'climate',
  'lighting',
  'energy',
  'security',
  'multimedia',
  'appliances',
  'environment',
  'protocols',
  'network',
  'notifications',
  'assistants',
  'services',
  'transport',
  'vehicles',
  'servers',
  'leisure',
];

/** Whether the minimum of `gladys_version` is at least major.minor. */
function floorAtLeast(wantedMajor, wantedMinor) {
  const [major, minor] = manifest.gladys_version.replace(/^>=/, '').split('.').map(Number);
  return major > wantedMajor || (major === wantedMajor && minor >= wantedMinor);
}

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`), manifest.docker_image);
  assert.match(manifest.docker_image, /^ghcr\.io\/prohand\/gladys-dreamemowers:/);
});

test('the Gladys floor covers every field the manifest declares', () => {
  // categories: 4.86 — widgets and scenes: 5.1 — keywords and countries: 5.3.
  assert.ok(floorAtLeast(5, 3), `got ${manifest.gladys_version}`);
});

test('the categories stay inside the vocabulary the store indexes', () => {
  const { categories } = manifest;
  assert.ok(categories.length >= 1 && categories.length <= 3);
  for (const category of categories) {
    assert.ok(CATEGORIES.includes(category), `unknown category "${category}"`);
  }
});

test('the search keywords follow the store rules', () => {
  const { keywords } = manifest;
  assert.ok(keywords.length >= 1 && keywords.length <= 10);
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, keywords.length, 'keywords must be unique');
  for (const keyword of normalized) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, `keyword "${keyword}"`);
  }
});

test('the countries are ISO codes, 1 to 20, unique', () => {
  const { countries } = manifest;
  assert.ok(countries.length >= 1 && countries.length <= 20, `${countries.length} countries`);
  assert.equal(new Set(countries).size, countries.length);
  for (const country of countries) {
    assert.match(country, /^[A-Z]{2}$/);
  }
  assert.ok(countries.includes('FR'));
});

test('the mowers are cloud-only: the manifest says so', () => {
  // A single transport: no "prefer local" toggle in the Configuration screen.
  assert.deepEqual(manifest.transports, ['cloud']);
});

test('config_schema defaults match DEFAULT_CONFIG, and the code knows every key', () => {
  const stored = manifest.config_schema.filter((field) => field.type !== 'section');
  for (const field of stored) {
    assert.ok(field.key in DEFAULT_CONFIG, `config key "${field.key}" unknown to the code`);
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, `default of "${field.key}"`);
    }
  }
  assert.deepEqual(Object.keys(DEFAULT_CONFIG).sort(), keysOf(stored).sort());
});

test('the select options of the config are the values the code accepts', () => {
  const options = (key) =>
    manifest.config_schema.find((field) => field.key === key).options.map((o) => o.value);
  assert.deepEqual(options('region').sort(), [...REGIONS].sort());
  assert.deepEqual(options('account_type').sort(), Object.keys(ACCOUNT_TYPES).sort());
  assert.deepEqual(options('language').sort(), [...LANGUAGES].sort());
});

test('the password is a secret field', () => {
  const password = manifest.config_schema.find((field) => field.key === 'password');
  assert.equal(password.type, 'secret');
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.equal(section.placeholder, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('dynamic selects declare the devices source and no static options', () => {
  const dynamic = allFields.filter((field) => field.source !== undefined);
  assert.ok(dynamic.length >= 4);
  for (const field of dynamic) {
    assert.equal(field.source, 'devices');
    assert.equal(field.options, undefined, `field "${field.key}"`);
  }
});

test('every manifest action is handled in index.js', () => {
  for (const action of manifest.actions) {
    assert.match(indexSource, new RegExp(`onAction\\('${action.key}'`), action.key);
  }
});

test('every scene action key has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_actions).sort(), Object.keys(SCENE_ACTIONS).sort());
  const commands = manifest.scene_actions
    .find((action) => action.key === 'mower_command')
    .fields.find((field) => field.key === 'command')
    .options.map((option) => option.value);
  assert.deepEqual(commands.sort(), Object.keys(COMMANDS).sort());
});

test('every scene trigger the code fires is declared, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), [...SCENE_TRIGGER_KEYS].sort());
  const statuses = manifest.scene_triggers
    .find((trigger) => trigger.key === 'status_changed')
    .fields.find((field) => field.key === 'status')
    .options.map((option) => option.value);
  // Every activity a scene can wait for (`unknown` is never fired).
  const fired = Object.values(ACTIVITY).filter((activity) => activity !== ACTIVITY.UNKNOWN);
  assert.deepEqual(statuses.sort(), fired.sort());
  for (const activity of fired) {
    assert.ok(ACTIVITY_LABELS[activity]);
  }
});

test('every widget key has a content handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets).sort(), Object.keys(WIDGETS).sort());
  for (const widget of Object.values(WIDGETS)) {
    assert.equal(typeof widget.get, 'function');
    assert.equal(typeof widget.action, 'function');
  }
});

/** Every multi-language object of the manifest, with where it sits. */
function multiLanguageTexts(node, path = 'manifest') {
  if (Array.isArray(node)) {
    return node.flatMap((child, index) => multiLanguageTexts(child, `${path}[${index}]`));
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }
  const keys = Object.keys(node);
  if (keys.includes('en') && keys.every((key) => /^[a-z]{2}$/.test(key))) {
    return [{ path, text: node }];
  }
  return keys.flatMap((key) => multiLanguageTexts(node[key], `${path}.${key}`));
}

test('every multi-language text of the manifest carries en, fr, de and es', () => {
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 50, `only ${texts.length} texts found`);
  for (const { path, text } of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), `${path}: languages`);
    for (const language of LANGUAGES) {
      assert.ok(text[language].trim().length > 0, `${path}.${language} is empty`);
    }
  }
});

test('the per-language length limits of the store hold in every language', () => {
  const within = (text, min, max, where) => {
    for (const language of LANGUAGES) {
      const { length } = text[language];
      assert.ok(length >= min && length <= max, `${where}.${language}: ${length} characters`);
    }
  };
  within(manifest.description, 10, 100, 'description');
  for (const widget of manifest.widgets) {
    within(widget.label, 3, 30, `widget ${widget.key} label`);
    within(widget.description, 1, 100, `widget ${widget.key} description`);
  }
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    within(section.description, 1, 1000, `section ${section.key} description`);
  }
});

test('every user documentation language exists', async () => {
  for (const language of LANGUAGES) {
    const doc = await read(`../docs/${language}.md`);
    assert.ok(doc.length > 500, `docs/${language}.md is too short`);
  }
});
