/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import i18n from "../config/i18n";
import { isBleDisconnectError } from "./bleErrors";
import { RUNTIME_DEV } from "./runtimeFlags";
import {
  createBleTransactionId,
  safeRemoveSubscription,
} from "./bleSubscription";
import { byteStuffEncode } from "./byteStuff";
import { getSecureItem } from "./secureStorage";
import { bleCmd, frameBle, parseResp } from "./bleProtocol";
import { ensureScreenUnlocked } from "./ensureScreenUnlocked";
import {
  DEVICE_REQUESTS,
  DEVICE_RESPONSES,
  parseIndexedDeviceRequest,
} from "./deviceProtocolConstants";
/**
  * Save NFT to device (send pictures and text via Bluetooth)
 * @param {Object} params
 * @param {Object} params.selectedNFT
 * @param {Object} params.device
 * @param {Object} params.ImageManipulator
 * @param {Object} params.FileSystem
 * @param {Object} params.Buffer
 * @param {string} params.serviceUUID
 * @param {string} params.writeCharacteristicUUID
 * @param {string} params.notifyCharacteristicUUID
 * @returns {Promise<void>}
 */
export const handleSaveToDevice = async ({
  selectedNFT,
  device,
  ImageManipulator,
  FileSystem,
  Buffer,
  serviceUUID,
  writeCharacteristicUUID,
  notifyCharacteristicUUID,
  setVerificationStatus,
  setCheckStatusModalVisible,
  setCheckStatusProgress,
}) => {
  let targetDevice = device;
  if (!targetDevice) {
    console.log("[NFT_FLOW] The device object is missing and device pre-flight needs to be completed first.");
    return;
  }

  // Keep track of all BLE subscriptions created in this process and ensure they are removed before disconnecting
  const activeSubs = new Set();
  const removeAllActiveSubs = () => {
    try {
      for (const sub of Array.from(activeSubs)) {
        try {
          safeRemoveSubscription(sub);
        } catch {}
        activeSubs.delete(sub);
      }
      console.log("[NFT_FLOW] All active subscriptions removed");
    } catch {}
  };

  // Unified disconnect tool: Make sure to cancel all subscriptions before the NFT process ends, and then disconnect Bluetooth (idempotent, only executed once)
  let __nftDisconnectedOnce = false;
  const __scheduleNftDisconnect = (cause = "nft_flow_end", delayMs = 800) => {
    try {
      const dev = targetDevice;
      if (!dev || typeof dev.isConnected !== "function") return;
      setTimeout(
        async () => {
          if (__nftDisconnectedOnce) return;
          try {
            // First remove all established subscriptions to avoid still triggering callbacks when disconnected
            removeAllActiveSubs();
            // Delay slightly to ensure that the native side monitor is released
            await new Promise((r) => setTimeout(r, 30));

            const isConn = await dev.isConnected();
            if (isConn) {
              await dev.cancelConnection();
              console.log(`[NFT_FLOW] Device disconnected: ${dev.id} cause=${cause}`);
            } else {
              console.log(
                `[NFT_FLOW] Device already disconnected: ${dev?.id} cause=${cause}`
              );
            }
          } catch (e) {
            console.log("[NFT_FLOW] Error disconnecting device (ignorable):", e?.message || e);
          } finally {
            __nftDisconnectedOnce = true;
          }
        },
        Number.isFinite(delayMs) ? delayMs : 0
      );
    } catch {}
  };

  // Note: "NFT sending started" will be prompted only after the transfer actually starts.

  if (selectedNFT?.logoUrl) {
    try {
      // The React Native/Expo environment does not support URL.createObjectURL. Instead, download it locally and then compress it.
      const url = selectedNFT.logoUrl;
      const srcPath =
        (FileSystem.cacheDirectory || FileSystem.documentDirectory) +
        "nft_src.jpg";
      try {
        const dl = await FileSystem.downloadAsync(url, srcPath);
        console.log("NFT source image has been downloaded:", dl?.uri);
      } catch (e) {
        console.log("Failed to download NFT source image:", e?.message || e);
        throw e;
      }

      // Generate JPEG images in two sizes: 420x420 and 210x210
      const resizedImage420 = await ImageManipulator.manipulateAsync(
        srcPath,
        [{ resize: { width: 420, height: 420 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      const resizedImage210 = await ImageManipulator.manipulateAsync(
        srcPath,
        [{ resize: { width: 210, height: 210 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Read 420 images as base64 → decode to raw bytes → byte-stuff encoded
      const fileData420 = await FileSystem.readAsStringAsync(
        resizedImage420.uri,
        {
          encoding: FileSystem.EncodingType.Base64,
        }
      );
      const rawImg420 = new Uint8Array(Buffer.from(fileData420, "base64"));
      const stuffedImg420 = byteStuffEncode(rawImg420);

      if (!targetDevice) {
        console.log("No device selected, data cannot be sent");
        return;
      }

      try {
        // Make sure the device is connected and all services and features are discovered
        if (typeof targetDevice.isConnected === "function") {
          let already = false;
          try {
            already = await targetDevice.isConnected();
          } catch {
            already = false;
          }
          if (!already) {
            await targetDevice.connect();
          }
        } else {
          await targetDevice.connect();
        }
        await targetDevice.discoverAllServicesAndCharacteristics();

        if (RUNTIME_DEV) {
          console.log(
            "NFT IMG420 raw bytes:",
            rawImg420.length,
            "stuffed bytes:",
            stuffedImg420.length
          );
        }

        // Send collectionName of nft with header flag "DATA_NFT_TEXT"
        if (selectedNFT?.name) {
          const collectionName = selectedNFT.name;
          // Calculate byte length
          const collectionNameBytesLength = Buffer.byteLength(
            collectionName,
            "utf-8"
          );
          console.log("NFT TEXT bytes length:", collectionNameBytesLength);

          let textTotalBytes =
            collectionNameBytesLength || (collectionName?.length ?? 0);
          let textAccumBytes = 0;
          const imgTotalBytes = stuffedImg420.length;
          let imgAccumBytes = 0;
          const IMG_PROGRESS_STEP = 5;
          let lastImgProgress = -1;
          const totalImgPackets = Math.ceil(imgTotalBytes / 220) || 0;

          // Security setting progress, range 0~1
          const __safeSetProgress = (v) => {
            try {
              if (typeof setCheckStatusProgress === "function") {
                const clamped = Math.max(0, Math.min(1, v || 0));
                setCheckStatusProgress(clamped);
              }
            } catch {}
          };
          const NFT_STALL_TIMEOUT_MS = 5000;
          let nftStallTimeoutId = null;
          let nftFinished = false;
          const __clearNftStallTimeout = () => {
            if (nftStallTimeoutId) {
              clearTimeout(nftStallTimeoutId);
              nftStallTimeoutId = null;
            }
          };
          const __startNftStallTimeout = () => {
            if (nftFinished) return;
            __clearNftStallTimeout();
            nftStallTimeoutId = setTimeout(() => {
              if (nftFinished) return;
              console.log("[NFT_TIMEOUT] stalled");
              try {
                setVerificationStatus && setVerificationStatus("nftFail");
              } catch {}
              try {
                setCheckStatusModalVisible && setCheckStatusModalVisible(true);
              } catch {}
              try {
                __safeSetProgress(0);
              } catch {}
              try {
                __scheduleNftDisconnect("nftStall", 800);
              } catch {}
            }, NFT_STALL_TIMEOUT_MS);
          };
          const __bumpNftActivity = () => {
            __startNftStallTimeout();
          };
          const __updateProgress = () => {
            const total = (textTotalBytes || 0) + (imgTotalBytes || 0);
            if (total > 0) {
              const current =
                Math.min(textAccumBytes, textTotalBytes) +
                Math.min(imgAccumBytes, imgTotalBytes);
              __safeSetProgress(current / total);
            }
          };
          const renderProgressBar = (percent, width = 20) => {
            const clamped = Math.max(0, Math.min(100, percent));
            const filled = Math.round((clamped / 100) * width);
            const empty = width - filled;
            return `[${"#".repeat(filled)}${"-".repeat(empty)}]`;
          };
          const logImgProgress = (currentPacket) => {
            if (!totalImgPackets) return;
            const percent = Math.floor((currentPacket / totalImgPackets) * 100);
            if (
              percent === 100 ||
              lastImgProgress < 0 ||
              percent - lastImgProgress >= IMG_PROGRESS_STEP
            ) {
              lastImgProgress = percent;
              console.log(
                `IMG420 progress ${percent}% ${renderProgressBar(
                  percent
                )} (${currentPacket}/${totalImgPackets})`
              );
            }
          };

          // Read accountId (reqNftCollect command will carry this field, device-side verification)
          const storedAccountId =
            (await getSecureItem("accountId", ["currentAccountId"])) ?? "";

          // Check device screen lock state before reqNftCollect
          try {
            await ensureScreenUnlocked(targetDevice, { label: "NFT_FLOW", activeSubs });
          } catch (screenErr) {
            const msg = String(screenErr?.message || screenErr);
            console.log("[NFT_FLOW] screen check failed:", msg);
            if (msg === "SCREEN_PWD_CANCEL") {
              try { setVerificationStatus && setVerificationStatus(null); } catch {}
              try { setCheckStatusModalVisible && setCheckStatusModalVisible(false); } catch {}
              try {
                if (typeof global !== "undefined" && typeof global.__SHOW_APP_TOAST__ === "function") {
                  setTimeout(() => {
                    global.__SHOW_APP_TOAST__({
                      message: i18n.t("NFT sending canceled"),
                      variant: "cancel",
                      durationMs: 3000,
                      showCountdown: true,
                    });
                  }, 200);
                }
              } catch {}
              try { __safeSetProgress(0); } catch {}
              try { __scheduleNftDisconnect("screenPwdCancel", 800); } catch {}
              __clearNftStallTimeout();
              return;
            }
            // SCREEN_CHECK_TIMEOUT or other errors
            try { setVerificationStatus && setVerificationStatus("nftFail"); } catch {}
            try { setCheckStatusModalVisible && setCheckStatusModalVisible(true); } catch {}
            try { __safeSetProgress(0); } catch {}
            __clearNftStallTimeout();
            try { __scheduleNftDisconnect("screenCheckFail", 800); } catch {}
            return;
          }

          // Send a confirmation command to the device and ask the device to pop up the "Do you want to collect this NFT?" page
          try {
            try {
              const confirmResult = await new Promise((resolve, reject) => {
                let settled = false;

                // Small "listen ready latch" to prevent commands from being written before the listener is ready
                const __CONFIRM_notifyReady = (() => {
                  let readyResolved = false;
                  let readyResolveFn;
                  const p = new Promise((r) => {
                    readyResolveFn = () => {
                      if (!readyResolved) {
                        readyResolved = true;
                        r();
                      }
                    };
                    // Fallback: Some platforms will not call back immediately and will be considered ready after 400ms, reducing dead time.
                    setTimeout(() => {
                      try {
                        readyResolveFn && readyResolveFn();
                      } catch {}
                    }, 400);
                  });
                  return {
                    resolve: () => {
                      try {
                        readyResolveFn && readyResolveFn();
                      } catch {}
                    },
                    promise: p,
                  };
                })();

                const confTxId = createBleTransactionId(
                  "nft-confirm",
                  targetDevice?.id
                );
                const sub = targetDevice.monitorCharacteristicForService(
                  serviceUUID,
                  notifyCharacteristicUUID,
                  (error, characteristic) => {
                    // Any first callback is deemed as the notification channel is ready.
                    try {
                      __CONFIRM_notifyReady.resolve();
                    } catch {}

                    if (error) {
                      if (!settled) {
                        settled = true;
                        try {
                          safeRemoveSubscription(sub);
                          activeSubs.delete(sub);
                        } catch {}
                        if (isBleDisconnectError(error)) {
                          resolve({ disconnected: true });
                          return;
                        }
                        reject(error);
                      }
                      return;
                    }
                    if (!characteristic?.value) return;

                    const rxBase64 = characteristic.value;
                    const rxBuf = Buffer.from(characteristic.value, "base64");
                    const rx = rxBuf.toString("utf-8");
                    const clean = rx.replace(/[\x00-\x1F\x7F]/g, "").trim();
                    console.log(
                      "BLE RX (confirm) base64:",
                      rxBase64,
                      "hex:",
                      rxBuf.toString("hex")
                    );
                    console.log("Device response received during confirmation phase:", clean);

                    if (
                      !settled &&
                      (() => {
                        const p = parseResp(clean);
                        return p?.resp === "nftContinue" || clean === "NFT_CONTINUE" || clean === "NFT CONTINUE";
                      })()
                    ) {
                      settled = true;
                      try {
                        safeRemoveSubscription(sub);
                        activeSubs.delete(sub);
                      } catch {}
                      resolve("continue");
                    } else if (
                      !settled &&
                      (() => {
                        const p = parseResp(clean);
                        return p?.resp === "nftCancel" || clean === "NFT_CANCEL" || clean === "NFT CANCEL";
                      })()
                    ) {
                      settled = true;
                      try {
                        safeRemoveSubscription(sub);
                        activeSubs.delete(sub);
                      } catch {}
                      reject(new Error("NFT_CANCELLED"));
                    } else if (
                      !settled &&
                      (() => {
                        const p = parseResp(clean);
                        return p?.resp === "accountIdFail" || clean.includes("ACCOUNT_ID_FAIL");
                      })()
                    ) {
                      settled = true;
                      try {
                        safeRemoveSubscription(sub);
                        activeSubs.delete(sub);
                      } catch {}
                      reject(new Error("ACCOUNT_ID_FAIL"));
                    }
                  },
                  // Pass in an explicit transactionId
                  confTxId
                );
                try {
                  activeSubs.add(sub);
                } catch {}

                // Turn on listening before sending the command (wait for "ready" or 400ms)
                (async () => {
                  try {
                    await __CONFIRM_notifyReady.promise;
                    const confirmCmd = bleCmd.reqNftCollect(storedAccountId) + "\r\n";
                    const confirmCmdB64 = Buffer.from(
                      confirmCmd,
                      "utf-8"
                    ).toString("base64");
                    await targetDevice.writeCharacteristicWithResponseForService(
                      serviceUUID,
                      writeCharacteristicUUID,
                      confirmCmdB64
                    );
                    console.log(
                      `${DEVICE_REQUESTS.reqNftCollectText} sent to device, waiting for user selection on the device...`
                    );
                  } catch (e) {
                    if (!settled) {
                      settled = true;
                      try {
                        safeRemoveSubscription(sub);
                      } catch {}
                      reject(e);
                    }
                  }
                })();

                // 60s timeout: device must respond to reqNftCollect
                setTimeout(() => {
                  if (!settled) {
                    settled = true;
                    try {
                      safeRemoveSubscription(sub);
                      activeSubs.delete(sub);
                    } catch {}
                    reject(new Error("NFT_CONFIRM_TIMEOUT"));
                  }
                }, 60000);
              });
              if (confirmResult?.disconnected) {
                console.log("The device has been disconnected, terminating the NFT confirmation process");
                return;
              }

              // User selects Continue: Start displaying progress and continue data sending
              try {
                setVerificationStatus && setVerificationStatus("nftSaving");
              } catch {}
              try {
                setCheckStatusModalVisible && setCheckStatusModalVisible(true);
              } catch {}
              // Initialization progress is 0
              try {
                __safeSetProgress(0);
              } catch {}
              __startNftStallTimeout();
            } catch (confirmErr) {
              const msg = String(confirmErr?.message || confirmErr);
              if (msg === "NFT_CANCELLED") {
                // User cancellation: Close Modal and use toast prompt instead
                try {
                  setVerificationStatus && setVerificationStatus(null);
                } catch {}
                try {
                  setCheckStatusModalVisible &&
                    setCheckStatusModalVisible(false);
                } catch {}
                try {
                  if (
                    typeof global !== "undefined" &&
                    typeof global.__SHOW_APP_TOAST__ === "function"
                  ) {
                    setTimeout(() => {
                      global.__SHOW_APP_TOAST__({
                        message: i18n.t("NFT sending canceled"),
                        variant: "cancel",
                        durationMs: 3000,
                        showCountdown: true,
                      });
                    }, 200);
                  }
                } catch {}
                // Reset progress on cancel
                try {
                  __safeSetProgress(0);
                } catch {}
                // Cancellation is considered the end of the process → active disconnection
                try {
                  __scheduleNftDisconnect("nftCancelled", 800);
                } catch {}
                __clearNftStallTimeout();
                return;
              } else {
                // Other errors or timeouts: thrown to outer error handling
                throw confirmErr;
              }
            }
          } catch (err) {
            console.log(
              "NFT confirmation flow failed or timed out:",
              err?.message || err
            );
            if (err?.message === "ACCOUNT_ID_FAIL") {
              try {
                setVerificationStatus &&
                  setVerificationStatus("accountMismatch");
              } catch {}
              try {
                setCheckStatusModalVisible && setCheckStatusModalVisible(true);
              } catch {}
            } else if (err?.message === "NFT_CONFIRM_TIMEOUT") {
              // No device response within timeout → show error and disconnect BLE
              try {
                setVerificationStatus && setVerificationStatus("nftFail");
              } catch {}
              try {
                setCheckStatusModalVisible && setCheckStatusModalVisible(true);
              } catch {}
            }
            __clearNftStallTimeout();
            try {
              __scheduleNftDisconnect(
                err?.message === "ACCOUNT_ID_FAIL"
                  ? "accountIdFail"
                  : "nftConfirmError",
                800
              );
            } catch {}
            return;
          }

          // Note: The text header will be sent after notification monitoring is enabled and readiness is confirmed to avoid packet loss.

          // After DATA_NFT_TEXT is sent, start sending DATA_NFT_IMG data
          const sendNFTImgData = async () => {
            // Sending image data: first turn on the notification and confirm that it is ready, and then send the IMG header to avoid the device returning GET_IMG_1 too quickly, causing packet loss.
            const __IMG_notifyReady = (() => {
              let resolved = false;
              let resolveFn;
              const p = new Promise((resolve) => {
                resolveFn = () => {
                  if (!resolved) {
                    resolved = true;
                    resolve();
                  }
                };
                setTimeout(() => {
                  resolveFn();
                }, 400);
              });
              return { resolve: () => resolveFn && resolveFn(), promise: p };
            })();

            const imgTxId = createBleTransactionId("nft-img", targetDevice?.id);
            const subscription420 =
              targetDevice.monitorCharacteristicForService(
                serviceUUID,
                notifyCharacteristicUUID,
                async (error, characteristic) => {
                  try {
                    __IMG_notifyReady.resolve();
                  } catch {}
                  if (error) {
                    if (isBleDisconnectError(error)) {
                      return;
                    }
                    console.log("Listening feature error:", error);
                    return;
                  }
                  if (!characteristic?.value) return;

                  // Decode received Base64 data
                  const receivedData = Buffer.from(
                    characteristic.value,
                    "base64"
                  ).toString("utf-8");
                  const receivedClean = receivedData
                    .replace(/[\x00-\x1F\x7F]/g, "")
                    .trim();
                  __bumpNftActivity();

                  // Compatible with both underscore and space versions: GET_IMG_n / GET IMG n
                  if (
                    receivedClean.startsWith(DEVICE_REQUESTS.getImgUnderscore) ||
                    receivedClean.startsWith(DEVICE_REQUESTS.getImgSpaced)
                  ) {
                    const idxStr = parseIndexedDeviceRequest(
                      receivedClean,
                      DEVICE_REQUESTS.getImgUnderscore,
                      DEVICE_REQUESTS.getImgSpaced
                    );
                    const packetIndex = parseInt(idxStr, 10) - 1;

                    if (
                      Number.isFinite(packetIndex) &&
                      packetIndex >= 0 &&
                      packetIndex * 220 < stuffedImg420.length
                    ) {
                      if (RUNTIME_DEV) {
                        console.log(
                          "BLE RX (IMG) request:",
                          receivedClean,
                          "-> chunk",
                          packetIndex + 1
                        );
                      }
                      const start = packetIndex * 220;
                      const end = Math.min(start + 220, stuffedImg420.length);
                      const chunk = stuffedImg420.slice(start, end);
                      const pkt = new Uint8Array(chunk.length + 2);
                      pkt.set(chunk);
                      pkt[chunk.length] = 0x0d;
                      pkt[chunk.length + 1] = 0x0a;

                      try {
                        const chunkBase64 = Buffer.from(pkt).toString("base64");
                        logImgProgress(packetIndex + 1);
                        if (RUNTIME_DEV) {
                          console.log(
                            `BLE TX -> IMG420 chunk ${packetIndex + 1}: bytes=${
                              chunk.length
                            }, b64=${chunkBase64.length}`
                          );
                        }
                        await targetDevice.writeCharacteristicWithResponseForService(
                          serviceUUID,
                          writeCharacteristicUUID,
                          chunkBase64
                        );
                        __bumpNftActivity();
                        try {
                          imgAccumBytes = Math.max(imgAccumBytes, end);
                          __updateProgress();
                        } catch {}
                      } catch (e) {
                        console.log("Sending 420 Image Packet Error:", e);
                        try {
                          await targetDevice.writeCharacteristicWithoutResponseForService(
                            serviceUUID,
                            writeCharacteristicUUID,
                            Buffer.from(pkt).toString("base64")
                          );
                          __bumpNftActivity();
                          try {
                            imgAccumBytes = Math.max(imgAccumBytes, end);
                            __updateProgress();
                          } catch {}
                        } catch (e2) {}
                      }
                    }
                  } else if (
                    receivedData === `${DEVICE_RESPONSES.imgFinish}\r\n` ||
                    receivedClean === DEVICE_RESPONSES.imgFinish
                  ) {
                    console.log("Image data transfer completed");
                    nftFinished = true;
                    __clearNftStallTimeout();
                    try {
                      imgAccumBytes = imgTotalBytes;
                      __updateProgress();
                      __safeSetProgress(1);
                    } catch {}
                    try {
                      setVerificationStatus &&
                        setVerificationStatus("nftSaved");
                    } catch {}
                    try {
                      setCheckStatusModalVisible &&
                        setCheckStatusModalVisible(true);
                    } catch {}
                    try {
                      safeRemoveSubscription(subscription420);
                      activeSubs.delete(subscription420);
                    } catch {}
                    // The NFT process is all completed → actively disconnected
                    try {
                      __scheduleNftDisconnect("nftSaved", 800);
                    } catch {}
                  }
                },
                // Pass in an explicit transactionId
                imgTxId
              );
            try {
              activeSubs.add(subscription420);
            } catch {}

            // Wait for the notification channel to be ready before sending the picture header
            await __IMG_notifyReady.promise;
            const header420 =
              bleCmd.nftImg(stuffedImg420.length) + "\r\n";
            const header420Base64 = Buffer.from(header420, "utf-8").toString(
              "base64"
            );
            if (RUNTIME_DEV) {
              console.log("BLE TX -> IMG420 header:", header420);
            }
            await targetDevice.writeCharacteristicWithResponseForService(
              serviceUUID,
              writeCharacteristicUUID,
              header420Base64
            );
          };

          // Listen to the notification of DATA_NFT_TEXT and trigger the sending of image data after receiving TEXT_FINISH
          // Listen for data_NFT_text notifications: Turn on the monitor and confirm you're ready, then send the text header to prevent the device from returning get_text_1 too quickly and causing packet loss
          const __TEXT_notifyReady = (() => {
            let resolved = false;
            let resolveFn;
            const p = new Promise((resolve) => {
              resolveFn = () => {
                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              };
              // Fallback: Some platforms will not call back immediately and will be considered ready after 400ms, reducing dead time.
              setTimeout(() => {
                resolveFn();
              }, 400);
            });
            return { resolve: () => resolveFn && resolveFn(), promise: p };
          })();

          const txtTxId = createBleTransactionId("nft-text", targetDevice?.id);
          const textSubscription = targetDevice.monitorCharacteristicForService(
            serviceUUID,
            notifyCharacteristicUUID,
            async (error, characteristic) => {
              try {
                __TEXT_notifyReady.resolve();
              } catch {}
              if (error) {
                if (isBleDisconnectError(error)) {
                  return;
                }
                console.log("Listening feature error:", error);
                return;
              }
              if (!characteristic?.value) return;

              const receivedData = Buffer.from(
                characteristic.value,
                "base64"
              ).toString("utf-8");
              const receivedClean = receivedData
                .replace(/[\x00-\x1F\x7F]/g, "")
                .trim();
              __bumpNftActivity();

              // Compatible with both underscore and space versions of the command: GET_TEXT_n / GET TEXT n
              if (
                receivedClean.startsWith(DEVICE_REQUESTS.getTextUnderscore) ||
                receivedClean.startsWith(DEVICE_REQUESTS.getTextSpaced)
              ) {
                const idxStr = parseIndexedDeviceRequest(
                  receivedClean,
                  DEVICE_REQUESTS.getTextUnderscore,
                  DEVICE_REQUESTS.getTextSpaced
                );
                const packetIndex = parseInt(idxStr, 10) - 1;

                if (
                  Number.isFinite(packetIndex) &&
                  packetIndex >= 0 &&
                  packetIndex * 220 < collectionName.length
                ) {
                  const start = packetIndex * 220;
                  const end = Math.min(start + 220, collectionName.length);
                  let chunk = collectionName.substring(start, end);

                  // Protocol change: Each packet ends with \r\n to facilitate embedded per-packet separation
                  chunk += "\r\n";

                  try {
                    const chunkBase64 = Buffer.from(chunk, "utf-8").toString(
                      "base64"
                    );
                    console.log(
                      `BLE TX -> TEXT chunk ${packetIndex + 1}: bytes=${
                        chunk.length
                      }, b64=${chunkBase64.length}`
                    );
                      await targetDevice.writeCharacteristicWithResponseForService(
                        serviceUUID,
                        writeCharacteristicUUID,
                        chunkBase64
                      );
                      __bumpNftActivity();
                    // Cumulative text bytes sent after successful writing (not counting \r\n)
                    try {
                      const noCRLF = chunk.endsWith("\r\n")
                        ? chunk.slice(0, -2)
                        : chunk;
                      const bytesThis = Buffer.byteLength(noCRLF, "utf-8");
                      textAccumBytes = Math.min(
                        textTotalBytes,
                        textAccumBytes + Math.max(0, bytesThis)
                      );
                      __updateProgress();
                    } catch {}
                  } catch (e) {
                    console.log("Error sending collectionName packet:", e);
                    // Try to avoid non-responsive writing to reduce blocking caused by platform differences.
                    try {
                        await targetDevice.writeCharacteristicWithoutResponseForService(
                          serviceUUID,
                          writeCharacteristicUUID,
                          Buffer.from(chunk, "utf-8").toString("base64")
                        );
                        __bumpNftActivity();
                      // Progress will also be accumulated after writing in full
                      try {
                        const noCRLF = chunk.endsWith("\r\n")
                          ? chunk.slice(0, -2)
                          : chunk;
                        const bytesThis = Buffer.byteLength(noCRLF, "utf-8");
                        textAccumBytes = Math.min(
                          textTotalBytes,
                          textAccumBytes + Math.max(0, bytesThis)
                        );
                        __updateProgress();
                      } catch {}
                    } catch (e2) {}
                  }
                }
              } else if (
                receivedData === `${DEVICE_RESPONSES.textFinish}\r\n` ||
                receivedClean === DEVICE_RESPONSES.textFinish
              ) {
                console.log("Text data transfer completed");
                __bumpNftActivity();
                // The text phase ends and the text progress is completed.
                try {
                  textAccumBytes = textTotalBytes;
                  __updateProgress();
                } catch {}
                try {
                  safeRemoveSubscription(textSubscription);
                  activeSubs.delete(textSubscription);
                } catch {}
                // Send image data after text is completed
                await sendNFTImgData();
              }
            },
            // Pass in an explicit transactionId
            txtTxId
          );
          try {
            activeSubs.add(textSubscription);
          } catch {}

          // Wait for the notification channel to be ready before sending the TEXT header
          await __TEXT_notifyReady.promise;
          const collectionNameHeader =
            bleCmd.nftText(collectionNameBytesLength) + "\r\n";
          const collectionNameHeaderBase64 = Buffer.from(
            collectionNameHeader,
            "utf-8"
          ).toString("base64");
          console.log("BLE TX -> TEXT header:", collectionNameHeader);
          console.log(
            "BLE TX -> TEXT header base64:",
            collectionNameHeaderBase64
          );
          await targetDevice.writeCharacteristicWithResponseForService(
            serviceUUID,
            writeCharacteristicUUID,
            collectionNameHeaderBase64
          );
        }
      } catch (error) {
        console.log("Error while sending bin file:", error);
        try {
          __scheduleNftDisconnect("nftSendError", 800);
        } catch {}
      }
    } catch (error) {
      console.log("Error fetching image or converting to JPEG .bin:", error);
      try {
        __scheduleNftDisconnect("imagePrepareError", 800);
      } catch {}
    }
  }
};
