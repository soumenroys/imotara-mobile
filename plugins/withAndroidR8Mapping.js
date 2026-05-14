const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = '// R8_MAPPING_BUNDLE_INJECTED_V2';

// Embeds the R8/ProGuard mapping file into the AAB so Play Console can
// auto-extract it for crash symbolication.
//
// Searches the entire build directory for any mapping.txt — handles the
// varying output paths across AGP versions and EAS cloud build environments.
const withAndroidR8Mapping = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes(MARKER)) return mod;

    mod.modResults.contents += `
${MARKER}
afterEvaluate {
    tasks.matching { it.name == "bundleRelease" }.configureEach { task ->
        task.doLast {
            // Search broadly for mapping.txt anywhere under build/
            def mappingFile = null
            def candidates = [
                new File(project.buildDir, "outputs/mapping/release/mapping.txt"),
                new File(project.buildDir, "outputs/mapping/releaseMinify/mapping.txt"),
                new File(project.buildDir, "intermediates/proguard_files/release/mapping.txt"),
            ]
            for (c in candidates) {
                if (c.exists()) { mappingFile = c; break }
            }
            if (mappingFile == null) {
                // Fallback: find first mapping.txt anywhere under buildDir
                project.fileTree(project.buildDir).matching {
                    include "**/mapping.txt"
                }.each { f -> if (mappingFile == null) mappingFile = f }
            }

            def aabFile = project.fileTree(project.buildDir).matching {
                include "**/bundle/release/*.aab"
            }.singleFile

            if (mappingFile != null && mappingFile.exists() && aabFile != null && aabFile.exists()) {
                println "Embedding R8 mapping (${mappingFile}) into AAB (${aabFile})..."
                project.exec {
                    commandLine 'sh', '-c',
                        'TMP=$(mktemp -d) && ' +
                        'mkdir -p "$TMP/BUNDLE-METADATA/com.android.tools.build.obfuscation" && ' +
                        'cp "' + mappingFile.absolutePath + '" "$TMP/BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map" && ' +
                        'cd "$TMP" && zip -u "' + aabFile.absolutePath + '" "BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map" && ' +
                        'rm -rf "$TMP"'
                }
                println "Done: mapping embedded."
            } else {
                println "Skipping mapping embed — mappingFile=${mappingFile} aab=${aabFile}"
            }
        }
    }
}
`;
    return mod;
  });

module.exports = withAndroidR8Mapping;
