/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { Platform } from "react-native";
import checkAndReqPermission from "./BluetoothPermissions";
import { BleErrorCode, ScanMode } from "react-native-ble-plx";
import { Buffer } from "buffer";

/**
  * Generic Bluetooth device scanning function
  * @param {boolean} isScanning - whether scanning is currently taking place
  * @param {function} setIsScanning - function to set scanning status
  * @param {object} bleManagerRef - Bluetooth manager ref (need to pass in .current)
  * @param {function} setDevices - function to set the device list
  * @param {number} [scanDuration=6000] - Scan duration (milliseconds), default 6000ms (Android improves discovery rate)
 */
export function scanDevices({
  isScanning,
  setIsScanning,
  bleManagerRef,
  setDevices,
  scanDuration = 5000,
}) {
  if (Platform.OS !== "web" && !isScanning) {
    checkAndReqPermission(() => {
      setIsScanning(true);
      // Clear device list
      setDevices([]);

      // Android uses low-latency scanning mode to improve discovery rate; iOS ignores this field
      const scanOptions =
        Platform.OS === "android"
          ? { allowDuplicates: true, scanMode: ScanMode?.LowLatency }
          : { allowDuplicates: true };
      const scanFilter = null;

      bleManagerRef.current.startDeviceScan(
        scanFilter,
        scanOptions,
        (error, device) => {
          if (error) {
            console.log("BleManager scanning error:", error);
            if (error.errorCode === BleErrorCode.BluetoothUnsupported) {
              // Bluetooth LE unsupported on device
            }
            return;
          }
          if (!device) return;

          // Common name in Android 12+ broadcast is empty, try localName / manufacturerData
          const name = device.name || "";
          const localName = device.localName || "";
          let matches = false;

          if (name.includes("LUKKEY") || localName.includes("LUKKEY")) {
            matches = true;
          } else if (device.manufacturerData) {
            try {
              const decoded = Buffer.from(
                device.manufacturerData,
                "base64"
              ).toString("utf8");
              if (decoded.includes("LUKKEY")) {
                matches = true;
              }
            } catch {
              // Ignore decoding exceptions
            }
          }

          if (!matches) return;

          // Print key information limited by Bluetooth broadcast packet bytes (can be turned on on demand)
          /* console.log(
            "[Device scanned]",
            "name:", device.name,
            "localName:", device.localName,
            "rssi:", device.rssi,
            "manufacturerData:", device.manufacturerData,
            "serviceUUIDs:", device.serviceUUIDs,
            "serviceData:", device.serviceData
          ); */

          // Important fix: keep the react-native-ble-plx Device instance to avoid destroying the prototype with object extension and causing connect() to be lost
          setDevices((prevDevices) => {
            const idx = prevDevices.findIndex((d) => d.id === device.id);
            if (idx === -1) {
              // Add the Device instance returned by the library for the first time (including connect/ discoverAllServices... and other methods)
              return [...prevDevices, device];
            } else {
              const existing = prevDevices[idx];

              // Replace the old one with a "new device instance", making sure it's always a Device with methods
              // At the same time, do a field check: if the new instance lacks name/rssi, the old value will be used (without destroying the instance prototype)
              const nextInstance = device;

              // Some broadcast updates may not have name/rssi and use the old value
              if (
                typeof nextInstance.rssi !== "number" &&
                typeof existing?.rssi === "number"
              ) {
                try {
                  nextInstance.rssi = existing.rssi;
                } catch {}
              }
              if (!nextInstance.name && existing?.name) {
                try {
                  nextInstance.name = existing.name;
                } catch {}
              }

              const next = [...prevDevices];
              next[idx] = nextInstance;
              return next;
            }
          });
        }
      );

      setTimeout(() => {
        try {
          bleManagerRef.current.stopDeviceScan();
        } catch {}
        setIsScanning(false);
      }, scanDuration);
    });
  } else {
  }
}
