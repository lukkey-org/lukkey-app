/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { Image } from "react-native";
import { iconToCardImageEntries } from "./cardImageMap";
import { resolveAssetIcon } from "./assetIconResolver";

const iconToCardImageMap = new Map();
const iconUriToCardImageMap = new Map();

for (const [icon, cardImage] of iconToCardImageEntries) {
  if (!icon || !cardImage) continue;
  if (!iconToCardImageMap.has(icon)) {
    iconToCardImageMap.set(icon, cardImage);
  }
  try {
    const resolvedIcon = Image.resolveAssetSource(icon);
    const iconUri = resolvedIcon?.uri;
    if (iconUri && !iconUriToCardImageMap.has(iconUri)) {
      iconUriToCardImageMap.set(iconUri, cardImage);
    }
  } catch {}
}

export function resolveCardImageByIcon(icon, fallbackCardImage = null) {
  if (!icon) return fallbackCardImage;
  if (iconToCardImageMap.has(icon)) {
    return iconToCardImageMap.get(icon);
  }
  try {
    const resolvedIcon = Image.resolveAssetSource(icon);
    const iconUri = resolvedIcon?.uri;
    if (iconUri && iconUriToCardImageMap.has(iconUri)) {
      return iconUriToCardImageMap.get(iconUri);
    }
  } catch {}
  return fallbackCardImage;
}

export function resolveCardImage(asset) {
  return resolveCardImageByIcon(
    resolveAssetIcon(asset),
    asset?.cardImage || null,
  );
}
