/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
const PRICE_SYMBOL_ALIAS_BY_CHAIN = {
  arbitrum: {
    areth: "eth",
    "usdc.e": "usdc",
  },
  optimism: {
    oeth: "eth",
    "usdc.e": "usdc",
  },
};

export const resolveMarketSymbol = (shortName, queryChainName) => {
  const symbol = String(shortName || "")
    .trim()
    .toLowerCase();
  const chain = String(queryChainName || "")
    .trim()
    .toLowerCase();
  if (!symbol) return "";
  const chainMap = PRICE_SYMBOL_ALIAS_BY_CHAIN[chain];
  const mapped = chainMap?.[symbol] || symbol;
  return mapped.toUpperCase();
};
