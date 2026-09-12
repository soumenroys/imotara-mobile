const { withMainActivity } = require('@expo/config-plugins');

const MARKER = '// IMOTARA_IME_INSETS_V1';
const END_MARKER = '// IMOTARA_IME_INSETS_END';

// Makes the Android window actually shrink when the keyboard opens.
//
// THE PROBLEM
// Under edge-to-edge (app.json `edgeToEdgeEnabled: true`, and mandatory from
// targetSdk 35+) the window is laid out behind the system bars AND behind the
// IME, so `android:windowSoftInputMode="adjustResize"` no longer resizes
// anything. The app has to consume the ime() inset itself. React Native does
// not do this, so the content area stays full-height and the composer sits
// under the keyboard unless something lifts it.
//
// WHY KeyboardAvoidingView IS NOT ENOUGH
// It relies on RN's keyboard events, and on Android those are emitted from
// ReactRootView.checkForKeyboardEvents() which:
//   1. fires ONLY when ime() visibility TOGGLES —
//        if (keyboardIsVisible != mKeyboardIsVisible) { ... }
//      so an IME that changes height while already visible (a promo/toolbar
//      row, a suggestion strip, one-handed mode, some third-party keyboards)
//      emits nothing at all and the composer is left stranded; and
//   2. reports a DERIVED height, `imeInsets.bottom - barInsets.bottom`, while
//      reporting position from a different frame, `mVisibleViewArea.bottom`.
//      On any device where those two disagree the result is a dead gap or an
//      overlap — which is why the symptom differs per handset.
// `keyboardDidChangeFrame` is never emitted on Android at all.
//
// THE FIX
// Pad the content view by the real ime() inset, straight from the OS, on every
// inset dispatch. No derived heights, no per-device constants, so it is
// correct for any screen size, density, aspect ratio, navigation mode or
// keyboard — and it recomputes on in-place IME resizes, which is the case RN
// cannot see.
//
// Pad by the FULL ime inset. Subtracting the navigation-bar inset looks
// right on paper — safe-area-context pads for it elsewhere — but was measured
// WRONG here on 2026-09-12: it left the composer 48px behind the keyboard,
// exactly one nav-bar height too low, because tabBarHideOnKeyboard removes
// the tab bar (which supplied that padding) the instant the keyboard opens.
// The ime inset is 0 when the keyboard is closed, so closed-state layout is
// untouched.
//
// NOTE: this covers the Activity window only. React Native <Modal> renders in
// its own window, which this listener never sees, so modal-hosted inputs keep
// their own KeyboardAvoidingView. Do not remove those.
// The transform is exported separately so it can be unit-tested without
// standing up Expo's async mod pipeline.
function transformMainActivity(contents, language) {
    if (language !== 'kt') {
      throw new Error(
        `withAndroidImeInsets expects a Kotlin MainActivity, got "${language}"`
      );
    }
    // Strip any previous injection before re-injecting.
    //
    // A plain `if (already injected) return` is not enough: on an incremental
    // prebuild the old block survives, so an EDIT to the Kotlin below would
    // silently never reach the build. That bit once already — a corrected
    // inset formula was skipped and the stale one shipped into the APK.
    if (contents.includes(MARKER)) {
      const start = contents.indexOf(MARKER);
      const end = contents.indexOf(END_MARKER);
      if (end === -1 || end < start) {
        throw new Error(
          'withAndroidImeInsets found its start marker without a matching ' +
            'end marker in MainActivity — refusing to guess where the old ' +
            'injection ends. Run: npx expo prebuild -p android --clean'
        );
      }
      // trimEnd so the whitespace in front of the old marker cannot
      // accumulate across repeated prebuilds (that broke idempotency once).
      contents =
        contents.slice(0, start).trimEnd() +
        contents.slice(end + END_MARKER.length);
    }

    const imports = [
      'import android.view.View',
      'import androidx.core.view.ViewCompat',
      'import androidx.core.view.WindowInsetsCompat',
    ];
    for (const imp of imports) {
      if (!contents.includes(imp)) {
        contents = contents.replace(
          /^import android\.os\.Bundle$/m,
          `import android.os.Bundle\n${imp}`
        );
      }
    }

    // Anchor on the super.onCreate call inside onCreate.
    const anchor = 'super.onCreate(null)';
    if (!contents.includes(anchor)) {
      throw new Error(
        `withAndroidImeInsets could not find "${anchor}" in MainActivity — ` +
          'the Expo template changed and the IME inset fix would silently not apply.'
      );
    }

    const injection = `${anchor}

    ${MARKER}
    // Consume the ime() inset so the window genuinely shrinks for the keyboard.
    // See plugins/withAndroidImeInsets.js for why KeyboardAvoidingView cannot
    // do this on Android. Runs on every inset dispatch, so it also tracks an
    // IME that changes height while it is already visible.
    val imotaraContentView = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(imotaraContentView) { view, insets ->
      // Pad by the FULL ime inset, so the content area ends exactly at the top
      // edge of the keyboard.
      //
      // Do NOT subtract the navigation-bar inset "because safe-area-context
      // already pads for it". That was tried and measured wrong on
      // 2026-09-12: the composer landed 48px BEHIND the keyboard, exactly one
      // navigation-bar height (72px) too low. The reason is that the bottom
      // padding on the chat screen comes from the tab bar, and
      // tabBarHideOnKeyboard REMOVES the tab bar the moment the keyboard
      // opens — so with the keyboard up there is nothing left to double-count.
      //
      // A screen that does pad by insets.bottom itself gets at most a small
      // gap, never a hidden input, which is the safe direction to err in.
      val keyboardOverlap = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      if (view.paddingBottom != keyboardOverlap) {
        view.setPadding(
          view.paddingLeft,
          view.paddingTop,
          view.paddingRight,
          keyboardOverlap
        )
      }
      // Return the insets unconsumed: other views (and RN's own keyboard
      // events) must still see them.
      insets
    }
    ${END_MARKER}`;

    return contents.replace(anchor, injection);
}

const withAndroidImeInsets = (config) =>
  withMainActivity(config, (mod) => {
    mod.modResults.contents = transformMainActivity(
      mod.modResults.contents,
      mod.modResults.language
    );
    return mod;
  });

module.exports = withAndroidImeInsets;
module.exports.transformMainActivity = transformMainActivity;
module.exports.MARKER = MARKER;
