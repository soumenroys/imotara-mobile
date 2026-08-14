import { initSentry } from './src/lib/sentry';
initSentry();

import { syncI18nManagerFromStoredSettings } from './src/lib/rtl';
// Fire-and-forget — the I18nManager flag it sets only affects the NEXT app
// launch (see src/lib/rtl.ts), so there's nothing to gain from blocking
// registerRootComponent below on this async AsyncStorage read.
void syncI18nManagerFromStoredSettings();

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
