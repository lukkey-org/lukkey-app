/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
/*
 * Project: Secure Systems
 * Author: Helvetiq Labs Team
 * Module: Core/AssetRouter
 * Description: Canonical mappings between virtual asset codes and references
 * License: MIT
 */

import { bleCmd, frameBle } from "../utils/bleProtocol";

// The chain name corresponding to each key
const chainMap = {
  BTC: "bitcoin",
  ETH: "ethereum",
  TRX: "tron",
  BCH: "bitcoin_cash",
  BNB: "binance",
  OP: "optimism",
  ETC: "ethereum_classic",
  LTC: "litecoin",
  XRP: "ripple",
  SOL: "solana",
  ARB: "arbitrum",
  AURORA: "aurora",
  AVAX: "avalanche",
  CELO: "celo",
  FTM: "fantom",
  HTX: "huobi",
  IOTX: "iote",
  // OKT: "okb", // OKB/OKX Chain support disabled.
  POL: "polygon",
  ZKSYNC: "zksync",
  APT: "aptos",
  SUI: "sui",
  COSMOS: "cosmos",
  Celestia: "celestia",
  Cronos: "cronos",
  // Juno: "juno", // Hidden for now; keep route mapping for possible restore.
  Osmosis: "osmosis",
  Gnosis: "gnosis",
  DOGE: "dogecoin",
};

// Generate assetRouteDefs: values ​​as JSON strings with \r\n added (compatible with older format usage)
const assetRouteDefs = {};
for (const [key, chain] of Object.entries(chainMap)) {
  assetRouteDefs[key] = bleCmd.verify(chain) + "\r\n";
}

export { chainMap };
export default assetRouteDefs;
