/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { Buffer } from "buffer";
import { bluetoothConfig } from "../env/bluetoothConfig";
import { isBleDisconnectError } from "./bleErrors";
import {
  createBleTransactionId,
  safeRemoveSubscription,
} from "./bleSubscription";
import { parseResp, bleCmd } from "./bleProtocol";
import { DEVICE_RESPONSES } from "./deviceProtocolConstants";

const { serviceUUID, writeCharacteristicUUID, notifyCharacteristicUUID } =
  bluetoothConfig;

/**
 * Query device screen lock state before sending a command.
 * If unlocked, resolves immediately.
 * If locked, waits for user to enter the correct password on the device.
 *
 * @param {object} device - Connected BLE device
 * @param {object} [options]
 * @param {string} [options.label] - Log prefix (default "SCREEN_CHECK")
 * @param {Set}    [options.activeSubs] - Optional subscription tracker (for handleSaveToDevice)
 * @returns {Promise<void>}
 * @throws {Error} SCREEN_PWD_CANCEL | SCREEN_CHECK_TIMEOUT | BLE errors
 */
export async function ensureScreenUnlocked(device, options = {}) {
  const { label = "SCREEN_CHECK", activeSubs } = options;

  return new Promise((resolve, reject) => {
    let settled = false;
    let waitingForPwd = false;
    let screenTimeoutId = null;

    const screenTxId = createBleTransactionId("screen", device?.id);

    const cleanup = () => {
      clearTimeout(screenTimeoutId);
      try {
        safeRemoveSubscription(screenSub);
        activeSubs?.delete?.(screenSub);
      } catch {}
    };

    const settle = (fn) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const screenSub = device.monitorCharacteristicForService(
      serviceUUID,
      notifyCharacteristicUUID,
      (error, characteristic) => {
        if (error) {
          settle(() =>
            isBleDisconnectError(error) ? resolve() : reject(error)
          );
          return;
        }
        if (!characteristic?.value) return;

        const clean = Buffer.from(characteristic.value, "base64")
          .toString("utf-8")
          .replace(/[\x00-\x1F\x7F]/g, "")
          .trim();
        const parsed = parseResp(clean);

        if (parsed?.resp === "screen") {
          console.log(`[${label}] screen lock state:`, parsed.locked);
          if (!parsed.locked) {
            settle(() => resolve());
            return;
          }
          waitingForPwd = true;
          clearTimeout(screenTimeoutId);
          screenTimeoutId = setTimeout(() => {
            settle(() => reject(new Error("SCREEN_CHECK_TIMEOUT")));
          }, 60000);
          return;
        }

        if (waitingForPwd && parsed?.resp === DEVICE_RESPONSES.pwdCorrectJson) {
          console.log(`[${label}] device unlocked via password`);
          settle(() => resolve());
          return;
        }
        if (waitingForPwd && parsed?.resp === DEVICE_RESPONSES.pwdCancelJson) {
          console.log(`[${label}] password cancelled on device`);
          settle(() => reject(new Error("SCREEN_PWD_CANCEL")));
          return;
        }
      },
      screenTxId
    );

    try {
      activeSubs?.add?.(screenSub);
    } catch {}

    screenTimeoutId = setTimeout(() => {
      settle(() => reject(new Error("SCREEN_CHECK_TIMEOUT")));
    }, 10000);

    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 80));
        const screenCmdB64 = Buffer.from(
          bleCmd.screen() + "\r\n",
          "utf-8"
        ).toString("base64");
        await device.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          screenCmdB64
        );
        console.log(`[${label}] screen lock query sent`);
      } catch (e) {
        settle(() => reject(e));
      }
    })();
  });
}
