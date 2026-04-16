/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { useEffect } from "react";
import { Image } from "react-native";

const imageColors = require("react-native-image-colors").default;
const getImageColors = imageColors.getColors;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Simple HEX -> HSL -> HEX conversion utilities.
function hexToHsl(hex) {
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  const rPerc = r / 255;
  const gPerc = g / 255;
  const bPerc = b / 255;

  const max = Math.max(rPerc, gPerc, bPerc);
  const min = Math.min(rPerc, gPerc, bPerc);
  let h;
  let s;
  const l = (max + min) / 2;

  if (max === min) {
    h = 0;
    s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rPerc:
        h = (gPerc - bPerc) / d + (gPerc < bPerc ? 6 : 0);
        break;
      case gPerc:
        h = (bPerc - rPerc) / d + 2;
        break;
      case bPerc:
        h = (rPerc - gPerc) / d + 4;
        break;
      default:
        h = 0;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToHex(h, s, l) {
  const safeS = clamp01(s);
  const safeL = clamp01(l);
  const safeH = ((h % 360) + 360) % 360;

  const c = (1 - Math.abs(2 * safeL - 1)) * safeS;
  const x = c * (1 - Math.abs(((safeH / 60) % 2) - 1));
  const m = safeL - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (safeH < 60) {
    r = c;
    g = x;
  } else if (safeH < 120) {
    r = x;
    g = c;
  } else if (safeH < 180) {
    g = c;
    b = x;
  } else if (safeH < 240) {
    g = x;
    b = c;
  } else if (safeH < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (v) => {
    const n = Math.round((v + m) * 255);
    return n.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Adjust luminance to a safe range.
function normalizeLightness(
  hex,
  { minL = 0.45, maxL = 0.85, targetL = 0.58 } = {}
) {
  const { h, s, l } = hexToHsl(hex);
  let nl = l;
  if (l < minL) nl = targetL;
  else if (l > maxL) nl = targetL;
  return hslToHex(h, s, nl);
}

// Ensure minimal saturation so it doesn't look too gray.
function ensureSaturation(hex, minS = 0.25) {
  const hsl = hexToHsl(hex);
  if (hsl.s < minS) hsl.s = minS;
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

function generateSecondaryFromMain(mainHex, shift = 120) {
  const { h, s, l } = hexToHsl(mainHex);
  return hslToHex(h + shift, s, l);
}

// Separate main/secondary lightness if too close.
function separateLightness(mainHex, secondaryHex, minDeltaL = 0.12) {
  const m = hexToHsl(mainHex);
  const s = hexToHsl(secondaryHex);
  if (Math.abs(m.l - s.l) < minDeltaL) {
    s.l =
      m.l > 0.5 ? Math.max(0, m.l - minDeltaL) : Math.min(1, m.l + minDeltaL);
  }
  return hslToHex(s.h, s.s, s.l);
}

const CardImageColorExtractor = ({
  cardImage,
  index,
  selectedCardIndex,
  onColorsChange,
}) => {
  useEffect(() => {
    let imageUri = null;
    if (cardImage) {
      if (typeof cardImage === "number") {
        const resolved = Image.resolveAssetSource(cardImage);
        imageUri = resolved?.uri;
      } else if (cardImage.uri) {
        imageUri = cardImage.uri;
      }
    }

    const isActiveSelected = selectedCardIndex === index;
    if (!imageUri || !isActiveSelected) {
      return;
    }

    getImageColors(imageUri, {
      fallback: "#ffffff",
      cache: true,
      key: imageUri,
    })
      .then((colors) => {
        let main = "#ffffff";
        let secondary = "#cccccc";

        if (colors.platform === "android" || colors.platform === "ios") {
          main = colors.background || colors.primary || "#ffffff";
        } else if (colors.platform === "web") {
          main = colors.lightVibrant || colors.dominant || "#ffffff";
        }

        main = normalizeLightness(main, {
          minL: 0.45,
          maxL: 0.85,
          targetL: 0.58,
        });
        main = ensureSaturation(main, 0.25);
        secondary = generateSecondaryFromMain(main, 15);
        secondary = ensureSaturation(secondary, 0.25);
        secondary = normalizeLightness(secondary, {
          minL: 0.35,
          maxL: 0.9,
          targetL: 0.5,
        });
        secondary = separateLightness(main, secondary, 0.12);

        onColorsChange?.(main, secondary);
      })
      .catch(() => {
        onColorsChange?.("#ffffff", "#cccccc");
      });
  }, [cardImage, selectedCardIndex, index, onColorsChange]);

  return null;
};

export default CardImageColorExtractor;
