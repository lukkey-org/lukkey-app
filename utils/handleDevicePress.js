/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import checkAndReqPermission from "./BluetoothPermissions";
import { bleCmd, frameBle, buildAuthVerifyText } from "./bleProtocol";

export function createHandleDevicePress({
  setReceivedAddresses,
  setReceivedPubKeys,
  setVerificationStatus,
  setSelectedDevice,
  setBleVisible,
  monitorVerificationCode,
  setSecurityCodeModalVisible,
  serviceUUID,
  writeCharacteristicUUID,
  Buffer,
  setReceivedVerificationCode,
  setPinCode,
  setPinErrorMessage,
  bleManagerRef,
  openExclusiveModal,
}) {
  return async function handleDevicePress(device) {
    try {
      setReceivedVerificationCode && setReceivedVerificationCode("");
      setPinCode && setPinCode("");
      setPinErrorMessage && setPinErrorMessage("");
    } catch {}
    setReceivedAddresses({});
    setReceivedPubKeys && setReceivedPubKeys({});
    setVerificationStatus(null);
    setSelectedDevice(device);
    setBleVisible(false);

    let dev = device;
    try {
      if (!dev || typeof dev.connect !== "function") {
        const manager = bleManagerRef?.current;
        if (manager && device?.id) {
          try {
            const list = await manager.devices([device.id]);
            if (Array.isArray(list) && list[0]) {
              dev = list[0];
            }
          } catch {}
          if (!dev || typeof dev.connect !== "function") {
            try {
              const conns = await manager.connectedDevices([serviceUUID]);
              const found = (conns || []).find((d) => d.id === device.id);
              if (found) dev = found;
            } catch {}
          }
        }
      }
    } catch {}
    if (dev && dev !== device) {
      try {
        setSelectedDevice(dev);
      } catch {}
    }
    let permissionsGranted = true;
    try {
      permissionsGranted = await checkAndReqPermission();
    } catch (e) {
      console.log("Permission check error:", e);
      permissionsGranted = false;
    }
    if (!permissionsGranted) {
      console.log("Bluetooth permission not granted, aborting connection.");
      return;
    }

    // Connection and service discovery catch exceptions separately
    try {
      try {
        await dev.connect();
        await dev.discoverAllServicesAndCharacteristics();
      } catch (error) {
        console.log("Error connecting or discovering services:", error);
        if (error && typeof error === "object") {
          console.log(
            "Error details:",
            "message:",
            error.message,
            "reason:",
            error.reason,
            "code:",
            error.code,
            "stack:",
            error.stack
          );
        }
        return;
      }

      const sendparseDeviceCodeedValue = async (parseDeviceCodeedValue) => {
        try {
          const message = buildAuthVerifyText(parseDeviceCodeedValue);
          const bufferMessage = Buffer.from(message, "utf-8");
          const base64Message = bufferMessage.toString("base64");
          await dev.writeCharacteristicWithResponseForService(
            serviceUUID,
            writeCharacteristicUUID,
            base64Message
          );
        } catch (error) {
          console.log("Error sending parseDeviceCodeed value:", error);
        }
      };

      monitorVerificationCode(dev, sendparseDeviceCodeedValue);

      setTimeout(async () => {
        try {
          const requestString = bleCmd.authRequest() + "\r\n";
          const bufferRequestString = Buffer.from(requestString, "utf-8");
          const base64requestString = bufferRequestString.toString("base64");
          await dev.writeCharacteristicWithResponseForService(
            serviceUUID,
            writeCharacteristicUUID,
            base64requestString
          );
        } catch (error) {
          console.log("Error sending 'request':", error);
        }
      }, 200);
      if (typeof openExclusiveModal === "function") {
        openExclusiveModal(() => setSecurityCodeModalVisible(true));
      } else {
        setSecurityCodeModalVisible(true);
      }
    } catch (error) {
      console.log("Error connecting or sending command to device:", error);
    }
  };
}
