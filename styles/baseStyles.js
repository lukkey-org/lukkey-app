/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { RADIUS_16, RADIUS_20, RADIUS_30 } from "./constants";

// Universal button basic style
export const buttonBase = {
  padding: 10,
  width: "100%", // Override where 90% width is needed
  justifyContent: "center",
  borderRadius: RADIUS_16,
  height: 60,
  alignItems: "center",
};

// Common modal panel basic style
export const modalPanelBase = {
  margin: 20,
  width: "90%",
  borderRadius: 36,
  padding: 20,
  alignItems: "center",
};

// Universal title basic style
export const titleBase = {
  fontSize: 20,
  fontWeight: "bold",
};

// Universal centered gray text (requires colors/mutedText)
export const textCenterMuted = (colors) => ({
  fontSize: 15,
  color: colors.mutedText,
  textAlign: "center",
});

// Card basic style
export const cardBase = {
  borderRadius: 26,
  overflow: "hidden",
  justifyContent: "center",
  alignItems: "center",
  marginBottom: 20,
};

// Icon basic style
export const iconBase = {
  resizeMode: "contain",
  alignItems: "center",
  justifyContent: "center",
};

// Container basic style
export const containerBase = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
};

// Pop-up window header basic style
export const modalHeaderBase = {
  width: "100%",
  flexDirection: "row",
  justifyContent: "flex-end",
  alignItems: "center",
};

// Basic style of button with border
export const borderButtonBase = {
  borderWidth: 1,
  justifyContent: "center",
  alignItems: "center",
  height: 60,
  borderRadius: RADIUS_16,
  padding: 10,
};

export const cardShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 4,
  elevation: 2,
};

// Universal image placeholder (NFT/Gallery without image, etc.)
export const noImageContainer = {
  width: "100%",
  aspectRatio: 1,
  borderRadius: 8,
  backgroundColor: "#ccc",
  justifyContent: "center",
  alignItems: "center",
  overflow: "hidden",
  position: "relative",
};
export const noImageLogo = {
  position: "absolute",
  width: "50%",
  height: "50%",
  opacity: 0.2,
  resizeMode: "contain",
  top: "25%",
  left: "25%",
};
export const noImageText = {
  color: "#eee",
  fontWeight: "bold",
  position: "absolute",
  fontSize: 12,
  textAlign: "center",
};
