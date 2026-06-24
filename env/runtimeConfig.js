/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
function getExpoExtra() {
  try {
    const constantsModule = require("expo-constants");
    const Constants = constantsModule?.default || constantsModule;
    return (
      Constants?.expoConfig?.extra ||
      Constants?.manifest2?.extra ||
      Constants?.manifest?.extra ||
      {}
    );
  } catch {
    return {};
  }
}

export function getRuntimeConfig() {
  const extra = getExpoExtra();
  return extra?.runtimeConfig && typeof extra.runtimeConfig === "object"
    ? extra.runtimeConfig
    : {};
}
