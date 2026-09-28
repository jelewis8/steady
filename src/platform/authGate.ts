import type { AuthGate } from './interfaces';

/** Web has no biometric gate for PWAs we can rely on; the passcode lock is used instead. Phase 2: native biometrics. */
export const webAuthGate: AuthGate = {
  async isAvailable() {
    return false;
  },
  async authenticate() {
    return false;
  },
};
