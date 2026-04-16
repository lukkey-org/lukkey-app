/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { getRuntimeConfig } from "./runtimeConfig.js";

const runtimeConfig = getRuntimeConfig();

export const bluetoothConfig = {
  serviceUUID:
    runtimeConfig.bleServiceUUID ||
    process.env.EXPO_PUBLIC_BLE_SERVICE_UUID ||
    "6E400001-B5A3-F393-E0A9-E50E24DCCA9E",
  writeCharacteristicUUID:
    runtimeConfig.bleWriteCharacteristicUUID ||
    process.env.EXPO_PUBLIC_BLE_WRITE_CHARACTERISTIC_UUID ||
    "6E400002-B5A3-F393-E0A9-E50E24DCCA9E",
  notifyCharacteristicUUID:
    runtimeConfig.bleNotifyCharacteristicUUID ||
    process.env.EXPO_PUBLIC_BLE_NOTIFY_CHARACTERISTIC_UUID ||
    "6E400003-B5A3-F393-E0A9-E50E24DCCA9E",
};
