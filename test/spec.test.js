import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY,
  ACTIVITY_LABELS,
  activityOf,
  errorText,
  isMowerModel,
  STATUS,
  statusText,
} from '../src/dreame/spec.js';
import { LANGUAGES, localize, pick } from '../src/i18n.js';

test('every known status folds into an activity', () => {
  for (const status of Object.values(STATUS).filter((s) => s !== STATUS.NONE)) {
    assert.notEqual(activityOf(status), ACTIVITY.UNKNOWN, `status ${status}`);
  }
  assert.equal(activityOf(STATUS.CHARGED), ACTIVITY.DOCKED);
  assert.equal(activityOf(999), ACTIVITY.UNKNOWN);
  assert.equal(activityOf(null), ACTIVITY.UNKNOWN);
});

test('every status and activity is written in every language', () => {
  for (const status of Object.values(STATUS)) {
    for (const language of LANGUAGES) {
      const text = statusText(status, language);
      assert.ok(text && !/undefined/.test(text), `status ${status} in ${language}`);
    }
  }
  for (const labels of Object.values(ACTIVITY_LABELS)) {
    assert.deepEqual(Object.keys(labels).sort(), [...LANGUAGES].sort());
  }
});

test('an unknown status or error keeps its code', () => {
  assert.equal(statusText(42, 'fr'), 'Inconnu (42)');
  assert.equal(errorText(999, 'de'), 'Fehler 999');
  assert.equal(errorText(2, 'fr'), 'Tondeuse coincée (2)');
  assert.equal(errorText(0, 'es'), 'Sin error');
  assert.equal(errorText(null, 'en'), 'No error');
});

test('only mowers are mowers', () => {
  assert.ok(isMowerModel('dreame.mower.p2255'));
  assert.ok(isMowerModel('mova.mower.g2405a'));
  assert.ok(!isMowerModel('dreame.vacuum.r2228'));
  assert.ok(!isMowerModel(undefined));
});

test('pick falls back to English, localize writes every language', () => {
  assert.equal(pick('it', { en: 'Hello', fr: 'Bonjour' }), 'Hello');
  assert.deepEqual(Object.keys(localize((l) => l)), LANGUAGES);
});
