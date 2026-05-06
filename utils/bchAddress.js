/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import {
  BCH_ADDRESS_TYPES,
  deriveBchAddressFormats,
  isBchCashAddr,
  isBchLegacyAddress,
  isBchChainName,
  normalizeAddressInput,
  normalizeBchAddressType,
  resolveBchAddressByType,
} from "../config/networkUtils.js";

const BCH_BALANCE_FIELD_BY_TYPE = {
  [BCH_ADDRESS_TYPES.CASHADDR]: "bchCashaddrBalance",
  [BCH_ADDRESS_TYPES.LEGACY]: "bchLegacyBalance",
};

export const getBchAddressType = (address) => {
  if (isBchLegacyAddress(address)) return BCH_ADDRESS_TYPES.LEGACY;
  if (isBchCashAddr(address)) return BCH_ADDRESS_TYPES.CASHADDR;
  return "";
};

export const isBchCard = (card) =>
  isBchChainName(card?.queryChainName || card?.queryChainShortName);

export const enrichBchAddressData = (card, preferredType = "") => {
  if (!card || typeof card !== "object") return card;
  if (!isBchCard(card)) return card;

  const rawAddress = normalizeAddressInput(card?.address);
  const hintedCash = normalizeAddressInput(card?.bchCashAddr);
  const hintedLegacy = normalizeAddressInput(card?.bchLegacyAddr);

  const fromAddress = deriveBchAddressFormats(rawAddress);
  const fromCash = deriveBchAddressFormats(hintedCash);
  const fromLegacy = deriveBchAddressFormats(hintedLegacy);

  const bchCashAddr = fromAddress.cashaddr || fromCash.cashaddr || fromLegacy.cashaddr || "";
  const bchLegacyAddr = fromAddress.legacy || fromCash.legacy || fromLegacy.legacy || "";

  const nextType = normalizeBchAddressType(
    preferredType ||
      card?.bchAddressType ||
      BCH_ADDRESS_TYPES.CASHADDR,
  );
  const address = resolveBchAddressByType(
    nextType,
    rawAddress,
    bchCashAddr,
    bchLegacyAddr,
  );

  const typedBalance =
    card?.bchAddressBalances?.[nextType] ??
    card?.[BCH_BALANCE_FIELD_BY_TYPE[nextType]];

  const nextCard = {
    ...card,
    bchAddressType: nextType,
    bchCashAddr,
    bchLegacyAddr,
    address,
  };
  if (typedBalance !== undefined && typedBalance !== null) {
    const nextBalance = String(typedBalance);
    nextCard.balance = nextBalance;
    const priceUsd = Number(card?.priceUsd ?? 0);
    const balanceNumber = Number(nextBalance);
    if (Number.isFinite(priceUsd) && priceUsd > 0 && Number.isFinite(balanceNumber)) {
      nextCard.EstimatedValue = (balanceNumber * priceUsd).toFixed(2);
    }
  }
  return nextCard;
};

export const switchBchAddressTypeForCard = (card, nextType) =>
  enrichBchAddressData(card, normalizeBchAddressType(nextType));

export const getBchAddressByTypeFromCard = (card, nextType) => {
  if (!card || !isBchCard(card)) return normalizeAddressInput(card?.address);
  const normalized = enrichBchAddressData(card, card?.bchAddressType);
  return resolveBchAddressByType(
    nextType,
    normalized?.address,
    normalized?.bchCashAddr,
    normalized?.bchLegacyAddr,
  );
};

export const getBchQueryAddressesFromCard = (card) => {
  if (!card || !isBchCard(card)) {
    const address = normalizeAddressInput(card?.address);
    return address ? [address] : [];
  }

  const normalized = enrichBchAddressData(card, card?.bchAddressType);
  const out = [];
  const pushAddress = (value) => {
    const address = normalizeAddressInput(value);
    if (!address) return;
    if (!out.includes(address)) {
      out.push(address);
    }
  };

  pushAddress(normalized?.address);
  pushAddress(normalized?.bchCashAddr);
  pushAddress(normalized?.bchLegacyAddr);

  return out;
};
