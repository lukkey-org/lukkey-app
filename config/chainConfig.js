/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { RUNTIME_DEV } from "../utils/runtimeFlags";

const hiddenInProductionChainNames = new Set(["TIA", "GNO", "JUNO", "LINEA"]);

const configuredChainNames = [
  "ETH",
  "BCH",
  "OP",
  "ETC",
  "LTC",
  "XRP",
  "SOL",
  "ARB",
  "BNB",
  "AURORA",
  "AVAX",
  "BTC",
  "CELO",
  // "FTM", // Fantom Opera migrated to Sonic and is no longer supported.
  "IOTX",
  // "OKT", // OKB is no longer supported.
  "POL",
  "TRX",
  "ZKSYNC",
  "ATOM",
  "TIA",
  "CRO",
  // "JUNO", // Hidden for now; keep config for possible future re-enable.
  "OSMO",
  "GNO",
  "LINEA",
  "RON",
  "APT",
  "SUI",
  "DOGE",
];

export const CHAIN_NAMES = configuredChainNames.filter(
  (chainName) => RUNTIME_DEV || !hiddenInProductionChainNames.has(chainName),
);
