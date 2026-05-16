/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
export function formatScientific(value, fractionDigits = 4) {
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  const exp = Math.floor(Math.log10(abs));
  const mantissa = abs / Math.pow(10, exp);
  const trimmed = mantissa.toFixed(fractionDigits).replace(/\.?0+$/, "");
  const sign = value < 0 ? "-" : "";
  return `${sign}${trimmed}×10^${exp}`;
}

export function formatFiatBalanceDisplay(
  value,
  { compactLarge = false } = {},
) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0.00";
  if (compactLarge && Math.abs(num) >= 1e12) {
    return formatScientific(num, 4);
  }
  return num.toFixed(2);
}

export function formatCryptoBalanceDisplay(
  balance,
  { symbol = "", context = "CardItem", compactLarge = false } = {},
) {
  const num = Number(balance);
  if (!Number.isFinite(num)) {
    console.log(
      `[Vault][formatBalance] non-finite balance, using default value 0.00 -- symbol=${symbol}, context=${context}, raw=${balance}`,
    );
    return "0.00";
  }
  if (num === 0) return "0.00";
  if (compactLarge && Math.abs(num) >= 1e12) {
    return formatScientific(num, 4);
  }
  if (Number.isInteger(num)) return num.toFixed(2);
  const fractional = (num.toString().split(".")[1] || "").length;
  const decimalPlaces = Math.min(7, fractional || 2);
  return num.toFixed(decimalPlaces);
}

export function displayChainName(name) {
  const normalized = String(name || "").trim();
  if (!normalized) return "";

  const lower = normalized.toLowerCase();
  if (lower === "binance") return "BNB Chain";

  return normalized
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
