/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
const CRYPTO_ICON_MAP = {
  ARB: require("../assets/icon/ARBIcon.webp"),
  ETH: require("../assets/icon/ETHIcon.webp"),
  DAI: require("../assets/icon/DAIIcon.webp"),
  USDT: require("../assets/icon/USDTIcon.webp"),
  USDC: require("../assets/icon/USDCIcon.webp"),
  AURORA: require("../assets/icon/AURORAIcon.webp"),
  AVAX: require("../assets/icon/AVAXIcon.webp"),
  BTC: require("../assets/icon/BTCIcon.webp"),
  BCH: require("../assets/icon/BCHIcon.webp"),
  BNB: require("../assets/icon/BNBIcon.webp"),
  CELO: require("../assets/icon/CELOIcon.webp"),
  POL: require("../assets/icon/PolygonIcon.webp"),
  ETC: require("../assets/icon/ETCIcon.webp"),
  FTM: require("../assets/icon/FTMIcon.webp"),
  CRO: require("../assets/icon/CROIcon.webp"),
  IOTX: require("../assets/icon/IOTXIcon.webp"),
  LTC: require("../assets/icon/LTCIcon.webp"),
  OKT: require("../assets/icon/OKTIcon.webp"),
  OP: require("../assets/icon/OPIcon.webp"),
  XRP: require("../assets/icon/XRPIcon.webp"),
  SOL: require("../assets/icon/SOLIcon.webp"),
  TRX: require("../assets/icon/TRXIcon.webp"),
  ZKSYNC: require("../assets/icon/ZKSIcon.webp"),
  ATOM: require("../assets/icon/ATOMIcon.webp"),
  TIA: require("../assets/icon/TIAIcon.webp"),
  JUNO: require("../assets/icon/JUNOIcon.webp"),
  OSMO: require("../assets/icon/OSMOIcon.webp"),
  GNO: require("../assets/icon/GNOIcon.webp"),
  HTX: require("../assets/icon/HTIcon.webp"),
  LINEA: require("../assets/icon/LINEAIcon.webp"),
  RON: require("../assets/icon/RONIcon.webp"),
  APT: require("../assets/icon/APTIcon.webp"),
  SUI: require("../assets/icon/SUIIcon.webp"),
  DOGE: require("../assets/icon/DOGEIcon.webp"),
};

const CRYPTO_ICON_ALIASES = {
  ARETH: "ETH",
  OETH: "ETH",
  "USDT.E": "USDT",
  "USD₮0": "USDT",
  "USDC.E": "USDC",
  "BRIDGED USDC": "USDC",
  "USD COIN": "USDC",
  "USD COIN (BRIDGED FROM ETHEREUM)": "USDC",
  "TETHER USD": "USDT",
  TETHER: "USDT",
  "BITCOIN CASH": "BCH",
  "OPTIMISTIC ETHEREUM": "ETH",
  POLYGON: "POL",
  COSMOS: "ATOM",
  CELESTIA: "TIA",
  ZKS: "ZKSYNC",
  "ZKSYNC ERA": "ZKSYNC",
  DOG: "DOGE",
};

const CHAIN_ICON_MAP = {
  arbitrum: CRYPTO_ICON_MAP.ARB,
  aurora: CRYPTO_ICON_MAP.AURORA,
  avalanche: CRYPTO_ICON_MAP.AVAX,
  bitcoin: CRYPTO_ICON_MAP.BTC,
  bitcoin_cash: CRYPTO_ICON_MAP.BCH,
  binance: CRYPTO_ICON_MAP.BNB,
  celo: CRYPTO_ICON_MAP.CELO,
  ethereum: CRYPTO_ICON_MAP.ETH,
  polygon: CRYPTO_ICON_MAP.POL,
  ethereum_classic: CRYPTO_ICON_MAP.ETC,
  fantom: CRYPTO_ICON_MAP.FTM,
  cronos: CRYPTO_ICON_MAP.CRO,
  cryptoorg: CRYPTO_ICON_MAP.CRO,
  iotex: CRYPTO_ICON_MAP.IOTX,
  litecoin: CRYPTO_ICON_MAP.LTC,
  okb: CRYPTO_ICON_MAP.OKT,
  optimism: CRYPTO_ICON_MAP.OP,
  ripple: CRYPTO_ICON_MAP.XRP,
  solana: CRYPTO_ICON_MAP.SOL,
  tron: CRYPTO_ICON_MAP.TRX,
  zksync: CRYPTO_ICON_MAP.ZKSYNC,
  cosmos: CRYPTO_ICON_MAP.ATOM,
  celestia: CRYPTO_ICON_MAP.TIA,
  juno: CRYPTO_ICON_MAP.JUNO,
  osmosis: CRYPTO_ICON_MAP.OSMO,
  gnosis: CRYPTO_ICON_MAP.GNO,
  linea: CRYPTO_ICON_MAP.LINEA,
  ronin: CRYPTO_ICON_MAP.RON,
  aptos: CRYPTO_ICON_MAP.APT,
  sui: CRYPTO_ICON_MAP.SUI,
  dogecoin: CRYPTO_ICON_MAP.DOGE,
};

export function normalizeCryptoIconKey(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  return CRYPTO_ICON_ALIASES[raw] || raw;
}

export function resolveAssetIconByValue({
  shortName,
  name,
  queryChainName,
  queryChainShortName,
  fallbackIcon = null,
} = {}) {
  const candidates = [shortName, name, queryChainShortName, queryChainName];
  for (const candidate of candidates) {
    const key = normalizeCryptoIconKey(candidate);
    if (key && CRYPTO_ICON_MAP[key]) return CRYPTO_ICON_MAP[key];
  }
  return fallbackIcon;
}

export function resolveAssetIcon(asset) {
  return resolveAssetIconByValue({
    shortName: asset?.shortName,
    name: asset?.name,
    queryChainName: asset?.queryChainName,
    queryChainShortName: asset?.queryChainShortName,
  });
}

export function resolveChainIcon(value, fallbackIcon = null) {
  const key = String(value || "").trim().toLowerCase();
  return CHAIN_ICON_MAP[key] || fallbackIcon;
}
