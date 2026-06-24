/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { prefixToShortName } from "../config/chainPrefixes";
import {
  getAssetChainShortName,
  getAssetChainFullName,
  getAssetDisplayName,
  getAssetSymbol,
} from "../config/assetFields";
import { resolveAssetIcon, resolveChainIcon } from "./assetIconResolver";

export const ICON_MAP = {
  ETH: require("../assets/icon/ETHIcon.webp"),
  BTC: require("../assets/icon/BTCIcon.webp"),
  SOL: require("../assets/icon/SOLIcon.webp"),
  TRX: require("../assets/icon/TRXIcon.webp"),
  BNB: require("../assets/icon/BNBIcon.webp"),
  AVAX: require("../assets/icon/AVAXIcon.webp"),
  ARB: require("../assets/icon/ARBIcon.webp"),
  OP: require("../assets/icon/OPIcon.webp"),
  LTC: require("../assets/icon/LTCIcon.webp"),
  XRP: require("../assets/icon/XRPIcon.webp"),
  BCH: require("../assets/icon/BCHIcon.webp"),
  CELO: require("../assets/icon/CELOIcon.webp"),
  // FTM: require("../assets/icon/FTMIcon.webp"), // Fantom Opera migrated to Sonic and is no longer supported.
  IOTX: require("../assets/icon/IOTXIcon.webp"),
  // OKT: require("../assets/icon/OKTIcon.webp"), // OKB is no longer supported.
  POL: require("../assets/icon/PolygonIcon.webp"),
  LINEA: require("../assets/icon/LINEAIcon.webp"),
  RON: require("../assets/icon/RONIcon.webp"),
  AURORA: require("../assets/icon/AURORAIcon.webp"),
  DOVU: require("../assets/icon/DOVUIcon.webp"),
  WANNA: require("../assets/icon/WANNAIcon.webp"),
  ETC: require("../assets/icon/ETCIcon.webp"),
  TIA: require("../assets/icon/TIAIcon.webp"),
};

const LONG_TO_SHORT = {
  ethereum: "ETH",
  ethereum_classic: "ETC",
  arbitrum: "ARB",
  avalanche: "AVAX",
  aurora: "AURORA",
  gnosis: "GNO",
  cronos: "CRO",
  iotex: "IOTX",
  linea: "LINEA",
  // okb: "OKT", // OKB is no longer supported.
  optimism: "OP",
  polygon: "POL",
  zksync: "ZKSYNC",
  ronin: "RON",
  celo: "CELO",
  binance: "BNB",
  bitcoin: "BTC",
  bitcoin_cash: "BCH",
  litecoin: "LTC",
  dogecoin: "DOGE",
  tron: "TRX",
  solana: "SOL",
  ripple: "XRP",
  cosmos: "ATOM",
  celestia: "TIA",
  juno: "JUNO",
  osmosis: "OSMO",
  aptos: "APT",
  sui: "SUI",
};

export const normalizeIconSymbol = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (["ETH", "ARETH", "OETH"].includes(raw)) return "ETH";
  if (["USDT", "USD₮0"].includes(raw)) return "USDT";
  if (["USDC", "USDC.E"].includes(raw)) return "USDC";
  if (["DOG", "DOGE"].includes(raw)) return "DOGE";
  return raw;
};

export const buildAssetShortMap = (cryptos = []) => {
  const map = {};
  try {
    (cryptos || []).forEach((c) => {
      const qn = (getAssetChainFullName(c) || "").toLowerCase();
      const qsn = (getAssetChainShortName(c) || "").toUpperCase();
      if (qn && qsn) map[qn] = qsn;

      const qsnLower = (getAssetChainShortName(c) || "").toLowerCase();
      if (qsnLower && qsn) map[qsnLower] = qsn;

      const csnLower = (getAssetChainShortName(c) || "").toLowerCase();
      if (csnLower && qsn) map[csnLower] = qsn;

      const snLower = (getAssetSymbol(c) || "").toLowerCase();
      if (snLower && qsn) map[snLower] = qsn;
    });
  } catch {}
  return map;
};

export const normalizeChainIconKey = (chain, assetInfoShortMap = {}) => {
  if (!chain) return "ETH";
  const raw = String(chain).trim();
  const upper = raw.toUpperCase();
  if (ICON_MAP[upper]) return upper;

  const lowNoColon = raw.toLowerCase().replace(/:$/, "");
  const withColon = `${lowNoColon}:`;
  let short =
    prefixToShortName[withColon] ||
    prefixToShortName[lowNoColon] ||
    assetInfoShortMap[lowNoColon];

  if (!short) short = LONG_TO_SHORT[lowNoColon];
  if (short && ICON_MAP[short]) return short;
  return "ETH";
};

export const getChainFallbackIcon = (chain, assetInfoShortMap = {}) =>
  ICON_MAP[normalizeChainIconKey(chain, assetInfoShortMap)] || ICON_MAP.ETH;

export const findCryptoIconItem = (cryptos, chainNameLc, txSymbol) => {
  const norm = (v) => String(v || "").trim();
  const normalizedSymbol = normalizeIconSymbol(txSymbol);

  let cryptoItem =
    cryptos.find(
      (item) =>
        norm(getAssetChainFullName(item)).toLowerCase() === chainNameLc &&
        normalizeIconSymbol(getAssetDisplayName(item)) === normalizedSymbol,
    ) || null;
  let matchMethod = cryptoItem ? "chain+name" : null;

  if (!cryptoItem) {
    cryptoItem =
      cryptos.find(
        (item) =>
          norm(getAssetChainFullName(item)).toLowerCase() === chainNameLc &&
          normalizeIconSymbol(getAssetSymbol(item)) === normalizedSymbol,
      ) || null;
    if (cryptoItem) matchMethod = "chain+symbol";
  }

  if (!cryptoItem) {
    cryptoItem =
      cryptos.find(
        (item) =>
          normalizeIconSymbol(getAssetDisplayName(item)) === normalizedSymbol,
      ) || null;
    if (cryptoItem) matchMethod = "global+name";
  }

  if (!cryptoItem) {
    cryptoItem =
      cryptos.find(
        (item) => normalizeIconSymbol(getAssetSymbol(item)) === normalizedSymbol,
      ) || null;
    if (cryptoItem) matchMethod = "global+symbol";
  }

  return { cryptoItem, matchMethod, normalizedSymbol };
};

export const resolveTransactionIcons = ({
  cryptos = [],
  chain,
  symbol,
  unit,
  shortName,
}) => {
  const chainNameLc = String(chain || "").trim().toLowerCase();
  const symbolText = String(unit || symbol || shortName || "").trim();
  const assetInfoShortMap = buildAssetShortMap(cryptos);
  const chainCard = cryptos.find(
    (item) =>
      String(getAssetChainFullName(item) || "").trim().toLowerCase() ===
      chainNameLc,
  );
  const { cryptoItem, matchMethod, normalizedSymbol } = findCryptoIconItem(
    cryptos,
    chainNameLc,
    symbolText,
  );

  return {
    chainNameLc,
    normalizedSymbol,
    cryptoItem,
    cryptoMatchMethod: matchMethod,
    cryptoIcon: resolveAssetIcon(cryptoItem),
    chainIcon:
      resolveChainIcon(getAssetChainFullName(chainCard) || chain) ||
      getChainFallbackIcon(chain, assetInfoShortMap),
    chainMatched: Boolean(chainCard),
    cryptoMatched: Boolean(cryptoItem),
    assetInfoShortMap,
  };
};
