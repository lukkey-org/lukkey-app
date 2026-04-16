/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
/**
 * Dev BLE logger and monkey patches (extended coverage)
 * Goal: Capture ALL App & Embedded (BLE) communications paths and key connection lifecycle into AsyncStorage,
 *       for display in Floating Dev Window.
 * Activation: Auto-runs when required/imported in __DEV__.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Device, BleManager } from "react-native-ble-plx";
import { Buffer } from "buffer";

const BLE_LOG_KEY = "bleCommLog";
const MAX_LOG = 300;

function safeToUtf8(buf) {
  try {
    return buf.toString("utf8");
  } catch {
    return "";
  }
}

async function addLog(entry) {
  if (typeof global !== "undefined" && global.__BLE_LOG_ENABLED__ === false)
    return;
  try {
    const now = new Date();
    const rec = {
      id: `${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now.getTime(),
      time: now.toLocaleString(),
      ...entry,
    };
    const current = await AsyncStorage.getItem(BLE_LOG_KEY);
    const arr = current ? JSON.parse(current) : [];
    arr.push(rec);
    if (arr.length > MAX_LOG) {
      arr.splice(0, arr.length - MAX_LOG);
    }
    await AsyncStorage.setItem(BLE_LOG_KEY, JSON.stringify(arr));
  } catch {
    // ignore storage errors in dev
  }
}

async function clearLogs() {
  try {
    await AsyncStorage.removeItem(BLE_LOG_KEY);
  } catch {
    // ignore
  }
}

// Expose a simple global logger/toggle for optional manual use
if (typeof global !== "undefined") {
  if (typeof global.__BLE_LOG_ENABLED__ === "undefined") {
    global.__BLE_LOG_ENABLED__ = true; // default ON
  }
  global.__BLE_LOGGER__ = {
    add: addLog,
    clear: clearLogs,
    key: BLE_LOG_KEY,
  };
}

function patchOnce() {
  if (typeof global === "undefined") return;
  if (global.__BLE_PATCHED__) return;

  try {
    /************************************************************
     * Device.prototype patches (app-side most common entrypoints)
     ************************************************************/

    // TX: writeCharacteristicWithResponseForService
    const origDeviceWriteWith =
      Device.prototype.writeCharacteristicWithResponseForService;
    if (typeof origDeviceWriteWith === "function") {
      Device.prototype.writeCharacteristicWithResponseForService =
        async function (serviceUUID, characteristicUUID, base64Value, ...rest) {
          if (global.__BLE_LOG_ENABLED__) {
            try {
              const buf = Buffer.from(base64Value || "", "base64");
              await addLog({
                direction: "TX",
                op: "write",
                deviceId: this?.id,
                serviceUUID,
                characteristicUUID,
                base64: base64Value || "",
                hex: buf.toString("hex"),
                text: safeToUtf8(buf),
                size: buf.length,
              });
            } catch {
              // ignore
            }
          }
          return origDeviceWriteWith.apply(this, [
            serviceUUID,
            characteristicUUID,
            base64Value,
            ...rest,
          ]);
        };
    }

    // TX (no response): writeCharacteristicWithoutResponseForService
    const origDeviceWriteWithout =
      Device.prototype.writeCharacteristicWithoutResponseForService;
    if (typeof origDeviceWriteWithout === "function") {
      Device.prototype.writeCharacteristicWithoutResponseForService =
        async function (serviceUUID, characteristicUUID, base64Value, ...rest) {
          if (global.__BLE_LOG_ENABLED__) {
            try {
              const buf = Buffer.from(base64Value || "", "base64");
              await addLog({
                direction: "TX",
                op: "writeNoRsp",
                deviceId: this?.id,
                serviceUUID,
                characteristicUUID,
                base64: base64Value || "",
                hex: buf.toString("hex"),
                text: safeToUtf8(buf),
                size: buf.length,
              });
            } catch {
              // ignore
            }
          }
          return origDeviceWriteWithout.apply(this, [
            serviceUUID,
            characteristicUUID,
            base64Value,
            ...rest,
          ]);
        };
    }

    // RX (read): readCharacteristicForService
    const origDeviceReadForService =
      Device.prototype.readCharacteristicForService;
    if (typeof origDeviceReadForService === "function") {
      Device.prototype.readCharacteristicForService = function (
        serviceUUID,
        characteristicUUID,
        ...rest
      ) {
        const p = origDeviceReadForService.apply(this, [
          serviceUUID,
          characteristicUUID,
          ...rest,
        ]);
        try {
          return Promise.resolve(p).then(async (ch) => {
            try {
              if (global.__BLE_LOG_ENABLED__ && ch && ch.value) {
                const buf = Buffer.from(ch.value, "base64");
                await addLog({
                  direction: "RX",
                  op: "read",
                  deviceId: this?.id,
                  serviceUUID,
                  characteristicUUID,
                  base64: ch.value,
                  hex: buf.toString("hex"),
                  text: safeToUtf8(buf),
                  size: buf.length,
                });
              }
            } catch {
              // ignore
            }
            return ch;
          });
        } catch {
          return p;
        }
      };
    }

    // RX (notify): monitorCharacteristicForService
    const origDeviceMonitorForService =
      Device.prototype.monitorCharacteristicForService;
    if (typeof origDeviceMonitorForService === "function") {
      Device.prototype.monitorCharacteristicForService = function (
        serviceUUID,
        characteristicUUID,
        listener,
        ...rest
      ) {
        const self = this;
        const wrapped = (error, characteristic) => {
          if (
            global.__BLE_LOG_ENABLED__ &&
            characteristic &&
            characteristic.value
          ) {
            try {
              const buf = Buffer.from(characteristic.value, "base64");
              // fire and forget to avoid blocking listener
              addLog({
                direction: "RX",
                op: "notify",
                deviceId: self?.id,
                serviceUUID,
                characteristicUUID,
                base64: characteristic.value,
                hex: buf.toString("hex"),
                text: safeToUtf8(buf),
                size: buf.length,
              });
            } catch {
              // ignore
            }
          }
          if (typeof listener === "function") {
            listener(error, characteristic);
          }
        };
        return origDeviceMonitorForService.apply(this, [
          serviceUUID,
          characteristicUUID,
          wrapped,
          ...rest,
        ]);
      };
    }

    // SYS: connect / cancelConnection
    const origDeviceConnect = Device.prototype.connect;
    if (typeof origDeviceConnect === "function") {
      Device.prototype.connect = async function (...args) {
        try {
          await addLog({ direction: "SYS", op: "connect", deviceId: this?.id });
        } catch {}
        try {
          const res = await origDeviceConnect.apply(this, args);
          try {
            await addLog({
              direction: "SYS",
              op: "connected",
              deviceId: this?.id,
            });
          } catch {}
          return res;
        } catch (e) {
          try {
            await addLog({
              direction: "SYS",
              op: "connect_error",
              deviceId: this?.id,
              error: e?.message || String(e),
            });
          } catch {}
          throw e;
        }
      };
    }
    const origDeviceCancel = Device.prototype.cancelConnection;
    if (typeof origDeviceCancel === "function") {
      Device.prototype.cancelConnection = async function (...args) {
        try {
          await addLog({
            direction: "SYS",
            op: "disconnect",
            deviceId: this?.id,
          });
        } catch {}
        try {
          const res = await origDeviceCancel.apply(this, args);
          try {
            await addLog({
              direction: "SYS",
              op: "disconnected",
              deviceId: this?.id,
            });
          } catch {}
          return res;
        } catch (e) {
          try {
            await addLog({
              direction: "SYS",
              op: "disconnect_error",
              deviceId: this?.id,
              error: e?.message || String(e),
            });
          } catch {}
          throw e;
        }
      };
    }

    /************************************************************
     * BleManager.prototype patches (cover alternate call sites)
     ************************************************************/
    const mgrProto = BleManager && BleManager.prototype;

    if (mgrProto) {
      // TX: writeCharacteristicWithResponseForDevice
      const origMgrWriteWith =
        mgrProto.writeCharacteristicWithResponseForDevice;
      if (typeof origMgrWriteWith === "function") {
        mgrProto.writeCharacteristicWithResponseForDevice = async function (
          deviceIdentifier,
          serviceUUID,
          characteristicUUID,
          base64Value,
          ...rest
        ) {
          if (global.__BLE_LOG_ENABLED__) {
            try {
              const buf = Buffer.from(base64Value || "", "base64");
              await addLog({
                direction: "TX",
                op: "write",
                deviceId: deviceIdentifier,
                serviceUUID,
                characteristicUUID,
                base64: base64Value || "",
                hex: buf.toString("hex"),
                text: safeToUtf8(buf),
                size: buf.length,
              });
            } catch {}
          }
          return origMgrWriteWith.apply(this, [
            deviceIdentifier,
            serviceUUID,
            characteristicUUID,
            base64Value,
            ...rest,
          ]);
        };
      }

      // TX (no response): writeCharacteristicWithoutResponseForDevice
      const origMgrWriteWithout =
        mgrProto.writeCharacteristicWithoutResponseForDevice;
      if (typeof origMgrWriteWithout === "function") {
        mgrProto.writeCharacteristicWithoutResponseForDevice = async function (
          deviceIdentifier,
          serviceUUID,
          characteristicUUID,
          base64Value,
          ...rest
        ) {
          if (global.__BLE_LOG_ENABLED__) {
            try {
              const buf = Buffer.from(base64Value || "", "base64");
              await addLog({
                direction: "TX",
                op: "writeNoRsp",
                deviceId: deviceIdentifier,
                serviceUUID,
                characteristicUUID,
                base64: base64Value || "",
                hex: buf.toString("hex"),
                text: safeToUtf8(buf),
                size: buf.length,
              });
            } catch {}
          }
          return origMgrWriteWithout.apply(this, [
            deviceIdentifier,
            serviceUUID,
            characteristicUUID,
            base64Value,
            ...rest,
          ]);
        };
      }

      // RX (read): readCharacteristicForDevice
      const origMgrRead = mgrProto.readCharacteristicForDevice;
      if (typeof origMgrRead === "function") {
        mgrProto.readCharacteristicForDevice = function (
          deviceIdentifier,
          serviceUUID,
          characteristicUUID,
          ...rest
        ) {
          const p = origMgrRead.apply(this, [
            deviceIdentifier,
            serviceUUID,
            characteristicUUID,
            ...rest,
          ]);
          try {
            return Promise.resolve(p).then(async (ch) => {
              try {
                if (global.__BLE_LOG_ENABLED__ && ch && ch.value) {
                  const buf = Buffer.from(ch.value, "base64");
                  await addLog({
                    direction: "RX",
                    op: "read",
                    deviceId: deviceIdentifier,
                    serviceUUID,
                    characteristicUUID,
                    base64: ch.value,
                    hex: buf.toString("hex"),
                    text: safeToUtf8(buf),
                    size: buf.length,
                  });
                }
              } catch {}
              return ch;
            });
          } catch {
            return p;
          }
        };
      }

      // RX (notify): monitorCharacteristicForDevice
      const origMgrMonitor = mgrProto.monitorCharacteristicForDevice;
      if (typeof origMgrMonitor === "function") {
        mgrProto.monitorCharacteristicForDevice = function (
          deviceIdentifier,
          serviceUUID,
          characteristicUUID,
          listener,
          ...rest
        ) {
          const wrapped = (error, characteristic) => {
            if (
              global.__BLE_LOG_ENABLED__ &&
              characteristic &&
              characteristic.value
            ) {
              try {
                const buf = Buffer.from(characteristic.value, "base64");
                addLog({
                  direction: "RX",
                  op: "notify",
                  deviceId: deviceIdentifier,
                  serviceUUID,
                  characteristicUUID,
                  base64: characteristic.value,
                  hex: buf.toString("hex"),
                  text: safeToUtf8(buf),
                  size: buf.length,
                });
              } catch {}
            }
            if (typeof listener === "function") {
              listener(error, characteristic);
            }
          };
          return origMgrMonitor.apply(this, [
            deviceIdentifier,
            serviceUUID,
            characteristicUUID,
            wrapped,
            ...rest,
          ]);
        };
      }
    }

    global.__BLE_PATCHED__ = true;
  } catch {
    // ignore patch errors in dev
  }
}

/**
 * Run patch and expose helper utilities for verification without hardware
 */
patchOnce();

// Expose status and simulator for manual verification (no hardware required)
if (typeof global !== "undefined" && global.__BLE_LOGGER__) {
  // Report which wrappers are present
  global.__BLE_LOGGER__.status = () => ({
    patched: !!global.__BLE_PATCHED__,
    methods: {
      // Device-level wrappers
      deviceWriteWith:
        !!Device.prototype.writeCharacteristicWithResponseForService,
      deviceWriteWithout:
        !!Device.prototype.writeCharacteristicWithoutResponseForService,
      deviceReadForService: !!Device.prototype.readCharacteristicForService,
      deviceMonitorForService:
        !!Device.prototype.monitorCharacteristicForService,
      // Manager-level wrappers
      managerWriteWith: !!(
        BleManager &&
        BleManager.prototype &&
        BleManager.prototype.writeCharacteristicWithResponseForDevice
      ),
      managerWriteWithout: !!(
        BleManager &&
        BleManager.prototype &&
        BleManager.prototype.writeCharacteristicWithoutResponseForDevice
      ),
      managerReadForDevice: !!(
        BleManager &&
        BleManager.prototype &&
        BleManager.prototype.readCharacteristicForDevice
      ),
      managerMonitorForDevice: !!(
        BleManager &&
        BleManager.prototype &&
        BleManager.prototype.monitorCharacteristicForDevice
      ),
    },
  });

  // Push simulated entries into BLE log to verify UI pipeline without a device
  global.__BLE_LOGGER__.simulateLog = async () => {
    try {
      // Clear existing to make the simulated sequence obvious
      await clearLogs();
      const mk = (s) => Buffer.from(s, "utf8");
      await addLog({
        direction: "SYS",
        op: "connect",
        deviceId: "SIM-DEVICE",
      });
      await addLog({
        direction: "TX",
        op: "write",
        deviceId: "SIM-DEVICE",
        serviceUUID: "6E400001-SIM",
        characteristicUUID: "6E400002-SIM",
        base64: mk("request\r\n").toString("base64"),
        hex: mk("request\r\n").toString("hex"),
        text: "request\r\n",
        size: mk("request\r\n").length,
      });
      await addLog({
        direction: "RX",
        op: "notify",
        deviceId: "SIM-DEVICE",
        serviceUUID: "6E400001-SIM",
        characteristicUUID: "6E400003-SIM",
        base64: mk("PIN:6375,Y\r\n").toString("base64"),
        hex: mk("PIN:6375,Y\r\n").toString("hex"),
        text: "PIN:6375,Y\r\n",
        size: mk("PIN:6375,Y\r\n").length,
      });
      await addLog({
        direction: "RX",
        op: "notify",
        deviceId: "SIM-DEVICE",
        serviceUUID: "6E400001-SIM",
        characteristicUUID: "6E400003-SIM",
        base64: mk("VALID").toString("base64"),
        hex: mk("VALID").toString("hex"),
        text: "VALID",
        size: mk("VALID").length,
      });
      await addLog({
        direction: "SYS",
        op: "disconnected",
        deviceId: "SIM-DEVICE",
      });
    } catch {
      // ignore
    }
  };
}

// This module exports nothing - side effects only
export default null;
