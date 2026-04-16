/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { enrichBchAddressData } from "./bchAddress";
import { enrichBtcAddressData } from "./btcAddress";

export function getRuntimeBalance(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : "0.0";
}

export function getRuntimePriceUsd(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : "0.0";
}

export function getRuntimeEstimatedValue(value) {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : "0.0";
}

export function stripRuntimeAssetMetrics(item) {
  if (!item || typeof item !== "object") return item;
  const { balance, priceUsd, EstimatedValue, ...rest } = item;
  return rest;
}

export function ensureCryptoCardRuntimeFields(item) {
  if (!item || typeof item !== "object") return item;
  const withMetrics = {
    ...item,
    balance: getRuntimeBalance(item.balance),
    priceUsd: getRuntimePriceUsd(item.priceUsd),
    EstimatedValue: getRuntimeEstimatedValue(item.EstimatedValue),
  };
  return enrichBtcAddressData(
    enrichBchAddressData(withMetrics, item?.bchAddressType),
    item?.btcAddressType,
  );
}
