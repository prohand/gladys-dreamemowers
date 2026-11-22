// -----------------------------------------------------------------------------
// Scene triggers and scene actions (Gladys 5.1+).
//
// Triggers ("this happened") are fired by src/service.js from what changed
// between two reads of the cloud:
//   - status_changed  the mower moved to another activity (mowing, paused,
//                     returning, docked, error). Filters: the mower, the new
//                     activity. Variables: status, previous_status, battery.
//   - error_occurred  the mower reported a new error code. Filter: the mower.
//                     Variables: error_code, error_text.
//
// Action ("do this"):
//   - mower_command   start / pause / stop / send back to base. Output: `sent`.
//     A mower that cannot be reached is an output (`sent: false`), not a
//     failure: a scene action is never a condition, the author gates on it.
//
// Trigger and action keys are stored in the users' scenes: never rename them.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { didFromExternalId } from '../devices/mower.js';
import { COMMANDS } from '../dreame/spec.js';

const logger = createLogger({ name: 'scenes' });

/** Every trigger key the integration fires (must match the manifest). */
export const SCENE_TRIGGER_KEYS = ['status_changed', 'error_occurred'];

export const SCENE_ACTIONS = {
  async mower_command(gladys, { fields, service }) {
    const did = didFromExternalId(gladys, fields.device);
    const command = fields.command;
    if (!did || !COMMANDS[command]) {
      logger.warn(`Scene action mower_command: unknown mower or command (${command})`);
      return { sent: false };
    }
    try {
      await service.command(did, command);
      return { sent: true };
    } catch (err) {
      logger.warn(`Scene action mower_command ${command} failed: ${err.message}`);
      return { sent: false };
    }
  },
};
