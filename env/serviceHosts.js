/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { RUNTIME_GATEWAY } from "./runtimeGateway.js";
import { getRuntimeConfig } from "./runtimeConfig.js";

const runtimeConfig = getRuntimeConfig();

export const SERVICE_HOSTS = {
  market: runtimeConfig.marketHost ||
    runtimeConfig.serviceHosts?.market ||
    process.env.EXPO_PUBLIC_MARKET_HOST ||
    process.env.MARKET_HOST ||
    RUNTIME_GATEWAY.marketHost,
  chain: runtimeConfig.chainHost ||
    runtimeConfig.serviceHosts?.chain ||
    process.env.EXPO_PUBLIC_CHAIN_HOST ||
    process.env.CHAIN_HOST ||
    RUNTIME_GATEWAY.gatewayHost,
  file: runtimeConfig.fileHost ||
    runtimeConfig.serviceHosts?.file ||
    process.env.EXPO_PUBLIC_FILE_HOST ||
    process.env.FILE_HOST ||
    RUNTIME_GATEWAY.fileHost,
};
