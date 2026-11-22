// -----------------------------------------------------------------------------
// Dashboard widget "Robot lawn mower" (Gladys 5.1+).
//
// One card per mower: name, battery, status, error, cloud connection, and
// three buttons (start, pause, back to base). The mower is chosen in the
// widget settings (`device`, a select filled with the integration's devices);
// left empty, the card shows the first mower of the account.
//
// The content is declarative (no HTML): the core renders it with its own theme
// and translations. The battery gauge is bound live to the device feature when
// the user created the device; otherwise it shows the last value read.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { didFromExternalId, FEATURE, mowerIds } from '../devices/mower.js';
import { ACTIVITY, errorText, statusText } from '../dreame/spec.js';
import { localize } from '../i18n.js';
import { MOWER_WIDGET } from '../service.js';

const logger = createLogger({ name: 'widget' });

const ACTIVITY_COLORS = {
  [ACTIVITY.MOWING]: WIDGET_COLORS.SUCCESS,
  [ACTIVITY.PAUSED]: WIDGET_COLORS.WARNING,
  [ACTIVITY.RETURNING]: WIDGET_COLORS.INFO,
  [ACTIVITY.DOCKED]: WIDGET_COLORS.PRIMARY,
  [ACTIVITY.ERROR]: WIDGET_COLORS.DANGER,
  [ACTIVITY.UNKNOWN]: WIDGET_COLORS.NEUTRAL,
};

/** The buttons of the card: widget action key -> command and label. */
const BUTTONS = [
  {
    key: 'start',
    icon: 'play',
    style: 'primary',
    label: { en: 'Mow', fr: 'Tondre', de: 'Mähen', es: 'Cortar' },
  },
  {
    key: 'pause',
    icon: 'pause',
    style: 'secondary',
    label: { en: 'Pause', fr: 'Pause', de: 'Pause', es: 'Pausa' },
  },
  {
    key: 'dock',
    icon: 'home',
    style: 'secondary',
    label: { en: 'Back to base', fr: 'À la base', de: 'Zur Station', es: 'A la base' },
  },
];

const TOASTS = {
  start: {
    en: 'Mowing requested.',
    fr: 'Tonte demandée.',
    de: 'Mähen angefordert.',
    es: 'Corte solicitado.',
  },
  pause: {
    en: 'Pause requested.',
    fr: 'Pause demandée.',
    de: 'Pause angefordert.',
    es: 'Pausa solicitada.',
  },
  dock: {
    en: 'Return to base requested.',
    fr: 'Retour à la base demandé.',
    de: 'Rückkehr zur Station angefordert.',
    es: 'Regreso a la base solicitado.',
  },
};

function pickMower(gladys, service, settings) {
  const did = didFromExternalId(gladys, settings?.device);
  return (did && service.mower(did)) || service.mowers()[0];
}

function batteryTile(gladys, service, mower) {
  const label = { en: 'Battery', fr: 'Batterie', de: 'Akku', es: 'Batería' };
  if (service.isCreated(mower)) {
    return {
      type: 'gauge',
      label,
      device_feature: mowerIds(gladys, mower.did).feature(FEATURE.BATTERY),
    };
  }
  return { type: 'gauge', label, value: mower.battery ?? 0, min: 0, max: 100, unit: '%' };
}

export const WIDGETS = {
  [MOWER_WIDGET]: {
    async get(gladys, { settings, service }) {
      logger.debug(`onWidgetGet <- ${MOWER_WIDGET}`);
      const mower = pickMower(gladys, service, settings);
      if (!mower) {
        return {
          ttl_seconds: 300,
          components: [
            {
              type: 'text',
              text: {
                en: 'No mower yet: fill in your account in the integration configuration.',
                fr: 'Aucune tondeuse : renseignez votre compte dans la configuration de l’intégration.',
                de: 'Noch kein Mäher: Konto in der Konfiguration der Integration eintragen.',
                es: 'Ningún robot: indique su cuenta en la configuración de la integración.',
              },
            },
          ],
        };
      }
      const hasError = Boolean(mower.error);
      return {
        // service.js nudges the widget after every read: the TTL is a safety net.
        ttl_seconds: 300,
        components: [
          { type: 'text', variant: 'heading', text: mower.name.slice(0, 40) },
          batteryTile(gladys, service, mower),
          {
            type: 'status',
            items: [
              {
                label: { en: 'Status', fr: 'État', de: 'Status', es: 'Estado' },
                icon: 'activity',
                value: localize((language) => statusText(mower.status, language).slice(0, 40)),
                color: ACTIVITY_COLORS[mower.activity] ?? WIDGET_COLORS.NEUTRAL,
              },
              {
                label: { en: 'Error', fr: 'Erreur', de: 'Fehler', es: 'Error' },
                icon: 'alert-triangle',
                value: localize((language) => errorText(mower.error, language).slice(0, 40)),
                color: hasError ? WIDGET_COLORS.DANGER : WIDGET_COLORS.SUCCESS,
              },
              {
                label: { en: 'Connection', fr: 'Connexion', de: 'Verbindung', es: 'Conexión' },
                icon: 'cloud',
                value: mower.online
                  ? { en: 'Cloud', fr: 'Cloud', de: 'Cloud', es: 'Nube' }
                  : { en: 'Offline', fr: 'Hors ligne', de: 'Offline', es: 'Sin conexión' },
                color: mower.online ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.DANGER,
              },
            ],
          },
          // `params` are declared here and sent back as is: the handler never
          // receives user input (a dashboard can hang on a public wall).
          ...BUTTONS.map((button) => ({
            type: 'button',
            label: button.label,
            icon: button.icon,
            style: button.style,
            action: { key: button.key, params: { did: mower.did } },
          })),
        ],
      };
    },

    async action(gladys, { actionKey, params, service }) {
      logger.info(`onWidgetAction <- ${MOWER_WIDGET}.${actionKey}`);
      if (!TOASTS[actionKey]) {
        // Throwing acks the action as failed: the message reaches the user.
        throw new Error(`Unknown widget action: ${actionKey}`);
      }
      await service.command(String(params.did), actionKey);
      return TOASTS[actionKey];
    },
  },
};
