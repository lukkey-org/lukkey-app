/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { getRuntimeConfig } from "../env/runtimeConfig.js";

function parseUint32Key(raw) {
  const parts = String(raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 4) {
    return null;
  }

  const values = parts.map((part) => {
    if (/^0x/i.test(part)) {
      return Number.parseInt(part, 16);
    }
    return Number(part);
  });

  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return new Uint32Array(values.map((value) => value >>> 0));
}

export function getDeviceAuthKey() {
  // This key is used by app-side device verification logic and is available to
  // the shipped client bundle. It is not a server-side secret store.
  const runtimeConfig = getRuntimeConfig();
  const keyFromRuntime = Array.isArray(runtimeConfig.deviceAuthKey)
    ? new Uint32Array(runtimeConfig.deviceAuthKey.map((value) => Number(value) >>> 0))
    : null;

  if (keyFromRuntime && keyFromRuntime.length === 4) {
    return keyFromRuntime;
  }

  const keyFromEnv = parseUint32Key(
    process.env.EXPO_PUBLIC_DEVICE_AUTH_KEY || process.env.DEVICE_AUTH_KEY,
  );

  if (keyFromEnv) {
    return keyFromEnv;
  }

  return new Uint32Array([0, 0, 0, 0]);
}
