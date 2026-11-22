// -----------------------------------------------------------------------------
// What a Dreame / MOVA mower says, and how to talk to it.
//
// The mowers speak MIoT: every value is a property `siid:piid` (service id,
// property id) and every command an action `siid:aiid`. The numbers below come
// from the mowers themselves (A1, A2, A3, MOVA 600/1000, LiDAX, Viax…) and are
// the same across the range; a model that differs only needs this file changed.
//
// The texts are written in the four languages of the Gladys interface. A status
// or an error the table does not know is still shown, as its raw code.
// -----------------------------------------------------------------------------

import { LANGUAGES, pick } from '../i18n.js';

/** Properties read with `get_properties`. */
export const PROPERTIES = {
  STATUS: { siid: 2, piid: 1 },
  ERROR: { siid: 2, piid: 2 },
  BATTERY: { siid: 3, piid: 1 },
  CHARGING: { siid: 3, piid: 2 },
};

/** Actions sent with `action`. */
export const ACTIONS = {
  START: { siid: 5, aiid: 1 },
  STOP: { siid: 5, aiid: 2 },
  DOCK: { siid: 5, aiid: 3 },
  PAUSE: { siid: 5, aiid: 4 },
};

/** The commands a user (or a scene) can send, by name. */
export const COMMANDS = {
  start: ACTIONS.START,
  pause: ACTIONS.PAUSE,
  stop: ACTIONS.STOP,
  dock: ACTIONS.DOCK,
};

/** Raw values of the status property (2:1). */
export const STATUS = {
  NONE: 0,
  MOWING: 1,
  STANDBY: 2,
  PAUSED: 3,
  ERROR: 4,
  RETURNING: 5,
  CHARGING: 6,
  MAPPING: 11,
  CHARGED: 13,
  UPDATING: 14,
  CHARGING_PAUSED_HOT: 15,
  CHARGING_PAUSED_COLD: 16,
  MAINTENANCE: 75,
};

/**
 * The few states a scene author thinks in. Several raw statuses fold into one
 * (charging, charged and a charge paused by the temperature all mean "docked"),
 * so a scene filter never has to list them all. Never renamed: the keys are
 * stored in the scenes.
 */
export const ACTIVITY = {
  MOWING: 'mowing',
  PAUSED: 'paused',
  RETURNING: 'returning',
  DOCKED: 'docked',
  ERROR: 'error',
  UNKNOWN: 'unknown',
};

const ACTIVITY_OF_STATUS = {
  [STATUS.MOWING]: ACTIVITY.MOWING,
  [STATUS.MAPPING]: ACTIVITY.MOWING,
  [STATUS.STANDBY]: ACTIVITY.PAUSED,
  [STATUS.PAUSED]: ACTIVITY.PAUSED,
  [STATUS.MAINTENANCE]: ACTIVITY.PAUSED,
  [STATUS.ERROR]: ACTIVITY.ERROR,
  [STATUS.RETURNING]: ACTIVITY.RETURNING,
  [STATUS.CHARGING]: ACTIVITY.DOCKED,
  [STATUS.CHARGED]: ACTIVITY.DOCKED,
  [STATUS.UPDATING]: ACTIVITY.DOCKED,
  [STATUS.CHARGING_PAUSED_HOT]: ACTIVITY.DOCKED,
  [STATUS.CHARGING_PAUSED_COLD]: ACTIVITY.DOCKED,
};

/**
 * @param {number | null | undefined} status raw status (2:1)
 * @returns {string} a value of {@link ACTIVITY}
 */
export function activityOf(status) {
  return ACTIVITY_OF_STATUS[status] ?? ACTIVITY.UNKNOWN;
}

const STATUS_TEXTS = {
  [STATUS.NONE]: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
  [STATUS.MOWING]: { en: 'Mowing', fr: 'Tonte en cours', de: 'Mäht', es: 'Cortando' },
  [STATUS.STANDBY]: { en: 'Standby', fr: 'En veille', de: 'Bereit', es: 'En espera' },
  [STATUS.PAUSED]: { en: 'Paused', fr: 'En pause', de: 'Pausiert', es: 'En pausa' },
  [STATUS.ERROR]: {
    en: 'Stopped by an error',
    fr: 'Arrêtée sur erreur',
    de: 'Wegen Fehler gestoppt',
    es: 'Detenido por un error',
  },
  [STATUS.RETURNING]: {
    en: 'Returning to base',
    fr: 'Retour à la base',
    de: 'Fährt zur Station',
    es: 'Volviendo a la base',
  },
  [STATUS.CHARGING]: { en: 'Charging', fr: 'En charge', de: 'Lädt', es: 'Cargando' },
  [STATUS.MAPPING]: {
    en: 'Mapping',
    fr: 'Cartographie',
    de: 'Kartierung',
    es: 'Creando mapa',
  },
  [STATUS.CHARGED]: {
    en: 'Charged',
    fr: 'Chargée',
    de: 'Aufgeladen',
    es: 'Cargado',
  },
  [STATUS.UPDATING]: {
    en: 'Updating',
    fr: 'Mise à jour',
    de: 'Aktualisierung',
    es: 'Actualizando',
  },
  [STATUS.CHARGING_PAUSED_HOT]: {
    en: 'Charge paused (too hot)',
    fr: 'Charge en pause (trop chaud)',
    de: 'Laden pausiert (zu heiß)',
    es: 'Carga en pausa (calor)',
  },
  [STATUS.CHARGING_PAUSED_COLD]: {
    en: 'Charge paused (too cold)',
    fr: 'Charge en pause (trop froid)',
    de: 'Laden pausiert (zu kalt)',
    es: 'Carga en pausa (frío)',
  },
  [STATUS.MAINTENANCE]: {
    en: 'At maintenance point',
    fr: 'Au point de maintenance',
    de: 'Am Wartungspunkt',
    es: 'En punto de mantenimiento',
  },
};

/**
 * The status in one language.
 * @param {number | null | undefined} status raw status (2:1)
 * @param {string} language one of {@link LANGUAGES}
 */
export function statusText(status, language) {
  if (status === null || status === undefined) {
    return pick(language, STATUS_TEXTS[STATUS.NONE]);
  }
  const texts = STATUS_TEXTS[status];
  if (texts) {
    return pick(language, texts);
  }
  return `${pick(language, STATUS_TEXTS[STATUS.NONE])} (${status})`;
}

/** Raw values of the error property (2:2) the table names. 0 means no error. */
const ERROR_TEXTS = {
  0: { en: 'No error', fr: 'Aucune erreur', de: 'Kein Fehler', es: 'Sin error' },
  1: { en: 'Mower tilted', fr: 'Tondeuse penchée', de: 'Mäher gekippt', es: 'Robot inclinado' },
  2: { en: 'Mower stuck', fr: 'Tondeuse coincée', de: 'Mäher festgefahren', es: 'Robot atascado' },
  3: {
    en: 'Path to the station too narrow',
    fr: 'Passage vers la base trop étroit',
    de: 'Weg zur Station zu schmal',
    es: 'Paso a la base demasiado estrecho',
  },
  4: {
    en: 'Left wheel error',
    fr: 'Erreur roue gauche',
    de: 'Fehler linkes Rad',
    es: 'Error rueda izquierda',
  },
  5: {
    en: 'Right wheel error',
    fr: 'Erreur roue droite',
    de: 'Fehler rechtes Rad',
    es: 'Error rueda derecha',
  },
  6: {
    en: 'Lift motor error',
    fr: 'Erreur moteur de levage',
    de: 'Fehler Hubmotor',
    es: 'Error motor de elevación',
  },
  7: {
    en: 'Blade disc blocked',
    fr: 'Disque de coupe bloqué',
    de: 'Messerscheibe blockiert',
    es: 'Disco de corte bloqueado',
  },
  9: {
    en: 'Bumper error',
    fr: 'Erreur pare-chocs',
    de: 'Fehler Stoßfänger',
    es: 'Error del parachoques',
  },
  10: { en: 'Charging error', fr: 'Erreur de charge', de: 'Ladefehler', es: 'Error de carga' },
  11: {
    en: 'Battery too hot',
    fr: 'Batterie trop chaude',
    de: 'Akku zu heiß',
    es: 'Batería demasiado caliente',
  },
  12: {
    en: 'LiDAR blocked',
    fr: 'LiDAR obstrué',
    de: 'LiDAR verdeckt',
    es: 'LiDAR obstruido',
  },
  16: { en: 'LiDAR dirty', fr: 'LiDAR sale', de: 'LiDAR verschmutzt', es: 'LiDAR sucio' },
  18: {
    en: 'Out of the map',
    fr: 'Hors de la carte',
    de: 'Außerhalb der Karte',
    es: 'Fuera del mapa',
  },
  19: {
    en: 'Position lost',
    fr: 'Position perdue',
    de: 'Position verloren',
    es: 'Posición perdida',
  },
  20: { en: 'Sensor error', fr: 'Erreur capteur', de: 'Sensorfehler', es: 'Error de sensor' },
  21: {
    en: 'Stuck in a no-go zone',
    fr: 'Bloquée dans une zone interdite',
    de: 'In Sperrzone festgefahren',
    es: 'Atascado en zona prohibida',
  },
  22: {
    en: 'Out of the map',
    fr: 'Hors de la carte',
    de: 'Außerhalb der Karte',
    es: 'Fuera del mapa',
  },
};

const UNKNOWN_ERROR = { en: 'Error', fr: 'Erreur', de: 'Fehler', es: 'Error' };

/**
 * The error in one language. A code the table does not name keeps its number,
 * so the user can still look it up in the Dreame app.
 * @param {number | null | undefined} code raw error code (2:2)
 * @param {string} language one of {@link LANGUAGES}
 */
export function errorText(code, language) {
  if (code === null || code === undefined) {
    return pick(language, ERROR_TEXTS[0]);
  }
  const texts = ERROR_TEXTS[code];
  if (texts) {
    return code === 0 ? pick(language, texts) : `${pick(language, texts)} (${code})`;
  }
  return `${pick(language, UNKNOWN_ERROR)} ${code}`;
}

/** Every activity, with its label in each language (scene trigger options). */
export const ACTIVITY_LABELS = {
  [ACTIVITY.MOWING]: { en: 'Mowing', fr: 'Tond', de: 'Mäht', es: 'Cortando' },
  [ACTIVITY.PAUSED]: { en: 'Paused', fr: 'En pause', de: 'Pausiert', es: 'En pausa' },
  [ACTIVITY.RETURNING]: {
    en: 'Returning to base',
    fr: 'Retourne à la base',
    de: 'Fährt zur Station',
    es: 'Volviendo a la base',
  },
  [ACTIVITY.DOCKED]: {
    en: 'On its base',
    fr: 'Sur sa base',
    de: 'In der Station',
    es: 'En su base',
  },
  [ACTIVITY.ERROR]: { en: 'In error', fr: 'En erreur', de: 'Fehler', es: 'En error' },
  [ACTIVITY.UNKNOWN]: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
};

/** Model prefixes of the mowers in the cloud device list. */
export const MOWER_MODEL_PREFIXES = ['dreame.mower.', 'mova.mower.'];

/** Commercial names of the known models, shown as the device model. */
export const MODEL_NAMES = {
  'dreame.mower.p2255': 'Dreame A1',
  'dreame.mower.g2422': 'Dreame A1 Pro',
  'dreame.mower.g2408': 'Dreame A2',
  'dreame.mower.g2541e': 'Dreame A3 AWD Pro 3500',
  'mova.mower.g2405a': 'MOVA 600',
  'mova.mower.g2405b': 'MOVA 600 Kit',
  'mova.mower.g2405c': 'MOVA 1000',
  'mova.mower.g2529b': 'MOVA LiDAX 800 Ultra',
  'mova.mower.g2552': 'MOVA Viax 250',
};

/** @param {string} model e.g. `dreame.mower.p2255` */
export function isMowerModel(model) {
  return typeof model === 'string' && MOWER_MODEL_PREFIXES.some((p) => model.startsWith(p));
}

export { LANGUAGES };
