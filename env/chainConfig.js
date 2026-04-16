/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { RUNTIME_GATEWAY } from "./runtimeGateway.js";
import { getRuntimeConfig } from "./runtimeConfig.js";

const runtimeConfig = getRuntimeConfig();

export const CHAIN_HOST =
  runtimeConfig.chainHost ||
  process.env.EXPO_PUBLIC_CHAIN_HOST ||
  process.env.CHAIN_HOST ||
  RUNTIME_GATEWAY.gatewayHost;

export const CHAIN_ORIGIN =
  runtimeConfig.chainOrigin ||
  process.env.EXPO_PUBLIC_CHAIN_ORIGIN ||
  process.env.CHAIN_ORIGIN ||
  RUNTIME_GATEWAY.gatewayOrigin;

export function isChainUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.host === CHAIN_HOST;
  } catch {
    return typeof urlStr === "string" && urlStr.includes(CHAIN_HOST);
  }
}
