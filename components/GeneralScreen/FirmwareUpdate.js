/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
/** Alert removed: OTA process uses CheckStatusModal status display instead */
import { Buffer } from "buffer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import ExpoNordicDfu from "@getquip/expo-nordic-dfu";
import CryptoJS from "crypto-js";
import { firmwareAPI } from "../../env/apiEndpoints";
import { bluetoothConfig } from "../../env/bluetoothConfig";
import { isBleDisconnectError } from "../../utils/bleErrors";
import { RUNTIME_DEV } from "../../utils/runtimeFlags";
import { ensureDeviceReady } from "../../utils/ensureDeviceReady";
import { byteStuffEncode } from "../../utils/byteStuff";
import { getSecureItem, setSecureItem } from "../../utils/secureStorage";
import { OTA_TRANSFER_COMPLETED_KEY } from "../../utils/firmwareUpdateKeys";
import { bleCmd, frameBle, parseResp } from "../../utils/bleProtocol";
import {
  DEVICE_REQUESTS,
  DEVICE_RESPONSES,
  parseIndexedDeviceRequest,
} from "../../utils/deviceProtocolConstants";

const parseFileNameFromUrl = (url) => {
  if (!url) return "";
  try {
    const u = new URL(url);
    return (u.pathname || "").split("/").pop() || "";
  } catch (_e) {
    try {
      const stripped = String(url).split(/[?#]/)[0];
      const parts = stripped.split("/");
      return parts[parts.length - 1] || "";
    } catch {
      return "";
    }
  }
};

const isBluetoothFirmware = (url) => {
  const name = parseFileNameFromUrl(url);
  if (!name) return false;
  if (/bluetooth/i.test(name)) return true;
  // Support LukkeyBL-1.0.1.zip / BL_1.2.3 / BL-1.2.3
  if (/bl[_-]\d+/i.test(name)) return true;
  if (/(^|[^a-z])bl[^a-z0-9]*\d+/i.test(name)) return true;
  if (/\bbl\b/i.test(name)) return true;
  return false;
};

const downloadFirmware = async (url, localPath, onProgress) => {
  try {
    const fs = getFileSystem();
    const info = await fs.getInfoAsync(localPath);
    if (info.exists) {
      await fs.deleteAsync(localPath, { idempotent: true });
    }
  } catch {}

  const fs = getFileSystem();
  const resumable = fs.createDownloadResumable(
    url,
    localPath,
    {},
    (progress) => {
      if (
        progress &&
        progress.totalBytesExpectedToWrite &&
        progress.totalBytesExpectedToWrite > 0
      ) {
        const ratio =
          progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
        if (typeof onProgress === "function") {
          onProgress(Math.max(0, Math.min(1, ratio)));
        }
      }
    }
  );
  const result = await resumable.downloadAsync();
  return result?.uri || localPath;
};

const getFileSystem = () => {
  try {
    if (FileSystem?.documentDirectory || FileSystem?.cacheDirectory) {
      return FileSystem;
    }
  } catch {}
  try {
    const legacy = require("expo-file-system/legacy");
    if (legacy?.documentDirectory || legacy?.cacheDirectory) {
      return legacy;
    }
  } catch {}
  return FileSystem;
};

const startNordicDfu = async ({
  deviceAddress,
  fileUri,
  setCheckStatusProgress,
  setVerificationStatus,
  setCheckStatusModalVisible,
  openExclusiveModal,
  syncFirmwareUpdateInfo,
}) => {
  const showCheckStatusModal = () => {
    if (typeof setCheckStatusModalVisible !== "function") return;
    if (typeof openExclusiveModal === "function") {
      openExclusiveModal(() => setCheckStatusModalVisible(true));
      return;
    }
    setCheckStatusModalVisible(true);
  };
  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  const progressSub = ExpoNordicDfu.module.addListener(
    "DFUProgress",
    (progress) => {
      const percent = Number(progress?.percent || 0);
      const mapped = 0.2 + 0.8 * clamp01(percent / 100);
      try {
        setCheckStatusProgress && setCheckStatusProgress(mapped);
      } catch {}
      try {
        if (percent >= 100) {
          setCheckStatusProgress && setCheckStatusProgress(1);
          setVerificationStatus && setVerificationStatus("otaSuccess");
        } else {
          setVerificationStatus && setVerificationStatus("otaSending");
        }
      } catch {}
    }
  );
  const stateSub = ExpoNordicDfu.module.addListener(
    "DFUStateChanged",
    ({ state }) => {
      if (!state) return;
      if (state === "starting") {
        try {
          setVerificationStatus && setVerificationStatus("otaSending");
          showCheckStatusModal();
        } catch {}
      }
      if (state === "installing") {
        try {
          AsyncStorage.setItem(OTA_TRANSFER_COMPLETED_KEY, "1").catch(() => {});
          if (typeof syncFirmwareUpdateInfo === "function") {
            syncFirmwareUpdateInfo(false, { transferCompleted: true }).catch(
              () => {}
            );
          }
          // After the transfer is completed, the device side is processing: "Transfer completed, please wait for device update" is displayed.
          setVerificationStatus && setVerificationStatus("otaSuccess");
          showCheckStatusModal();
        } catch {}
      }
      if (state === "completed") {
        try {
          setCheckStatusProgress && setCheckStatusProgress(1);
          setVerificationStatus && setVerificationStatus("otaSuccess");
          showCheckStatusModal();
        } catch {}
      }
      if (state === "failed" || state === "aborted") {
        try {
          setVerificationStatus && setVerificationStatus("otaFail");
          showCheckStatusModal();
        } catch {}
      }
    }
  );

  try {
    await ExpoNordicDfu.startDfu({
      deviceAddress,
      fileUri,
    });
  } finally {
    try {
      progressSub.remove();
      stateSub.remove();
    } catch {}
  }
};

/**
 * 查询设备固件版本号并写入 secureStorage（1s 超时）。
 *
 * 两种调用方式：
 *   1) 外部预查询：传 devices / verifiedDevices / bleManagerRef 等，内部自动 ensureDeviceReady + 连接
 *   2) OTA 内部：传已连接的 device，省略 devices/verifiedDevices，跳过连接步骤
 */
export const queryDeviceVersion = async ({
  device,
  devices,
  verifiedDevices,
  bleManagerRef,
  setBleVisible,
  openExclusiveModal,
  serviceUUID,
  writeCharacteristicUUID,
  notifyCharacteristicUUID,
}) => {
  const notifyUUID =
    notifyCharacteristicUUID || bluetoothConfig.notifyCharacteristicUUID;
  try {
    let targetDevice = device;

    if (Array.isArray(devices) && Array.isArray(verifiedDevices)) {
      const { ok, device: readyDevice } = await ensureDeviceReady({
        device,
        devices,
        verifiedDevices,
        setBleVisible,
        openBleModal:
          typeof openExclusiveModal === "function"
            ? () => openExclusiveModal(() => setBleVisible?.(true))
            : undefined,
        bleManagerRef,
      });
      if (!ok || !readyDevice) return null;
      targetDevice = readyDevice;
      const connected = await targetDevice.isConnected?.();
      if (!connected) await targetDevice.connect();
      await targetDevice.discoverAllServicesAndCharacteristics();
    }

    const versionInfo = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 1000);
      const txId = `ver-${targetDevice?.id || "x"}-${Date.now()}`;
      const sub = targetDevice.monitorCharacteristicForService(
        serviceUUID,
        notifyUUID,
        (error, characteristic) => {
          if (error || !characteristic?.value) return;
          const raw = Buffer.from(characteristic.value, "base64")
            .toString("utf-8")
            .replace(/[\x00-\x1F\x7F]/g, "")
            .trim();
          let parsed = parseResp(raw);
          if (!parsed && raw.startsWith("{")) {
            try { parsed = JSON.parse(raw); } catch {}
          }
          if (parsed && (parsed.resp === "version" || parsed.hw)) {
            clearTimeout(timeout);
            try { sub.remove(); } catch {}
            resolve(parsed);
          }
        },
        txId
      );
      targetDevice
        .writeCharacteristicWithoutResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          frameBle(bleCmd.version())
        )
        .catch(() => {});
    });

    if (versionInfo) {
      console.log("queryDeviceVersion: response:", versionInfo);
      if (versionInfo.hw)
        await setSecureItem("hardwareVersion", String(versionInfo.hw).trim());
      if (versionInfo.bt)
        await setSecureItem("bluetoothVersion", String(versionInfo.bt).trim());
      if (versionInfo.base)
        await setSecureItem("baseVersion", String(versionInfo.base).trim());
    } else {
      console.log("queryDeviceVersion: timeout (1s), using stored versions");
    }
    return versionInfo;
  } catch (e) {
    console.log("queryDeviceVersion: failed:", e?.message || e);
    return null;
  }
};

const handleFirmwareUpdate = async ({
  device,
  devices,
  verifiedDevices,
  bleManagerRef,
  setBleVisible,
  t,
  setModalMessage,
  setErrorModalVisible,
  setSuccessModalVisible,
  serviceUUID,
  writeCharacteristicUUID,
  notifyCharacteristicUUID,
  setVerificationStatus,
  setCheckStatusModalVisible,
  setCheckStatusProgress,
  openExclusiveModal,
  firmwareUrl,
  deferStart = false,
  registerStart,
  accountId = null,
  syncFirmwareUpdateInfo,
}) => {
  console.log("Firmware Update clicked");
  const showCheckStatusModal = () => {
    if (typeof setCheckStatusModalVisible !== "function") return;
    if (typeof openExclusiveModal === "function") {
      openExclusiveModal(() => setCheckStatusModalVisible(true));
      return;
    }
    setCheckStatusModalVisible(true);
  };
  try {
    const notifyUUID =
      notifyCharacteristicUUID || bluetoothConfig.notifyCharacteristicUUID;

    const startOtaLegacy = async (selectedUrl) => {
      try {
        const { ok, device: readyDevice } = await ensureDeviceReady({
          device,
          devices,
          verifiedDevices,
          setBleVisible,
          openBleModal:
            typeof openExclusiveModal === "function"
              ? () => openExclusiveModal(() => setBleVisible?.(true))
              : undefined,
          bleManagerRef,
        });
        if (!ok || !readyDevice) return;

        const targetDevice = readyDevice;

        try {
          const connected = await targetDevice.isConnected?.();
          if (!connected) {
            await targetDevice.connect();
            console.log("Connected to device for OTA");
          } else {
            console.log("Device already connected, proceeding OTA");
          }
          await targetDevice.discoverAllServicesAndCharacteristics();
          console.log("Services and characteristics discovered for OTA");
        } catch (connErr) {
          console.error("Failed to connect/discover before OTA:", connErr);
          throw connErr;
        }

        // --- 查询设备版本号（1s 超时，超时则沿用已存储的版本） ---
        try {
          await queryDeviceVersion({
            device: targetDevice,
            serviceUUID,
            writeCharacteristicUUID,
            notifyCharacteristicUUID: notifyUUID,
          });
        } catch (e) {
          console.log("OTA: version query failed, using stored versions:", e?.message || e);
        }

        const urlToUse = selectedUrl || firmwareUrl;
        if (!urlToUse) {
          console.log(
            "OTA: no URL provided, waiting for user selection (deferred)"
          );
          return;
        }
        console.log("OTA using firmware URL:", urlToUse);

        let fileName = parseFileNameFromUrl(urlToUse);
        if (!fileName) {
          console.error("OTA Error: Unable to resolve firmware filename from URL:", urlToUse);
          try {
            setVerificationStatus && setVerificationStatus("otaFail");
            showCheckStatusModal();
          } catch {}
          throw new Error("FIRMWARE_NAME_PARSE_FAILED");
        }

        try {
          setVerificationStatus && setVerificationStatus("otaSending");
          showCheckStatusModal();
        } catch {}

        let __lastProgress = -1;
        let __progressScheduled = false;
        const __raf =
          typeof requestAnimationFrame === "function"
            ? requestAnimationFrame
            : (fn) => setTimeout(fn, 16);
        const safeSetProgress = (v) => {
          const nv = Math.max(0, Math.min(1, Number(v)));
          if (!Number.isFinite(nv)) return;
          if (nv <= __lastProgress + 1e-4) return;
          __lastProgress = nv;
          if (__progressScheduled) return;
          __progressScheduled = true;
          __raf(() => {
            try {
              setCheckStatusProgress && setCheckStatusProgress(__lastProgress);
            } finally {
              __progressScheduled = false;
            }
          });
        };
        safeSetProgress(0);

        let firmwareData;
        try {
          if (typeof XMLHttpRequest !== "undefined") {
            await new Promise((resolve, reject) => {
              try {
                const xhr = new XMLHttpRequest();
                xhr.open("GET", urlToUse, true);
                xhr.responseType = "arraybuffer";
                xhr.onprogress = (evt) => {
                  if (evt && evt.lengthComputable) {
                    const frac = Math.max(
                      0,
                      Math.min(1, evt.loaded / evt.total)
                    );
                    try {
                      safeSetProgress(0.2 * frac);
                    } catch {}
                  }
                };
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                      safeSetProgress(0.2);
                    } catch {}
                    resolve(xhr.response);
                  } else {
                    reject(new Error("Download failed"));
                  }
                };
                xhr.onerror = () => reject(new Error("Download failed"));
                xhr.send();
              } catch (e) {
                reject(e);
              }
            }).then((buf) => {
              firmwareData = new Uint8Array(buf);
            });
          } else {
            const response = await fetch(urlToUse);
            if (!response.ok) {
              throw new Error("Download failed");
            }
            const arrayBuffer = await response.arrayBuffer();
            firmwareData = new Uint8Array(arrayBuffer);
            try {
              safeSetProgress(0.2);
            } catch {}
          }
        } catch (e) {
          throw e;
        }

        const fileBytes = firmwareData.length;
        const stuffedFirmware = byteStuffEncode(firmwareData);
        const CHUNK_SIZE = 220;
        const fwChunks = [];
        for (let i = 0; i < stuffedFirmware.length; i += CHUNK_SIZE) {
          fwChunks.push(
            stuffedFirmware.slice(i, Math.min(i + CHUNK_SIZE, stuffedFirmware.length))
          );
        }
        const dataSizeForHeader = stuffedFirmware.length;

        const wordArray = CryptoJS.lib.WordArray.create(stuffedFirmware);
        const md5Hex = CryptoJS.MD5(wordArray).toString();

        const totalFwChunks = fwChunks.length;
        const progressBase = 0.2;
        const progressSpan = 0.8;
        const OTA_PROGRESS_STEP = 5;
        let lastOtaProgress = -1;

        const renderProgressBar = (percent, width = 20) => {
          const clamped = Math.max(0, Math.min(100, percent));
          const filled = Math.round((clamped / 100) * width);
          const empty = width - filled;
          return `[${"#".repeat(filled)}${"-".repeat(empty)}]`;
        };
        const logOtaProgress = (currentPacket) => {
          if (!totalFwChunks) return;
          const percent = Math.floor((currentPacket / totalFwChunks) * 100);
          if (
            percent === 100 ||
            lastOtaProgress < 0 ||
            percent - lastOtaProgress >= OTA_PROGRESS_STEP
          ) {
            lastOtaProgress = percent;
            console.log(
              `OTA progress ${percent}% ${renderProgressBar(percent)} (${currentPacket}/${totalFwChunks})`
            );
          }
        };

        console.log(
          "Firmware downloaded. bytes:",
          fileBytes,
          "md5(stuffed):",
          md5Hex,
          "stuffedLen:",
          dataSizeForHeader,
          "name:",
          fileName,
          "fwChunks:",
          fwChunks.length
        );

        console.log(
          "Enabling notifications on notify characteristic:",
          notifyUUID
        );
        let __notifyReadyResolved = false;
        let __notifyReadyResolve;
        const __notifyReadyPromise = new Promise((resolve) => {
          __notifyReadyResolve = () => {
            if (!__notifyReadyResolved) {
              __notifyReadyResolved = true;
              resolve();
            }
          };
          setTimeout(() => {
            __notifyReadyResolve();
          }, 400);
        });

        const __yieldOnce = () =>
          new Promise((resolve) => {
            if (typeof setImmediate === "function") {
              setImmediate(resolve);
            } else if (typeof requestAnimationFrame === "function") {
              requestAnimationFrame(() => resolve());
            } else {
              Promise.resolve().then(resolve);
            }
          });

        let __sendCounter = 0;
        let headerSent = false;

        const otaTxId = `ota-${
          targetDevice?.id || "unknown"
        }-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const subscription = targetDevice.monitorCharacteristicForService(
          serviceUUID,
          notifyUUID,
          async (error, characteristic) => {
            try {
              __notifyReadyResolve && __notifyReadyResolve();
            } catch {}
            if (error) {
              if (isBleDisconnectError(error)) {
                return;
              }
              console.log("Listening feature error:", error);
              const msg = String(error?.message || "");
              if (
                !/notify change failed/i.test(msg) &&
                !/operation was cancelled/i.test(msg)
              ) {
                return;
              }
            }
            if (!characteristic?.value) return;

            const rxBuf = Buffer.from(characteristic.value, "base64");
            const receivedData = rxBuf.toString("utf-8");
            const receivedClean = receivedData
              .replace(/[\x00-\x1F\x7F]/g, "")
              .trim();

            if (receivedClean === DEVICE_RESPONSES.pwdCorrectText) {
              console.log(
                "Device unlocked (PWD_CORRECT). Ready for OTA text/data."
              );
              return;
            }
            if (receivedClean === DEVICE_RESPONSES.pwdCancelText) {
              console.log(
                "Device unlock canceled (PWD_CANCEL). Continue OTA listening."
              );
              return;
            }

            if (
              receivedClean.startsWith(DEVICE_REQUESTS.getOtaUnderscore) ||
              receivedClean.startsWith(DEVICE_REQUESTS.getOtaSpaced)
            ) {
              const idxStr = parseIndexedDeviceRequest(
                receivedClean,
                DEVICE_REQUESTS.getOtaUnderscore,
                DEVICE_REQUESTS.getOtaSpaced
              );
              const idxMatch = idxStr.match(/\d+/);
              const packetIndex = idxMatch
                ? parseInt(idxMatch[0], 10) - 1
                : NaN;
              if (RUNTIME_DEV) {
                console.log(
                  `Device requested OTA DATA chunk ${
                    (Number.isFinite(packetIndex) ? packetIndex : -1) + 1
                  }`
                );
              }
              if (
                Number.isFinite(packetIndex) &&
                packetIndex >= 0 &&
                packetIndex < fwChunks.length
              ) {
                logOtaProgress(packetIndex + 1);
                const chunk = fwChunks[packetIndex];
                const pkt = new Uint8Array(chunk.length + 2);
                pkt.set(chunk);
                pkt[chunk.length] = 0x0d;
                pkt[chunk.length + 1] = 0x0a;
                const tx = Buffer.from(pkt).toString("base64");
                try {
                  __sendCounter++;
                  if (__sendCounter % 10 === 0) {
                    await __yieldOnce();
                  }
                  await targetDevice.writeCharacteristicWithoutResponseForService(
                    serviceUUID,
                    writeCharacteristicUUID,
                    tx
                  );
                  try {
                    const sentRatio = Math.min(
                      (packetIndex + 1) / totalFwChunks,
                      1
                    );
                    safeSetProgress(progressBase + progressSpan * sentRatio);
                  } catch {}
                } catch (e) {
                  console.log("Data chunk write failed:", e);
                }
              } else {
                console.log(
                  `Invalid OTA DATA chunk index requested: ${packetIndex + 1}`
                );
              }
              return;
            }

            if (receivedClean === DEVICE_RESPONSES.otaFinish) {
              console.log(
                "OTA data transfer completed successfully (device reported OTA_FINISH)"
              );
              try {
                await AsyncStorage.setItem(OTA_TRANSFER_COMPLETED_KEY, "1");
              } catch {}
              try {
                typeof syncFirmwareUpdateInfo === "function" &&
                  (await syncFirmwareUpdateInfo(false, {
                    transferCompleted: true,
                  }));
              } catch {}
              try {
                safeSetProgress(1);
              } catch {}
              try {
                setVerificationStatus && setVerificationStatus("otaInstalling");
                showCheckStatusModal();
              } catch {}
              // Add reboot command after sending the package
              try {
                const rebootMsg = frameBle(bleCmd.otaReboot());
                await targetDevice.writeCharacteristicWithoutResponseForService(
                  serviceUUID,
                  writeCharacteristicUUID,
                  rebootMsg
                );
                console.log("BLE TX -> otaReboot sent after OTA_FINISH");
              } catch (e) {
                console.log("otaReboot write failed:", e);
              }
              return;
            }
            if (receivedClean === DEVICE_RESPONSES.otaOk) {
              console.log("OTA install finished OK");
              try {
                setVerificationStatus && setVerificationStatus("otaSuccess");
                showCheckStatusModal();
              } catch {}
              try {
                const Platform = require("react-native").Platform;
                if (Platform?.OS !== "android") {
                  subscription.remove();
                }
              } catch {}
              return;
            }
            if (receivedClean === DEVICE_RESPONSES.otaFail) {
              console.log("OTA install failed");
              try {
                setVerificationStatus && setVerificationStatus("otaFail");
                showCheckStatusModal();
              } catch {}
              try {
                const Platform = require("react-native").Platform;
                if (Platform?.OS !== "android") {
                  subscription.remove();
                }
              } catch {}
              return;
            }
          },
          otaTxId
        );

        await __notifyReadyPromise;
        try {
          setVerificationStatus && setVerificationStatus("otaSending");
          showCheckStatusModal();
        } catch {}
        const textHeader =
          bleCmd.otaStart(fileName, dataSizeForHeader, md5Hex) + "\r\n";
        console.log("BLE TX -> OTA header:", textHeader);
        const txTextHeader = Buffer.from(textHeader, "utf-8").toString(
          "base64"
        );
        try {
          await targetDevice.writeCharacteristicWithoutResponseForService(
            serviceUUID,
            writeCharacteristicUUID,
            txTextHeader
          );
        } catch (e) {
          console.log("OTA header write failed:", e);
        }
        headerSent = true;
        console.log(
          "OTA header sent. Waiting for GET_OTA_n requests..."
        );
      } catch (e) {
        console.log("startOta error:", e);
        throw e;
      }
    };

    const startOtaZip = async (selectedUrl) => {
      try {
        const { ok, device: readyDevice } = await ensureDeviceReady({
          device,
          devices,
          verifiedDevices,
          setBleVisible,
          openBleModal:
            typeof openExclusiveModal === "function"
              ? () => openExclusiveModal(() => setBleVisible?.(true))
              : undefined,
          bleManagerRef,
        });
        if (!ok || !readyDevice) return;

        const urlToUse = selectedUrl || firmwareUrl;
        if (!urlToUse) {
          console.log(
            "OTA: no URL provided, waiting for user selection (deferred)"
          );
          return;
        }
        console.log("OTA using firmware URL:", urlToUse);

        try {
          setVerificationStatus && setVerificationStatus("otaSending");
          showCheckStatusModal();
        } catch {}

        const deviceAddress = readyDevice?.id || device?.id;
        if (!deviceAddress) {
          console.error("OTA Error: missing deviceAddress for DFU");
          try {
            setVerificationStatus && setVerificationStatus("otaFail");
            showCheckStatusModal();
          } catch {}
          throw new Error("DFU_DEVICE_ADDRESS_REQUIRED");
        }

        const fs = getFileSystem();
        const baseDir = fs.documentDirectory || fs.cacheDirectory || "";
        if (!baseDir) {
          console.error(
            "OTA Error: missing FileSystem.documentDirectory/cacheDirectory"
          );
          try {
            setVerificationStatus && setVerificationStatus("otaFail");
            showCheckStatusModal();
          } catch {}
          throw new Error("FILE_SYSTEM_NOT_READY");
        }

        const localPath = `${baseDir}firmware.zip`;
        try {
          setCheckStatusProgress && setCheckStatusProgress(0);
        } catch {}
        const fileUri = await downloadFirmware(urlToUse, localPath, (ratio) => {
          try {
            setCheckStatusProgress && setCheckStatusProgress(0.2 * ratio);
          } catch {}
        });

        await startNordicDfu({
          deviceAddress,
          fileUri,
          setCheckStatusProgress,
          setVerificationStatus,
          setCheckStatusModalVisible,
          openExclusiveModal,
          syncFirmwareUpdateInfo,
        });
      } catch (e) {
        console.log("startOtaZip error:", e);
        throw e;
      }
    };

    const startByType = async (url) => {
      if (isBluetoothFirmware(url)) {
        console.log("[OTA] BL firmware detected -> Secure DFU");
        return startOtaZip(url);
      }
      console.log("[OTA] HW firmware detected -> legacy OTA");
      return startOtaLegacy(url);
    };

    if (deferStart) {
      try {
        const fn =
          typeof registerStart === "function" ? registerStart : () => {};
        fn((url) => startByType(url));
      } catch (e) {
        console.log("registerStart failed:", e);
      }
      return;
    }

    await startByType(firmwareUrl);
  } catch (error) {
    console.log("Firmware update error:", error);
    try {
      setVerificationStatus && setVerificationStatus("otaFail");
      showCheckStatusModal();
    } catch {}
  }
};

export default handleFirmwareUpdate;
