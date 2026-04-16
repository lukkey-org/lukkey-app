/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// src/utils/BluetoothPermissions.js
import { Platform, PermissionsAndroid } from "react-native";

// Android 12+: SCAN / CONNECT runtime permissions.
// Android 11-: BLUETOOTH / BLUETOOTH_ADMIN are normal permissions and are usually
// granted at install time, but we still check them to avoid hard-coded "granted".
const ANDROID12_PERMS = [
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
];
const ANDROID_LEGACY_PERMS = [
  PermissionsAndroid.PERMISSIONS.BLUETOOTH,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
].filter(Boolean);

const getAndroidBlePermList = (sdk) => (sdk >= 31 ? ANDROID12_PERMS : ANDROID_LEGACY_PERMS);

export const isBlePermissionGrantedByState = (state) =>
  state === "PoweredOn" || state === "PoweredOff" || state === "Resetting";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForIosBleState = async (mgr, timeoutMs = 2500) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const state = await mgr.state();
      if (isBlePermissionGrantedByState(state) || state === "Unauthorized") {
        return state;
      }
    } catch {}
    await wait(150);
  }
  try {
    return await mgr.state();
  } catch {
    return "Unknown";
  }
};

// iOS does not have a dedicated "request Bluetooth permission" API.
// The system prompt is triggered when scanning/connecting starts for the first time.
export const requestIosBlePermission = async (bleManagerRef) => {
  if (Platform.OS !== "ios") return true;
  try {
    const mgr = bleManagerRef?.current;
    if (!mgr?.state) return false;

    const current = await mgr.state();
    if (isBlePermissionGrantedByState(current)) return true;

    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try {
          mgr.stopDeviceScan();
        } catch {}
        resolve();
      };

      const timer = setTimeout(finish, 1200);
      try {
        mgr.startDeviceScan(null, null, () => {});
      } catch {
        clearTimeout(timer);
        finish();
        return;
      }
    });

    const next = await waitForIosBleState(mgr);
    return isBlePermissionGrantedByState(next);
  } catch {
    return false;
  }
};

// Check whether the required permissions are currently available (without triggering a request)
const checkAndroidBlePermissions = async () => {
  const sdk = Platform.Version || 0;
  const perms = getAndroidBlePermList(sdk);
  try {
    if (perms.length === 0) return false;
    const checks = await Promise.all(perms.map((p) => PermissionsAndroid.check(p)));
    return checks.every(Boolean);
  } catch (e) {
    // Returns false when an error occurs, thereby following the request process.
    return false;
  }
};

// Only request "missing" permissions; if all are available, return true directly
const requestAndroidPermissions = async () => {
  const sdk = Platform.Version || 0;
  const perms = getAndroidBlePermList(sdk);
  try {
    if (perms.length === 0) return false;
    // Filter out missing permissions before requesting them to avoid repeated interruptions
    const need = [];
    for (const p of perms) {
      const has = await PermissionsAndroid.check(p);
      if (!has) need.push(p);
    }
    if (need.length === 0) return true;
    const res = await PermissionsAndroid.requestMultiple(need);
    return need.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED);
  } catch (e) {
    // Returns false when an error occurs, allowing the upper layer to sense that it has not been granted
    return false;
  }
};

/**
 * Compatible with old usage: detect first, then request when missing; keep callback signature unchanged and return Boolean result
 * - Only print logs when "the request is really needed" to avoid disturbing logs in authorized scenarios
 */
const checkAndReqPermission = async (callback) => {
  if (Platform.OS === "android" && Platform.Version >= 23) {
    const already = await checkAndroidBlePermissions();
    let granted = already;
    if (!already) {
      // Request missing BLE-related permissions.
      granted = await requestAndroidPermissions();
    }
    if (callback && granted) callback();
    return !!granted;
  }
  // iOS / other platforms do not require runtime permissions
  if (callback) callback();
  return true;
};

// Called when the page only performs status judgment (no request will be triggered)
export const isAndroidBlePermissionGranted = async () => {
  if (Platform.OS !== "android") return true;
  return await checkAndroidBlePermissions();
};

export default checkAndReqPermission;
