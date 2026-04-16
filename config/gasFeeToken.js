/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
const GAS_FEE_TOKEN_SYMBOL_OVERRIDES = {
  // OP chain handling fees should be paid by ETH system tokens to avoid being misled by incorrect coin_type data
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
      String(c?.queryChainName || "")
        .trim()
        .toLowerCase() === chainKey,
  );

  const overrides = GAS_FEE_TOKEN_SYMBOL_OVERRIDES[chainKey] || [];
  for (const symbol of overrides) {
    const hit = inChain.find(
      (c) =>
        String(c?.shortName || "")
          .trim()
          .toLowerCase() === symbol,
    );
    if (hit) {
      return String(hit.shortName || "")
        .trim()
        .toLowerCase();
    }
  }

  const nativeCard = inChain.find(
    (c) => String(c?.coin_type || "").trim().toLowerCase() === "native",
  );
  if (nativeCard) {
    return String(nativeCard.shortName || "")
      .trim()
      .toLowerCase();
  }

  return null;
};
