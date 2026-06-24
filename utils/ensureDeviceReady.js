/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { BleManager } from "react-native-ble-plx";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ensureDeviceReady = async ({
  device,
  devices,
  verifiedDevices,
  setBleVisible,
  openBleModal,
  bleManagerRef,
  connectTimeoutMs = 10000,
  requireSignal = true,
} = {}) => {
  const showBleModal = () => {
    try {
      if (typeof openBleModal === "function") {
        openBleModal();
      } else {
        setBleVisible && setBleVisible(true);
      }
    } catch {}
  };
  let effectiveVerifiedDevices = verifiedDevices;
  const manager = bleManagerRef?.current || new BleManager();
  if (!Array.isArray(effectiveVerifiedDevices) || effectiveVerifiedDevices.length === 0) {
    try {
      const saved = await AsyncStorage.getItem("verifiedDevices");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          effectiveVerifiedDevices = parsed;
        }
      }
    } catch {}
  }

  let targetDevice = device;
  const verifiedId =
    Array.isArray(effectiveVerifiedDevices) && effectiveVerifiedDevices.length > 0
      ? effectiveVerifiedDevices[0]
      : null;

  if (!targetDevice && verifiedId && Array.isArray(devices)) {
    try {
      targetDevice = devices.find((d) => d?.id === verifiedId) || null;
    } catch {
      targetDevice = null;
    }
  }

  if (!targetDevice && verifiedId) {
    try {
      const connected = await manager.connectToDevice(verifiedId, {
        timeout: connectTimeoutMs,
      });
      await connected.discoverAllServicesAndCharacteristics();
      targetDevice = connected;
    } catch (e) {
      console.log(
        "[DEVICE_PREFLIGHT] connect by id failed:",
        e?.message || e
      );
    }
  }

  const hasVerifiedSignal = (() => {
    if (!requireSignal) return true;
    if (!verifiedId || !Array.isArray(devices)) return false;
    const matched = devices.find((d) => d?.id === verifiedId) || null;
    return Number.isFinite(matched?.rssi);
  })();

  if (!targetDevice || typeof targetDevice.isConnected !== "function") {
    console.log(
      "[DEVICE_PREFLIGHT] invalid target device; show BluetoothModal"
    );
    showBleModal();
    return { ok: false, device: null, reason: "invalid-target-device" };
  }

  try {
    const connected = await targetDevice.isConnected();
    if (!connected) {
      try {
        bleManagerRef?.current?.stopDeviceScan?.();
      } catch {}
      if (verifiedId || targetDevice?.id) {
        const reconnectId = verifiedId || targetDevice?.id;
        const connectedDevice = await manager.connectToDevice(reconnectId, {
          timeout: connectTimeoutMs,
        });
        await connectedDevice.discoverAllServicesAndCharacteristics();
        targetDevice = connectedDevice;
      } else {
        await targetDevice.connect();
        await targetDevice.discoverAllServicesAndCharacteristics();
      }
    }
  } catch (e) {
    console.log(
      "[DEVICE_PREFLIGHT] ensure connected failed:",
      e?.message || e
    );
    console.log("[DEVICE_PREFLIGHT] connect/discover failed; show BluetoothModal");
    showBleModal();
    return { ok: false, device: null, reason: "connect-failed" };
  }
  return { ok: true, device: targetDevice };
};
