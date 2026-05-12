const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = '// R8_MAPPING_BUNDLE_INJECTED';

// Appends a Gradle doLast action to bundleRelease that embeds the R8 mapping
// file into AAB bundle metadata so Play Console auto-extracts it for crash
// symbolication. AGP 8.x should do this automatically, but the RN Gradle
// plugin configuration bypasses the standard wiring.
const withAndroidR8Mapping = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes(MARKER)) return mod;

    mod.modResults.contents += `
${MARKER}
afterEvaluate {
    tasks.named("bundleRelease").configure { task ->
        task.doLast {
            def mappingFile = new File(project.buildDir, "outputs/mapping/release/mapping.txt")
            def aabFile    = new File(project.buildDir, "outputs/bundle/release/app-release.aab")
            if (mappingFile.exists() && aabFile.exists()) {
                println "Embedding R8 mapping into AAB bundle metadata..."
                project.exec {
                    commandLine 'sh', '-c',
                        'TMP=$(mktemp -d) && ' +
                        'mkdir -p "$TMP/BUNDLE-METADATA/com.android.tools.build.obfuscation" && ' +
                        'cp "' + mappingFile.absolutePath + '" "$TMP/BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map" && ' +
                        'cd "$TMP" && zip -u "' + aabFile.absolutePath + '" "BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map" && ' +
                        'rm -rf "$TMP"'
                }
                println "Done: mapping embedded — Play Console will auto-extract on next AAB upload."
            } else {
                println "Skipping mapping embed — mapping.txt=" + mappingFile.exists() + " aab=" + aabFile.exists()
            }
        }
    }
}
`;
    return mod;
  });

module.exports = withAndroidR8Mapping;
