/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { prefixToShortName } from "./chainPrefixes";

export const getAssetDisplayName = (asset) =>
  String(asset?.displayName ?? asset?.name ?? "");

export const getAssetChainFullName = (asset) =>
  String(asset?.chainFullName ?? asset?.queryChainName ?? "");

export const getAssetSymbol = (asset) =>
  String(asset?.symbol ?? asset?.shortName ?? "");

export const getAssetType = (asset) =>
  String(asset?.type ?? asset?.coin_type ?? "");

export const getAssetChainShortName = (asset) => {
  const legacyShortName = String(asset?.queryChainShortName ?? "").trim();
  const chainFullName = String(
    asset?.chainFullName ?? asset?.queryChainName ?? "",
  )
    .trim()
    .toLowerCase();
  return chainFullName
    ? prefixToShortName[`${chainFullName}:`] || legacyShortName
    : legacyShortName;
};
