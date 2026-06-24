const { withSettingsGradle } = require("@expo/config-plugins");

const MARKER = "codex-production-expo-dev-client-exclusion";

const EXCLUSION_BLOCK = `// ${MARKER}
def isProductionBuild = System.getenv('EAS_BUILD_PROFILE') == 'production' || System.getenv('NODE_ENV') == 'production'
if (isProductionBuild) {
  expoAutolinking.exclude = ((expoAutolinking.exclude ?: []) + ['expo-dev-client', 'expo-dev-launcher', 'expo-dev-menu', 'expo-dev-menu-interface']).unique()
}
// end ${MARKER}
`;

module.exports = function withProductionExpoDevClientExclusion(config) {
  return withSettingsGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes(MARKER)) {
      return config;
    }

    const target = "expoAutolinking.useExpoModules()";
    if (contents.includes(target)) {
      config.modResults.contents = contents.replace(target, `${EXCLUSION_BLOCK}\n${target}`);
    }

    return config;
  });
};
