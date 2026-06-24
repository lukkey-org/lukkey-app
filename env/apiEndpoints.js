/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { CHAIN_ORIGIN } from "./chainConfig.js";
import { RUNTIME_GATEWAY, RUNTIME_GATEWAY_FLAGS } from "./runtimeGateway.js";
import { getRuntimeConfig } from "./runtimeConfig.js";

const runtimeConfig = getRuntimeConfig();
const apiPaths = runtimeConfig.apiPaths || {};

const marketOrigin = runtimeConfig.marketOrigin || RUNTIME_GATEWAY.marketOrigin;
const pushOrigin = runtimeConfig.pushOrigin || RUNTIME_GATEWAY.pushOrigin;
const siteOrigin = runtimeConfig.siteOrigin || RUNTIME_GATEWAY.siteOrigin;
const fileOrigin = runtimeConfig.fileOrigin || RUNTIME_GATEWAY.fileOrigin;
const tokenOrigin =
  runtimeConfig.tokenOrigin ||
  process.env.EXPO_PUBLIC_TOKEN_ORIGIN ||
  process.env.TOKEN_ORIGIN ||
  "";

const chainEnabled = Boolean(
  runtimeConfig.chainOrigin ||
    runtimeConfig.chainHost ||
    RUNTIME_GATEWAY_FLAGS.gatewayConfigured,
);
const marketEnabled = Boolean(
  runtimeConfig.marketOrigin ||
    runtimeConfig.marketHost ||
    RUNTIME_GATEWAY_FLAGS.marketConfigured,
);
const pushEnabled = Boolean(
  runtimeConfig.pushOrigin ||
    runtimeConfig.pushHost ||
    RUNTIME_GATEWAY_FLAGS.pushConfigured,
);
const siteEnabled = Boolean(
  runtimeConfig.siteOrigin ||
    runtimeConfig.siteHost ||
    runtimeConfig.aboutPage ||
    runtimeConfig.privacyPolicy ||
    RUNTIME_GATEWAY_FLAGS.siteConfigured,
);
const fileEnabled = Boolean(
  runtimeConfig.fileOrigin ||
    runtimeConfig.fileHost ||
    RUNTIME_GATEWAY_FLAGS.fileConfigured,
);
const tokenEnabled = Boolean(
  runtimeConfig.tokenOrigin ||
    runtimeConfig.tokenHost ||
    process.env.EXPO_PUBLIC_TOKEN_ORIGIN ||
    process.env.TOKEN_ORIGIN,
);

function isUsableRemoteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (raw.includes(".example.invalid")) return false;
  return /^https?:\/\//i.test(raw) || /^wss?:\/\//i.test(raw);
}

function normalizePath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function joinOrigin(origin, pathValue) {
  const base = String(origin || "").trim().replace(/\/$/, "");
  const path = String(pathValue || "").trim();
  if (!base || !path) return "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function getApiPath(key, envNames = []) {
  const runtimeValue = apiPaths?.[key];
  if (typeof runtimeValue === "string" && runtimeValue.trim()) {
    return runtimeValue.trim();
  }

  for (const envName of envNames) {
    const envValue = process.env?.[envName];
    if (typeof envValue === "string" && envValue.trim()) {
      return envValue.trim();
    }
  }

  return "";
}

const firmwareMd5Base =
  runtimeConfig.firmwareMd5Base ||
  process.env.EXPO_PUBLIC_FIRMWARE_MD5_BASE ||
  process.env.FIRMWARE_MD5_BASE ||
  joinOrigin(
    RUNTIME_GATEWAY.gatewayOrigin,
    getApiPath("firmware_lvglMd5Path", [
      "EXPO_PUBLIC_FIRMWARE_MD5_PATH",
      "FIRMWARE_MD5_PATH",
    ]),
  );

const firmwareListUrl =
  runtimeConfig.firmwareListUrl ||
  process.env.EXPO_PUBLIC_FIRMWARE_LIST_URL ||
  process.env.FIRMWARE_LIST_URL ||
  joinOrigin(
    siteOrigin,
    getApiPath("firmware_lvglListPath", [
      "EXPO_PUBLIC_FIRMWARE_LIST_PATH",
      "FIRMWARE_LIST_PATH",
    ]),
  );

const firmwareListHeaderName =
  runtimeConfig.firmwareListHeaderName ||
  process.env.EXPO_PUBLIC_FIRMWARE_LIST_HEADER_NAME ||
  process.env.FIRMWARE_LIST_HEADER_NAME ||
  "";

// These firmware auth values are app-bundled integration parameters when used
// in the mobile client. Do not place confidential backend-only secrets here.
const firmwareListToken =
  runtimeConfig.firmwareListToken ||
  process.env.EXPO_PUBLIC_FIRMWARE_LIST_TOKEN ||
  process.env.FIRMWARE_LIST_TOKEN ||
  "";

const firmwareMd5HeaderName =
  runtimeConfig.firmwareMd5HeaderName ||
  process.env.EXPO_PUBLIC_FIRMWARE_MD5_HEADER_NAME ||
  process.env.FIRMWARE_MD5_HEADER_NAME ||
  "x-app-token";

const firmwareMd5Token =
  runtimeConfig.firmwareMd5Token ||
  process.env.EXPO_PUBLIC_FIRMWARE_MD5_TOKEN ||
  process.env.FIRMWARE_MD5_TOKEN ||
  "";

const privacyPath = normalizePath(
  getApiPath("external_privacyPath", [
    "EXPO_PUBLIC_PRIVACY_PATH",
    "PRIVACY_PATH",
  ]),
);

export const accountAPI = {
  enabled: chainEnabled,
  queryTransaction: joinOrigin(
    CHAIN_ORIGIN,
    getApiPath("account_queryTransaction"),
  ),
  blockchainFee: joinOrigin(
    CHAIN_ORIGIN,
    getApiPath("account_blockchainFee"),
  ),
  balance: joinOrigin(CHAIN_ORIGIN, getApiPath("account_balance")),
  broadcastHex: joinOrigin(
    CHAIN_ORIGIN,
    getApiPath("account_broadcastHex"),
  ),
  getSignParam: joinOrigin(
    CHAIN_ORIGIN,
    getApiPath("account_getSignParam"),
  ),
  broadCaseOrders: joinOrigin(
    CHAIN_ORIGIN,
    getApiPath("account_broadCaseOrders"),
  ),
};

export const galleryAPI = {
  enabled: chainEnabled,
  queryNFTBalance: joinOrigin(
    CHAIN_ORIGIN,
    getApiPath("gallery_queryNFTBalance"),
  ),
  queryNFTDetails: joinOrigin(
    CHAIN_ORIGIN,
    getApiPath("gallery_queryNFTDetails"),
  ),
};

export const meridianAPI = {
  enabled: chainEnabled,
  queryBlockList: joinOrigin(
    CHAIN_ORIGIN,
    getApiPath("meridian_queryBlockList"),
  ),
};

export const signAPI = {
  enabled: chainEnabled,
  encode_btc: joinOrigin(CHAIN_ORIGIN, getApiPath("sign_encode_btc")),
  encode_evm: joinOrigin(CHAIN_ORIGIN, getApiPath("sign_encode_evm")),
  encode_aptos: joinOrigin(CHAIN_ORIGIN, getApiPath("sign_encode_aptos")),
  encode_cosmos: joinOrigin(CHAIN_ORIGIN, getApiPath("sign_encode_cosmos")),
  encode_solana: joinOrigin(CHAIN_ORIGIN, getApiPath("sign_encode_solana")),
  encode_sui: joinOrigin(CHAIN_ORIGIN, getApiPath("sign_encode_sui")),
  encode_xrp: joinOrigin(CHAIN_ORIGIN, getApiPath("sign_encode_xrp")),
  aptos_broadcast: joinOrigin(
    CHAIN_ORIGIN,
    getApiPath("sign_aptos_broadcast"),
  ),
  cosmos_broadcast: joinOrigin(
    CHAIN_ORIGIN,
    getApiPath("sign_cosmos_broadcast"),
  ),
  solana_broadcast: joinOrigin(
    CHAIN_ORIGIN,
    getApiPath("sign_solana_broadcast"),
  ),
  sui_broadcast: joinOrigin(CHAIN_ORIGIN, getApiPath("sign_sui_broadcast")),
};

export const pushAPI = {
  transactionsWS: joinOrigin(
    pushOrigin,
    getApiPath("push_transactionsWS", [
      "EXPO_PUBLIC_PUSH_TRANSACTIONS_PATH",
      "PUSH_TRANSACTIONS_PATH",
    ]),
  ),
  enabled: pushEnabled,
};

export const metricsAPII = {
  exchangeRate: joinOrigin(
    marketOrigin,
    getApiPath("metrics_exchangeRate"),
  ),
  indexTickers: joinOrigin(
    marketOrigin,
    getApiPath("metrics_indexTickers"),
  ),
  enabled: marketEnabled,
};

export const chartAPI = {
  indexCandles: joinOrigin(
    marketOrigin,
    getApiPath("chart_indexCandles"),
  ),
  enabled: marketEnabled,
};

export const tokenAPI = {
  addToken: joinOrigin(tokenOrigin, getApiPath("token_addToken")),
  enabled: tokenEnabled,
};

export const externalLinks = {
  privacyPolicy:
    runtimeConfig.privacyPolicy ||
    (privacyPath ? joinOrigin(siteOrigin, privacyPath) : ""),
  aboutPage: runtimeConfig.aboutPage || siteOrigin,
  privacyEnabled: isUsableRemoteUrl(
    runtimeConfig.privacyPolicy ||
      (privacyPath ? joinOrigin(siteOrigin, privacyPath) : ""),
  ),
  aboutEnabled: isUsableRemoteUrl(runtimeConfig.aboutPage || siteOrigin),
};

export const firmwareAPI = {
  lvglBase: joinOrigin(
    fileOrigin,
    getApiPath("firmware_lvglBasePath", [
      "EXPO_PUBLIC_FIRMWARE_BASE_PATH",
      "FIRMWARE_BASE_PATH",
    ]),
  ),
  lvglList: firmwareListUrl,
  lvglListHeaderName: firmwareListHeaderName,
  lvglListToken: firmwareListToken,
  lvglMd5Base: firmwareMd5Base,
  lvglMd5HeaderName: firmwareMd5HeaderName,
  lvglMd5Token: firmwareMd5Token,
  enabled: Boolean(siteEnabled && fileEnabled),
};

export async function getFirmwareMd5(fileName) {
  if (!firmwareAPI.lvglMd5Token) {
    throw new Error("FIRMWARE_MD5_TOKEN_MISSING");
  }

  if (!fileName || String(fileName).endsWith("/")) {
    throw new Error("key must be a concrete file name, for example lvgl/test.txt");
  }
  const trimmed = String(fileName).trim();

  const base = firmwareAPI.lvglMd5Base;
  const root = base.endsWith("key=lvgl") ? base.slice(0, -4) : base;
  const candidates = [];

  if (trimmed.includes("/")) {
    candidates.push(`${root}${encodeURIComponent(trimmed)}`);
  } else {
    candidates.push(`${base}/${encodeURIComponent(trimmed)}`);
    candidates.push(`${root}${encodeURIComponent(trimmed)}`);
  }

  let lastError = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          [firmwareAPI.lvglMd5HeaderName]: firmwareAPI.lvglMd5Token,
        },
      });

      let data = {};
      try {
        data = await res.json();
      } catch {}

      if (res.ok && data?.ok && data?.md5) {
        return data.md5;
      }
      lastError = new Error(data?.message || `HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error("MD5_FETCH_FAILED");
}
