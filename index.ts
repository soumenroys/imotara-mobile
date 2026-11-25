import { initSentry } from './src/lib/sentry';
initSentry();

import { syncI18nManagerFromStoredSettings } from './src/lib/rtl';
// Fire-and-forget — the I18nManager flag it sets only affects the NEXT app
// launch (see src/lib/rtl.ts), so there's nothing to gain from blocking
// registerRootComponent below on this async AsyncStorage read.
void syncI18nManagerFromStoredSettings();

// ⚡ Cold start (Dec release check, 25 Nov 2026): SDK 58's splash module hides the
// splash with a 400 ms ease-in fade on Android, so the app LOOKED ~0.25 s later than
// 1.7.2 (system crossfade ≈ 100 ms) although it was ready at the same moment
// (measured frame by frame on the emulator). 120 ms matches 1.7.2's feel. iOS does
// not fade unless `fade: true`, so iOS is unchanged.
import * as SplashScreen from 'expo-splash-screen';
import { SPLASH_FADE_MS } from './src/config/splash';
try {
  SplashScreen.setOptions({ duration: SPLASH_FADE_MS });
} catch {
  // an old dev client without the native module still opens
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
