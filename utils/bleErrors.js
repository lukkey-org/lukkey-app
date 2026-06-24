/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { BleErrorCode } from "react-native-ble-plx";

export const isBleDisconnectError = (error) => {
  if (!error) return false;
  const code = error.errorCode ?? error.code;
  if (code === BleErrorCode.DeviceDisconnected) return true;
  if (code === BleErrorCode.DeviceConnectionFailed) return true;
  if (code === BleErrorCode.OperationCancelled) return true;
  if (code === BleErrorCode.BluetoothPoweredOff) return true;
  const message = String(error.message || "").toLowerCase();
  return message.includes("disconnected") || message.includes("disconnect");
};
