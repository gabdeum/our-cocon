import type { SignInOptions } from './auth';

/** The web: Google through its redirect, no Apple (spec 045 FR-005). The iPhone: native-sign-in.ios.ts. */
export const signInOptions: SignInOptions = { webGoogle: true, native: null };
