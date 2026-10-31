import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { NativeSignIn, SignInOptions } from './auth';

/**
 * The iPhone's own Google and Apple sheets (spec 045 FR-004, FR-005). The rules around them stay in
 * lib/auth.ts (`signInNatively`). Their native code is only in builds, so Expo Go (`pnpm dev:phone`)
 * offers the email link only, and the libraries load on first tap.
 */
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

const native: NativeSignIn = {
  async apple(nonce) {
    const Apple = await import('expo-apple-authentication');
    try {
      const credential = await Apple.signInAsync({
        requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
        nonce,
      });
      if (!credential.identityToken) throw new Error('Apple gave no identity token');
      return { idToken: credential.identityToken, code: credential.authorizationCode, givenName: credential.fullName?.givenName ?? null };
    } catch (error) {
      if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return 'cancelled';
      throw error;
    }
  },
  ...(iosClientId
    ? {
        async google() {
          const { GoogleSignin, isCancelledResponse } = await import('@react-native-google-signin/google-signin');
          GoogleSignin.configure({ iosClientId });
          const response = await GoogleSignin.signIn();
          if (isCancelledResponse(response)) return 'cancelled' as const;
          if (!response.data.idToken) throw new Error('Google gave no ID token');
          return { idToken: response.data.idToken };
        },
      }
    : {}),
};

export const signInOptions: SignInOptions = {
  webGoogle: false,
  native: Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? null : native,
};
