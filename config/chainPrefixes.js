/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// config/chainPrefixes.js

// ==========================
// Mapping: prefix -> shortName
// ==========================

export const prefixToShortName = {
  "ethereum:": "ETH", // Ethereum
  "bitcoincash:": "BCH", // Standard Bitcoin Cash CashAddr prefix
  "bitcoin_cash:": "BCH", // Bitcoin Cash
  "optimism:": "OP", // Optimism
  "ethereum_classic:": "ETC", // Ethereum Classic
  "litecoin:": "LTC", // Litecoin
  "ripple:": "XRP", // Ripple
  "solana:": "SOL", // Solana
  "arbitrum:": "ARB", // Arbitrum
  "binance:": "BNB", // binance
  "aurora:": "AURORA", // Aurora
  "avalanche:": "AVAX", // Avalanche
  "bitcoin:": "BTC", // Bitcoin
  "dogecoin:": "DOGE", // Dogecoin
  "celo:": "CELO", // Celo
  "fantom:": "FTM", // Fantom
  "huobi:": "HTX", // Huobi Token
  "iotex:": "IOTX", // IoTeX
  // "okb:": "OKT", // OKB is no longer supported.
  "polygon:": "POL", // Polygon
  "tron:": "TRX", // Tron
  "zksync:": "ZKSYNC", // zkSync Era
  "cosmos:": "ATOM", // Cosmos
  "celestia:": "CEL", // Celestia
  "cronos:": "CRO", // Cronos
  // "juno:": "JUNO", // Juno hidden for now
  "osmosis:": "OSMO", // Osmosis
  "gnosis:": "GNO", // Gnosis
  "linea:": "LINEA", // Linea
  "ronin:": "RON", // Ronin
  "aptos:": "APT", // Aptos
  "sui:": "SUI", // SUI
};

export const ADDRESS_SYNC_FORMATS_BY_CHAIN = {
  bitcoin: [
    { addrFormat: "legacy", syncKey: "BTC_LEGACY" },
    { addrFormat: "nested_segwit", syncKey: "BTC_NESTED_SEGWIT" },
    { addrFormat: "native_segwit", syncKey: "BTC_NATIVE_SEGWIT" },
    { addrFormat: "taproot", syncKey: "BTC_TAPROOT" },
  ],
  bitcoin_cash: [
    { addrFormat: "cashaddr", syncKey: "BCH_CASHADDR" },
    { addrFormat: "legacy", syncKey: "BCH_LEGACY" },
  ],
  litecoin: [
    { addrFormat: "legacy", syncKey: "LTC_LEGACY" },
    { addrFormat: "nested_segwit", syncKey: "LTC_NESTED_SEGWIT" },
    { addrFormat: "native_segwit", syncKey: "LTC_NATIVE_SEGWIT" },
  ],
};

export const normalizeAddressSyncChainName = (chainName) => {
  const normalized = String(chainName || "").trim().toLowerCase();
  if (normalized === "bitcoincash") return "bitcoin_cash";
  return normalized;
};

export const getAddressSyncRequests = (prefixMap = prefixToShortName) => {
  const requests = [];
  const seen = new Set();
  for (const prefix of Object.keys(prefixMap || {})) {
    const chainName = normalizeAddressSyncChainName(prefix.replace(":", ""));
    const shortName = prefixMap[prefix];
    const formats = ADDRESS_SYNC_FORMATS_BY_CHAIN[chainName];
    if (Array.isArray(formats)) {
      for (const format of formats) {
        const requestKey = `${format.syncKey}:${chainName}:${format.addrFormat}`;
        if (seen.has(requestKey)) continue;
        seen.add(requestKey);
        requests.push({
          chainName,
          shortName,
          addrFormat: format.addrFormat,
          syncKey: format.syncKey,
        });
      }
      continue;
    }
    const requestKey = `${shortName}:${chainName}`;
    if (seen.has(requestKey)) continue;
    seen.add(requestKey);
    requests.push({ chainName, shortName, addrFormat: "", syncKey: shortName });
  }
  return requests;
};

export const getAddressSyncKeys = (prefixMap = prefixToShortName) =>
  getAddressSyncRequests(prefixMap).map((request) => request.syncKey);
