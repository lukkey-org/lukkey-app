/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Disconnect device and update status (generic)
 * @param {Object} params
 * @param {Object} params.device - device object, requires cancelConnection method and id attribute
 * @param {Array} params.verifiedDevices - Array of currently verified device IDs
 * @param {Function} params.setVerifiedDevices - setState of the array of verified device IDs
 * @param {Function} params.setIsVerificationSuccessful - setState to set the verification status
 * @returns {Promise<void>}
 */
export async function handleDisconnectDevice({
  device,
  verifiedDevices,
  setVerifiedDevices,
  setIsVerificationSuccessful,
  // Optional: Pass in monitorVerificationCode to unsubscribe before disconnecting
  monitorVerificationCode,
}) {
  try {
    // Unsubscribe first and then disconnect Bluetooth
    try {
      monitorVerificationCode?.cancel?.();
    } catch {}
    await device.cancelConnection();
    console.log(`equipment ${device.id} Disconnected`);

    // Remove the ID of a verified device
    const updatedVerifiedDevices = verifiedDevices.filter(
      (id) => id !== device.id
    );
    setVerifiedDevices(updatedVerifiedDevices);
    await AsyncStorage.setItem(
      "verifiedDevices",
      JSON.stringify(updatedVerifiedDevices)
    );
    console.log(`equipment ${device.id} Removed from verified devices`);

    // Update the global status to indicate that the device is no longer successfully verified
    setIsVerificationSuccessful(false);
    console.log("Verification status updated to false.");
  } catch (error) {
    console.log("Failed to disconnect device:", error);
  }
}

/**
 * Vault-specific handleDisconnectDevice, parameter names are compatible
 * @param {Object} params
 * @param {Object} params.device - device object
 * @param {Array} params.verifiedDevices
 * @param {Function} params.setVerifiedDevices
 * @param {Function} params.setIsVerificationSuccessful
 * @returns {Promise<void>}
 */
export async function handleDisconnectDeviceForVault(params) {
  // Compatible parameter names, directly reused
  return handleDisconnectDevice(params);
}
