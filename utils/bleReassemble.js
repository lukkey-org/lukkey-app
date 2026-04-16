/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
/**
 * BLE Packet Reassembly — production monkey-patch
 *
 * BLE notifications may deliver partial data across multiple callbacks.
 * This module wraps monitorCharacteristicForService / monitorCharacteristicForDevice
 * so that the application listener only receives **complete lines** delimited by \r\n.
 *
 * If data does not contain \r\n within FLUSH_TIMEOUT_MS the buffer is flushed as-is
 * (safety net for messages that may not use the delimiter).
 *
 * Must be require()'d BEFORE dev_ble.js so that the logging layer wraps the
 * reassembled (complete-packet) output.
 */

import { Device, BleManager } from "react-native-ble-plx";
import { Buffer } from "buffer";
import { RUNTIME_DEV } from "./runtimeFlags";

/** Max ms to wait for \r\n before flushing whatever we have */
const FLUSH_TIMEOUT_MS = 300;
/** Hard cap to avoid unbounded memory growth */
const MAX_BUFFER = 10240; // 10 KB

/**
 * Wrap a BLE notification listener so it only fires with complete \r\n-delimited lines.
 */
function wrapListenerWithReassembly(listener) {
  if (typeof listener !== "function") return listener;

  let buf = "";
  let timer = null;
  let lastChar = null; // keep a reference to the most recent characteristic template

  /** Deliver one reassembled payload to the original listener */
  function deliver(data, template) {
    try {
      const b64 = Buffer.from(data, "utf8").toString("base64");
      listener(null, { value: b64 });
    } catch {}
  }

  /** Flush whatever is left in the buffer (timeout / error / overflow) */
  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (buf.length > 0) {
      const data = buf;
      buf = "";
      deliver(data, lastChar);
    }
  }

  return function reassemblingListener(error, characteristic) {
    // On error: flush remaining buffer first, then forward the error
    if (error) {
      flush();
      listener(error, characteristic);
      return;
    }

    // Pass through null / empty characteristics unchanged
    if (!characteristic || !characteristic.value) {
      listener(error, characteristic);
      return;
    }

    lastChar = characteristic;
    const text = Buffer.from(characteristic.value, "base64").toString("utf8");
    buf += text;

    // Cancel any pending flush timer – we just received new data
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    // Deliver every complete line (delimited by \r\n)
    let idx;
    while ((idx = buf.indexOf("\r\n")) !== -1) {
      const line = buf.slice(0, idx + 2); // include the \r\n delimiter
      buf = buf.slice(idx + 2);
      deliver(line, characteristic);
    }

    // Safety: hard cap on buffer size
    if (buf.length > MAX_BUFFER) {
      flush();
      return;
    }

    // If there is leftover data without \r\n, set a timeout flush
    // This covers messages that might not use the \r\n protocol
    if (buf.length > 0) {
      timer = setTimeout(flush, FLUSH_TIMEOUT_MS);
    }
  };
}

// ---------------------------------------------------------------------------
// Monkey-patch once
// ---------------------------------------------------------------------------
function patchReassembly() {
  if (typeof global === "undefined") return;
  if (global.__BLE_REASSEMBLE_PATCHED__) return;

  try {
    /* ---- Device.prototype ---- */
    const origDM = Device.prototype.monitorCharacteristicForService;
    if (typeof origDM === "function") {
      Device.prototype.monitorCharacteristicForService = function (
        serviceUUID,
        characteristicUUID,
        listener,
        ...rest
      ) {
        return origDM.apply(this, [
          serviceUUID,
          characteristicUUID,
          wrapListenerWithReassembly(listener),
          ...rest,
        ]);
      };
    }

    /* ---- BleManager.prototype ---- */
    const mp = BleManager && BleManager.prototype;
    if (mp) {
      const origMM = mp.monitorCharacteristicForDevice;
      if (typeof origMM === "function") {
        mp.monitorCharacteristicForDevice = function (
          deviceId,
          serviceUUID,
          characteristicUUID,
          listener,
          ...rest
        ) {
          return origMM.apply(this, [
            deviceId,
            serviceUUID,
            characteristicUUID,
            wrapListenerWithReassembly(listener),
            ...rest,
          ]);
        };
      }
    }

    global.__BLE_REASSEMBLE_PATCHED__ = true;
    if (RUNTIME_DEV) {
      console.log("[BLE] Packet reassembly (\\r\\n framing) active");
    }
  } catch (e) {
    console.log("[BLE] Reassembly patch error:", e?.message || e);
  }
}

patchReassembly();

export default null;
