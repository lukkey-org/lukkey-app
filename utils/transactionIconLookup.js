/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { prefixToShortName } from "../config/chainPrefixes";
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
  FTM: require("../assets/icon/FTMIcon.webp"),
  IOTX: require("../assets/icon/IOTXIcon.webp"),
  OKT: require("../assets/icon/OKTIcon.webp"),
  POL: require("../assets/icon/PolygonIcon.webp"),
  LINEA: require("../assets/icon/LINEAIcon.webp"),
  RON: require("../assets/icon/RONIcon.webp"),
  AURORA: require("../assets/icon/AURORAIcon.webp"),
  ETC: require("../assets/icon/ETCIcon.webp"),
};

const LONG_TO_SHORT = {
  ethereum: "ETH",
  ethereum_classic: "ETC",
  arbitrum: "ARB",
  avalanche: "AVAX",
  aurora: "AURORA",
  fantom: "FTM",
  gnosis: "GNO",
  cronos: "CRO",
  iotex: "IOTX",
  linea: "LINEA",
  okb: "OKT",
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
  celestia: "CEL",
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
      const qn = (c.queryChainName || "").toLowerCase();
      const qsn = (c.queryChainShortName || "").toUpperCase();
      if (qn && qsn) map[qn] = qsn;

      const qsnLower = (c.queryChainShortName || "").toLowerCase();
      if (qsnLower && qsn) map[qsnLower] = qsn;

      const csnLower = (c.queryChainShortName || "").toLowerCase();
      if (csnLower && qsn) map[csnLower] = qsn;

      const snLower = (c.shortName || "").toLowerCase();
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
        norm(item.queryChainName).toLowerCase() === chainNameLc &&
        normalizeIconSymbol(item.name) === normalizedSymbol,
    ) || null;
  let matchMethod = cryptoItem ? "chain+name" : null;

  if (!cryptoItem) {
    cryptoItem =
      cryptos.find(
        (item) =>
          norm(item.queryChainName).toLowerCase() === chainNameLc &&
          normalizeIconSymbol(item.shortName) === normalizedSymbol,
      ) || null;
    if (cryptoItem) matchMethod = "chain+shortName";
  }

  if (!cryptoItem) {
    cryptoItem =
      cryptos.find(
        (item) => normalizeIconSymbol(item.name) === normalizedSymbol,
      ) || null;
    if (cryptoItem) matchMethod = "global+name";
  }

  if (!cryptoItem) {
    cryptoItem =
      cryptos.find(
        (item) => normalizeIconSymbol(item.shortName) === normalizedSymbol,
      ) || null;
    if (cryptoItem) matchMethod = "global+shortName";
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
      String(item.queryChainName || "").trim().toLowerCase() === chainNameLc,
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
      resolveChainIcon(chainCard?.queryChainName || chain) ||
      getChainFallbackIcon(chain, assetInfoShortMap),
    chainMatched: Boolean(chainCard),
    cryptoMatched: Boolean(cryptoItem),
    assetInfoShortMap,
  };
};
