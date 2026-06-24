/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import {
  getAssetChainFullName,
  getAssetSymbol,
  getAssetType,
} from "./assetFields";
import { prefixToShortName } from "./chainPrefixes";

const GAS_FEE_TOKEN_SYMBOL_OVERRIDES = {
  // OP chain handling fees should be paid by ETH system tokens to avoid being misled by incorrect asset type data.
  optimism: ["oeth", "eth"],
  // zkSync chain network fees are settled in ETH
  zksync: ["eth"],
};

export const resolveGasFeeSymbolForChain = (chainName, cards = []) => {
  const chainKey = String(chainName || "")
    .trim()
    .toLowerCase();
  if (!chainKey) return null;

  const list = Array.isArray(cards) ? cards : [];
  const inChain = list.filter(
    (c) =>
      String(getAssetChainFullName(c) || "")
        .trim()
        .toLowerCase() === chainKey,
  );

  const overrides = GAS_FEE_TOKEN_SYMBOL_OVERRIDES[chainKey] || [];
  for (const symbol of overrides) {
    const hit = inChain.find(
      (c) =>
        String(getAssetSymbol(c) || "")
          .trim()
          .toLowerCase() === symbol,
    );
    if (hit) {
      return String(getAssetSymbol(hit) || "")
        .trim()
        .toLowerCase();
    }
  }

  const nativeCard = inChain.find(
    (c) => String(getAssetType(c) || "").trim().toLowerCase() === "native",
  );
  if (nativeCard) {
    return String(getAssetSymbol(nativeCard) || "")
      .trim()
      .toLowerCase();
  }

  const configuredNativeSymbol = String(prefixToShortName[`${chainKey}:`] || "")
    .trim()
    .toLowerCase();
  if (configuredNativeSymbol) {
    const configuredNativeCard = inChain.find((c) => {
      const symbol = String(getAssetSymbol(c) || "")
        .trim()
        .toLowerCase();
      const contract = String(
        c?.contractAddress ||
          c?.contract_address ||
          c?.tokenContractAddress ||
          "",
      ).trim();
      return symbol === configuredNativeSymbol && !contract;
    });
    if (configuredNativeCard) {
      return String(getAssetSymbol(configuredNativeCard) || "")
        .trim()
        .toLowerCase();
    }
  }

  return null;
};
