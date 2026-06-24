/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
/**
 * Generic Bluetooth pairing handler function
 * - Android 12+ uses "Nearby devices" permission (SCAN/CONNECT)
 * - Android 10-11 and below: Positioning permissions are no longer involved (this project has completely removed positioning-related capabilities)
 * - No runtime permissions required for iOS
 */
import checkAndReqPermission from "./BluetoothPermissions";

export async function handleBluetoothPairing({
  t,
  scanDevices,
  isScanning,
  setIsScanning,
  bleManagerRef,
  setDevices,
  setBleVisible,
  openExclusiveModal,
  Platform,
}) {
  if (!Platform) {
    Platform = require("react-native").Platform;
  }

  if (Platform.OS === "android") {
    const ok = await checkAndReqPermission();
    if (!ok) {
      console.log("Android BLE permissions denied");
      return;
    }
  }

  // iOS or Android permissions in place, start scanning
  scanDevices({ isScanning, setIsScanning, bleManagerRef, setDevices });
  if (typeof openExclusiveModal === "function") {
    openExclusiveModal(() => setBleVisible(true));
  } else {
    setBleVisible(true);
  }
}
