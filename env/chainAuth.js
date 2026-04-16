/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { getRuntimeConfig } from "./runtimeConfig.js";

const runtimeConfig = getRuntimeConfig();

// These values are consumed by client-side code. Legacy names are preserved for
// compatibility, but they must not be treated as confidential server-only secrets.
export const APP_KEY =
  runtimeConfig.appKey ||
  process.env.EXPO_PUBLIC_CHAIN_APP_KEY || process.env.CHAIN_APP_KEY || "";

export const APP_SECRET =
  runtimeConfig.appSecret ||
  process.env.EXPO_PUBLIC_CHAIN_APP_SECRET ||
  process.env.CHAIN_APP_SECRET ||
  "";

export const CHAIN_HMAC = {
  APP_KEY,
  APP_SECRET,
};
