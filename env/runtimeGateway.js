/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
const DEFAULT_GATEWAY_HOST = "gateway.example.invalid";
const DEFAULT_MARKET_HOST = "market.example.invalid";
const DEFAULT_PUSH_HOST = "push.example.invalid";
const DEFAULT_SITE_HOST = "site.example.invalid";
const DEFAULT_FILE_HOST = "files.example.invalid";

function isPlaceholderHost(host) {
  return String(host || "").endsWith(".example.invalid");
}

function normalizeHttpOrigin(value, fallbackHost) {
  const raw = String(value || "").trim();
  if (!raw) return `https://${fallbackHost}`;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return `https://${raw.replace(/\/$/, "")}`;
}

function normalizeWsOrigin(value, fallbackHost) {
  const raw = String(value || "").trim();
  if (!raw) return `wss://${fallbackHost}`;
  if (/^wss?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return `wss://${raw.replace(/\/$/, "")}`;
}

const gatewayOrigin = normalizeHttpOrigin(
  process.env.EXPO_PUBLIC_GATEWAY_ORIGIN || process.env.GATEWAY_ORIGIN,
  DEFAULT_GATEWAY_HOST,
);

const marketOrigin = normalizeHttpOrigin(
  process.env.EXPO_PUBLIC_MARKET_ORIGIN || process.env.MARKET_ORIGIN,
  DEFAULT_MARKET_HOST,
);

const pushOrigin = normalizeWsOrigin(
  process.env.EXPO_PUBLIC_PUSH_ORIGIN || process.env.PUSH_ORIGIN,
  DEFAULT_PUSH_HOST,
);

const siteOrigin = normalizeHttpOrigin(
  process.env.EXPO_PUBLIC_SITE_ORIGIN || process.env.SITE_ORIGIN,
  DEFAULT_SITE_HOST,
);

const fileOrigin = normalizeHttpOrigin(
  process.env.EXPO_PUBLIC_FILE_ORIGIN || process.env.FILE_ORIGIN,
  DEFAULT_FILE_HOST,
);

export const RUNTIME_GATEWAY = {
  gatewayOrigin,
  marketOrigin,
  pushOrigin,
  siteOrigin,
  fileOrigin,
  gatewayHost: new URL(gatewayOrigin).host,
  marketHost: new URL(marketOrigin).host,
  pushHost: new URL(pushOrigin).host,
  siteHost: new URL(siteOrigin).host,
  fileHost: new URL(fileOrigin).host,
};

export const RUNTIME_GATEWAY_FLAGS = {
  gatewayConfigured: !isPlaceholderHost(RUNTIME_GATEWAY.gatewayHost),
  marketConfigured: !isPlaceholderHost(RUNTIME_GATEWAY.marketHost),
  pushConfigured: !isPlaceholderHost(RUNTIME_GATEWAY.pushHost),
  siteConfigured: !isPlaceholderHost(RUNTIME_GATEWAY.siteHost),
  fileConfigured: !isPlaceholderHost(RUNTIME_GATEWAY.fileHost),
};
