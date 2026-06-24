/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { resolveMarketSymbol } from "../config/priceSymbolAlias";
import { getRuntimePriceUsd } from "./assetRuntimeFields";

export function resolveAssetPriceUsd({
  card,
  symbol,
  chain,
  exchangeRates,
  priceChanges,
}) {
  const runtimePrice = Number(getRuntimePriceUsd(card?.priceUsd));
  if (Number.isFinite(runtimePrice) && runtimePrice > 0) {
    return runtimePrice;
  }

  const rawSymbol = String(symbol ?? card?.symbol ?? card?.shortName ?? "")
    .trim()
    .toUpperCase();
  const marketSymbol = resolveMarketSymbol(rawSymbol, chain ?? card?.chainFullName);

  const priceFromTicker = Number(
    priceChanges?.[rawSymbol]?.priceChange ??
      priceChanges?.[marketSymbol]?.priceChange ??
      0,
  );
  if (Number.isFinite(priceFromTicker) && priceFromTicker > 0) {
    return priceFromTicker;
  }

  const priceFromRates = Number(
    exchangeRates?.[rawSymbol] ?? exchangeRates?.[marketSymbol] ?? 0,
  );
  if (Number.isFinite(priceFromRates) && priceFromRates > 0) {
    return priceFromRates;
  }

  return 0;
}
