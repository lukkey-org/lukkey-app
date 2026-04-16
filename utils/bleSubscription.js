/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { Platform } from "react-native";

export const createBleTransactionId = (prefix, deviceId) =>
  `${prefix}-${deviceId || "unknown"}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

export const safeRemoveSubscription = (subscription, options = {}) => {
  if (!subscription?.remove) return;
  const { label, skipAndroid = true } = options;
  if (skipAndroid && Platform?.OS === "android") {
    if (label) {
      console.log(`[ble] skip remove on Android: ${label}`);
    }
    return;
  }
  try {
    subscription.remove();
  } catch (error) {
    if (label) {
      console.log(
        `[ble] remove failed: ${label}`,
        error?.message || error
      );
    }
  }
};
