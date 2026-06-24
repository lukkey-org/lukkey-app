/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { getRuntimeConfig } from "./runtimeConfig.js";

const runtimeConfig = getRuntimeConfig();

/**
 * Support email for LUKKEY.
 * Override with .env.local for local or deployment-specific builds.
 */
export const SUPPORT_EMAIL =
  runtimeConfig.supportEmail ||
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL ||
  process.env.SUPPORT_EMAIL ||
  "support@lukkey.com";
export default SUPPORT_EMAIL;
