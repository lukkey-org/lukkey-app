/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { Buffer } from "buffer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { bluetoothConfig } from "../../env/bluetoothConfig";
import { accountAPI, signAPI, pushAPI } from "../../env/apiEndpoints";
import { isBleDisconnectError } from "../../utils/bleErrors";
import { bleCmd, frameBle, parseResp } from "../../utils/bleProtocol";
import {
  areAddressesEquivalent,
  deriveBchAddressFormats,
  isBchChainName,
} from "../../config/networkUtils";

const serviceUUID = bluetoothConfig.serviceUUID;
const writeCharacteristicUUID = bluetoothConfig.writeCharacteristicUUID;
const notifyCharacteristicUUID = bluetoothConfig.notifyCharacteristicUUID;
const LOG_GREEN = "\x1b[32m";
const LOG_RED = "\x1b[31m";
const LOG_RESET = "\x1b[0m";
const logFlowStep = (step, title, meaning, meta) => {
  const line = "=".repeat(64);
  console.log(`${LOG_GREEN}${line}${LOG_RESET}`);
  console.log(
    `${LOG_GREEN}[SIGN_FLOW][${step}] ${title}${LOG_RESET} ${
      meaning ? `| ${meaning}` : ""
    }`,
    meta || ""
  );
  console.log(`${LOG_GREEN}${line}${LOG_RESET}`);
};
const logFlowEnd = (title, meta) => {
  const line = "=".repeat(64);
  console.log(`${LOG_RED}${line}${LOG_RESET}`);
  console.log(`${LOG_RED}${title}${LOG_RESET}`, meta || "");
  console.log(`${LOG_RED}${line}${LOG_RESET}`);
};
const logDevCopyPayload = ({ chain, address, orderId, stage = "FLOW_END" }) => {
  const line = "=".repeat(64);
  const payload = {
    chain: chain || "",
    address: address || "",
    orderId: orderId || "",
  };
  console.log(`${LOG_GREEN}${line}${LOG_RESET}`);
  console.log(
    `${LOG_GREEN}[DEV_COPY_ONLY][${stage}] For developer copy/debug only (no business meaning)${LOG_RESET}`
  );
  console.log(`${LOG_GREEN}COPY_JSON_START${LOG_RESET}`);
  console.log(`${LOG_GREEN}${JSON.stringify(payload, null, 2)}${LOG_RESET}`);
  console.log(`${LOG_GREEN}COPY_JSON_END${LOG_RESET}`);
  console.log(`${LOG_GREEN}${line}${LOG_RESET}`);
};

const isMsgSuccess = (msg) => {
  const normalized = typeof msg === "string" ? msg.trim().toLowerCase() : "";
  return (
    normalized === "success" || normalized === "ok" || normalized === "succeed"
  );
};

const createMonitorSignedResult = ({
  setModalStatus,
  t,
  reconnectDevice,
  selectedAddress,
  monitorSubscription,
  proceedToNextStep,
  addNotification,
  getNotificationMeta,
  setVerificationStatus,
  setCheckStatusModalVisible,
  setErrorModalVisible,
  setErrorModalMessage,
  isDarkMode,
}) => {
  const WSS_TIMEOUT_MS = 7 * 60 * 1000;
  let txWs = null;
  let txWsTimeout = null;
  let txWsConnSeq = 0;
  let txWsCurrentMeta = null;

  const parseCloseEvent = (event) => ({
    code:
      event && typeof event.code !== "undefined"
        ? Number(event.code)
        : undefined,
    reason:
      event && typeof event.reason !== "undefined"
        ? String(event.reason || "")
        : "",
    wasClean:
      event && typeof event.wasClean !== "undefined"
        ? Boolean(event.wasClean)
        : undefined,
  });

  const stopTxWs = (reason = "stop") => {
    try {
      if (txWsTimeout) {
        clearTimeout(txWsTimeout);
        txWsTimeout = null;
      }
      if (txWs) {
        const ws = txWs;
        const meta = txWsCurrentMeta;
        txWs = null;
        txWsCurrentMeta = null;
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch {}
        const aliveMs =
          meta?.openedAt && Number.isFinite(meta.openedAt)
            ? Date.now() - meta.openedAt
            : undefined;
        console.log(`[TX_WSS] closed (${reason})`, {
          connId: meta?.id,
          target: meta?.target,
          orderId: meta?.orderId,
          aliveMs,
        });
      }
    } catch {}
  };

  const pushNotif = (base) => {
    try {
      const meta =
        typeof getNotificationMeta === "function"
          ? getNotificationMeta() || {}
          : {};
      if (typeof addNotification === "function") {
        addNotification({ ...meta, ...base });
      }
    } catch {}
  };

  const teardownBleAfterBroadcast = async (dev) => {
    try {
      try {
        const Platform = require("react-native").Platform;
        if (Platform?.OS === "android") {
        } else {
          monitorSubscription?.current?.remove?.();
        }
        if (monitorSubscription && typeof monitorSubscription === "object") {
          monitorSubscription.current = null;
        }
        console.log("[BCAST_END] monitorSubscription removed");
      } catch {}
      try {
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch {}
      if (dev && typeof dev.isConnected === "function") {
        try {
          const isConn = await dev.isConnected();
          if (isConn) {
            await dev.cancelConnection();
            console.log("[BCAST_END] Device disconnected after broadcast");
          } else {
            console.log("[BCAST_END] Device already disconnected");
          }
        } catch (e) {
          console.log(
            "[BCAST_END] cancelConnection error (ignored):",
            e?.message || e
          );
        }
      }
    } catch (e) {
      console.log("[BCAST_END] teardown error (ignored):", e?.message || e);
    } finally {
      logFlowEnd("[SIGN_FLOW][END] transfer flow completed", {
        stage: "ble-teardown",
      });
    }
  };

  const showBroadcastModal = (msg, txHash) => {
    try {
      const success = isMsgSuccess(msg);

      try {
        setCheckStatusModalVisible && setCheckStatusModalVisible(true);
      } catch {}

      if (success) {
        setModalStatus({
          title: t("Transaction Sent"),
          subtitle: t("Waiting for confirmation on the blockchain."),
          image: require("../../assets/animations/Success.webp"),
          txHash,
        });
        try {
          setVerificationStatus && setVerificationStatus("success");
        } catch {}
      } else {
        setModalStatus({
          title: t("Transaction Failed"),
          subtitle: msg
            ? String(msg)
            : t("Please check your device and try again."),
          image: require("../../assets/animations/Fail.webp"),
          txHash,
        });
        try {
          setVerificationStatus && setVerificationStatus("txFail");
        } catch {}
      }
    } catch {}
  };

  const notifyBroadcastFailure = async (message, dev) => {
    try {
      if (typeof setCheckStatusModalVisible === "function") {
        setCheckStatusModalVisible(false);
      }
      if (typeof setVerificationStatus === "function") {
        setVerificationStatus(null);
      }
      if (typeof setErrorModalMessage === "function") {
        setErrorModalMessage(message);
      }
      if (typeof setErrorModalVisible === "function") {
        setTimeout(() => setErrorModalVisible(true), 350);
      }
    } catch {}
    try {
      const msg = frameBle(bleCmd.bcastFail());
      await dev.writeCharacteristicWithResponseForService(
        serviceUUID,
        writeCharacteristicUUID,
        msg
      );
      console.log("BCAST_FAIL sent to embedded");
    } catch (err) {
      console.log("Error sending BCAST_FAIL:", err);
    }
    try {
      await teardownBleAfterBroadcast(dev);
    } catch {}
  };

  const normalizeText = (val) => String(val || "").trim().toLowerCase();

  const pickFirst = (obj, keys) => {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null) {
        return obj[key];
      }
    }
    return undefined;
  };
  const formatReason = (val) => {
    if (val === undefined || val === null) return "";
    if (typeof val === "string") return val.trim();
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  };

  const extractTxPayload = (raw) => {
    if (!raw || typeof raw !== "object") return {};
    const nested = raw?.data && typeof raw.data === "object" ? raw.data : null;
    const source = nested || raw;
    const txHash = pickFirst(source, [
      "txHash",
      "txid",
      "txId",
      "tx_id",
      "hash",
      "orderId",
      "order_id",
      "transactionHash",
    ]);
    const status = pickFirst(source, ["status", "state", "result", "msg"]);
    const chain = pickFirst(source, ["chain", "network"]);
    const address = pickFirst(source, ["address"]);
    const target = pickFirst(source, ["target", "targets"]);
    const amount = pickFirst(source, ["amount", "value", "qty"]);
    const symbol = pickFirst(source, ["symbol", "unit", "ticker"]);
    const timestamp = pickFirst(source, [
      "timestamp",
      "raw_timestamp",
      "time",
      "ts",
    ]);
    const reason = formatReason(
      pickFirst(source, [
        "reason",
        "error",
        "errorMessage",
        "message",
        "detail",
        "details",
        "vm_status",
        "vmStatus",
        "status_message",
        "statusMessage",
      ])
    );
    return {
      txHash,
      status,
      chain,
      address,
      target,
      amount,
      symbol,
      timestamp,
      reason,
    };
  };

  const startWssMonitor = (
    { chain, address, orderId },
    options = { updateUI: true }
  ) => {
    if (!chain || !address || !orderId) {
      console.log("Missing WSS listening parameters, skipped");
      return;
    }

    stopTxWs("restart");
    logDevCopyPayload({
      chain,
      address,
      orderId,
      stage: "WSS_TARGET_READY",
    });

    const normalizedChain = String(chain || "").trim().toLowerCase();
    const normalizedAddress = String(address || "").trim();
    const targets = [];
    const pushTarget = (targetAddress) => {
      const addr = String(targetAddress || "").trim();
      if (!normalizedChain || !addr) return;
      const key = `${normalizedChain}:${addr}`;
      if (!targets.includes(key)) {
        targets.push(key);
      }
    };
    pushTarget(normalizedAddress);
    if (isBchChainName(normalizedChain)) {
      const formats = deriveBchAddressFormats(normalizedAddress);
      pushTarget(formats.cashaddr);
      pushTarget(formats.legacy);
    }

    const target = targets.join(",");
    const targetLcSet = new Set(targets.map((item) => normalizeText(item)));
    const targetChainAddressPairs = targets
      .map((item) => {
        const idx = item.indexOf(":");
        if (idx <= 0) return null;
        return {
          chain: normalizeText(item.slice(0, idx)),
          address: item.slice(idx + 1),
        };
      })
      .filter(Boolean);
    const orderLc = normalizeText(orderId);

    if (options.updateUI) {
      setModalStatus({
        title: t("Pending Confirmation"),
        subtitle: t(
          "Waiting for on-chain confirmation, this may take a few minutes..."
        ),
        image: isDarkMode
          ? require("../../assets/animations/pendingDark.webp")
          : require("../../assets/animations/pendingLight.webp"),
        txHash: orderId,
      });
    }

    try {
      pushNotif({
        type: "transaction",
        status: "pending",
        chain,
        address,
        orderId,
        message: t(
          "Waiting for on-chain confirmation, this may take a few minutes..."
        ),
      });
    } catch {}

    if (!pushAPI.enabled) {
      console.log("[TX_WSS] skipped: push WSS is not configured", {
        target,
        orderId,
      });
      return;
    }

    const ws = new WebSocket(pushAPI.transactionsWS);
    const connId = ++txWsConnSeq;
    const openedAt = Date.now();
    txWsCurrentMeta = { id: connId, openedAt, target, orderId };
    txWs = ws;
    console.log("[TX_WSS] opening", { connId, target, orderId });

    txWsTimeout = setTimeout(() => {
      console.log("[TX_WSS] timeout", { connId, target, orderId });
      stopTxWs("timeout");
    }, WSS_TIMEOUT_MS);

    ws.onopen = () => {
      try {
        ws.send(
          JSON.stringify({
            type: "subscribe_tx",
            targets: target,
          })
        );
        console.log("[TX_WSS] subscribed:", target, { connId, orderId });
      } catch (err) {
        console.log("[TX_WSS] subscribe error:", {
          connId,
          target,
          orderId,
          message: err?.message || String(err || ""),
        });
      }
    };

    ws.onerror = (err) => {
      console.log("[TX_WSS] error:", {
        connId,
        target,
        orderId,
        message: err?.message || String(err || ""),
      });
    };

    ws.onclose = (event) => {
      const closeInfo = parseCloseEvent(event);
      const aliveMs = Date.now() - openedAt;
      console.log("[TX_WSS] closed", {
        connId,
        target,
        orderId,
        ...closeInfo,
        aliveMs,
      });
    };

    ws.onmessage = (event) => {
      try {
        const raw = event?.data;
        console.log("[TX_WSS] message:", raw);
        let msg = raw;
        if (typeof raw === "string" && raw.trim().startsWith("{")) {
          msg = JSON.parse(raw);
        }
        if (!msg || typeof msg !== "object") {
          return;
        }
        const messageType = msg?.type;
        if (messageType === "heartbeat") {
          return;
        }
        const payload = extractTxPayload(msg);
        const txHashLc = normalizeText(payload.txHash);
        const statusText = normalizeText(payload.status);
        const statusSuccess =
          payload?.success === true || isMsgSuccess(payload.status);
        const statusFail =
          payload?.success === false ||
          ["fail", "failed", "error", "rejected", "cancelled"].includes(
            statusText
          );
        const msgTargetLc = normalizeText(payload.target);
        const msgChainLc = normalizeText(payload.chain);
        const msgAddress = String(payload.address || "").trim();
        const msgTargetList = String(payload.target || "")
          .split(",")
          .map((item) => normalizeText(item))
          .filter(Boolean);
        const matchedTarget =
          msgTargetList.some((item) => targetLcSet.has(item)) ||
          targetLcSet.has(msgTargetLc) ||
          (msgChainLc &&
            msgAddress &&
            targetChainAddressPairs.some(
              ({ chain: targetChain, address: targetAddress }) =>
                targetChain === msgChainLc &&
                areAddressesEquivalent(msgChainLc, msgAddress, targetAddress),
            ));
        const matchedOrder = orderLc && txHashLc && txHashLc === orderLc;
        const isNewTx = messageType === "new_transaction";
        const isBroadcastStatus = messageType === "broadcast_status";
        const shouldProcessStatus = matchedOrder || (!orderLc && matchedTarget);

        if (!shouldProcessStatus && !isNewTx) {
          return;
        }

        const normalizedStatus = statusSuccess
          ? "success"
          : statusFail
          ? "fail"
          : statusText === "pending"
          ? "pending"
          : undefined;
        const resolvedChain = payload.chain || chain;
        const resolvedAddress = payload.address || address;
        const resolvedTxHash = payload.txHash || orderId;
        const resolvedSymbol = payload.symbol;
        const resolvedAmount = payload.amount;
        const resolvedReason = payload.reason;
        const rawTimestamp = Number(payload.timestamp);
        const resolvedTimestamp = Number.isFinite(rawTimestamp)
          ? rawTimestamp
          : undefined;

        if (isNewTx || isBroadcastStatus) {
          const notifyEntry = {
            type: "transaction",
            status: normalizedStatus || "pending",
            chain: resolvedChain,
            address: resolvedAddress,
            orderId: resolvedTxHash,
            txHash: resolvedTxHash,
            message:
              normalizedStatus === "fail"
                ? resolvedReason || t("Transaction Failed")
                : normalizedStatus === "success"
                ? t("Transaction confirmed")
                : t("Pending Confirmation"),
          };
          if (resolvedAmount !== undefined && resolvedAmount !== null) {
            notifyEntry.amount = resolvedAmount;
          }
          if (resolvedSymbol) {
            notifyEntry.unit = resolvedSymbol;
            notifyEntry.symbol = resolvedSymbol;
          }
          if (resolvedTimestamp !== undefined) {
            notifyEntry.timestamp = resolvedTimestamp;
          }
          if (!(shouldProcessStatus && (statusSuccess || statusFail))) {
            try {
              pushNotif(notifyEntry);
            } catch {}
          }
        }

        if (statusSuccess && shouldProcessStatus) {
          logFlowStep(
            "10/10",
            "ONCHAIN_RESULT",
            "WSS returned the final on-chain status",
            { status: "success", txHash: resolvedTxHash, chain: resolvedChain }
          );
          logDevCopyPayload({
            chain: resolvedChain,
            address: resolvedAddress,
            orderId: resolvedTxHash,
          });
          stopTxWs("success");
          try {
            pushNotif({
              type: "transaction",
              status: "success",
              chain: resolvedChain,
              address: resolvedAddress,
              orderId: resolvedTxHash,
              txHash: resolvedTxHash,
              message: t("Transaction confirmed"),
            });
          } catch {}
          setModalStatus({
            title: t("Transaction Successful"),
            subtitle: t("Your transaction has been confirmed on-chain."),
            image: require("../../assets/animations/Success.webp"),
            txHash: resolvedTxHash,
          });
        } else if (statusFail && shouldProcessStatus) {
          logFlowStep(
            "10/10",
            "ONCHAIN_RESULT",
            "WSS returned the final on-chain status",
            {
              status: "fail",
              txHash: resolvedTxHash,
              chain: resolvedChain,
              reason: resolvedReason || "(no reason from server)",
            }
          );
          logDevCopyPayload({
            chain: resolvedChain,
            address: resolvedAddress,
            orderId: resolvedTxHash,
          });
          console.log(
            "[TX_WSS] fail reason:",
            resolvedReason || "(no reason from server)"
          );
          stopTxWs("fail");
          try {
            pushNotif({
              type: "transaction",
              status: "fail",
              chain: resolvedChain,
              address: resolvedAddress,
              orderId: resolvedTxHash,
              txHash: resolvedTxHash,
              message: resolvedReason || t("Transaction Failed"),
            });
          } catch {}
          setModalStatus({
            title: t("Transaction Failed"),
            subtitle:
              resolvedReason ||
              t("The transaction was rejected or failed on-chain."),
            image: require("../../assets/animations/Fail.webp"),
            txHash: resolvedTxHash,
          });
        }
      } catch (err) {
        console.log("[TX_WSS] message error:", err?.message || err);
      }
    };
  };

  return (device) => {
    let signResultBytes = Buffer.alloc(0);
    const START = Buffer.from('{"resp":"signResult"', "utf8");
    const END = Buffer.from("\r\n", "utf8");
    const MAX_BUFFER = 1024 * 1024; // 1MB safety limit
    monitorSubscription.current = device.monitorCharacteristicForService(
      serviceUUID,
      notifyCharacteristicUUID,
      async (error, characteristic) => {
        if (error) {
          if (isBleDisconnectError(error)) {
            console.log("The device has been disconnected and stopped monitoring signature results.");
            return;
          }
          if (
            error.message &&
            error.message.includes("Operation was cancelled")
          ) {
            console.log("The listening operation was canceled and reconnecting...");
            reconnectDevice(device);
          } else if (
            error.message &&
            error.message.includes("Unknown error occurred")
          ) {
            console.log("Unknown error, possibly a bug:", error.message);
            if (error.reason) {
              console.log("Error reason:", error.reason);
            }
            reconnectDevice(device);
          } else {
            console.log("An error occurred while listening for device response:", error.message);
          }
          return;
        }

        const chunk = Buffer.from(characteristic.value, "base64");
        const receivedData = chunk.toString("utf8");
        const receivedClean = receivedData.replace(/[\x00-\x1F\x7F]/g, "").trim();
        console.log("Signature result data received from embedded device:", receivedData);

        if (receivedClean === "PIN_SIGN_READY") {
          setModalStatus({
            title: t("Waiting for approval on your device...."),
            subtitle: t("Waiting for approval on your device..."),
            image: isDarkMode
              ? require("../../assets/animations/pendingDark.webp")
              : require("../../assets/animations/pendingLight.webp"),
          });
          proceedToNextStep && proceedToNextStep();
        } else if (receivedClean === "PIN_SIGN_FAIL") {
          setModalStatus({
            title: t("Password Incorrect"),
            subtitle: t(
              "The PIN code you entered is incorrect. Transaction has been terminated."
            ),
            image: require("../../assets/animations/Fail.webp"),
          });
        } else if (receivedClean === "PIN_SIGN_CANCEL") {
          setModalStatus({
            title: t("Password Cancelled"),
            subtitle: t(
              "Password entry cancelled by user. Transaction has been terminated."
            ),
            image: require("../../assets/animations/Fail.webp"),
          });
        } else {
          try {
            signResultBytes = Buffer.concat([signResultBytes, chunk]);
            const START_LEN = START.length;
            const CRLF_LEN = END.length;
            while (true) {
              let startIdx = signResultBytes.indexOf(START);
              if (startIdx === -1) {
                if (signResultBytes.length > START_LEN - 1) {
                  signResultBytes = signResultBytes.slice(
                    signResultBytes.length - (START_LEN - 1)
                  );
                }
                break;
              }
              if (startIdx > 0) {
                signResultBytes = signResultBytes.slice(startIdx);
                startIdx = 0;
              }

              const endIdx = signResultBytes.indexOf(END, START_LEN);
              if (endIdx === -1) {
                break;
              }
              const fullJsonBuf = signResultBytes.slice(0, endIdx);
              signResultBytes = signResultBytes.slice(endIdx + CRLF_LEN);
              const fullJsonStr = fullJsonBuf.toString("utf8");
              let chainRaw = "";
              let hexRaw = "";
              try {
                const parsed = JSON.parse(fullJsonStr);
                chainRaw = parsed.chain || "";
                hexRaw = parsed.data || "";
              } catch {
                console.log("Failed to parse signResult JSON:", fullJsonStr);
                continue;
              }

              const postData = {
                chain: (chainRaw || "").trim(),
                hex: (hexRaw || "").trim(),
                address: selectedAddress,
              };
              logFlowStep("8/10", "SIGN_RESULT_RECEIVED", "", {
                chain: postData.chain,
                address: postData.address,
              });
              console.log(
                `Broadcast signed transaction to the server (${
                  accountAPI.broadcastHex
                }) POST payload:\n${JSON.stringify(postData, null, 2)}`
              );

              const chainNameForFlow = (chainRaw || "").trim().toLowerCase();
              const hexTrimmed = (hexRaw || "").trim();
              const isHexInvalid =
                !hexTrimmed ||
                hexTrimmed.toLowerCase() === "(null)" ||
                hexTrimmed.toLowerCase() === "null" ||
                hexTrimmed.toLowerCase() === "undefined";

              if (chainNameForFlow === "dogecoin" && isHexInvalid) {
                try {
                  setModalStatus({
                    title: t("Transaction Failed"),
                    subtitle: t(
                      "Invalid signature returned by device. Please try again."
                    ),
                    image: require("../../assets/animations/Fail.webp"),
                  });
                } catch {}
                try {
                  const msg = frameBle(bleCmd.bcastFail());
                  await device.writeCharacteristicWithResponseForService(
                    serviceUUID,
                    writeCharacteristicUUID,
                    msg
                  );
                  console.log("BCAST_FAIL sent to embedded (signature is empty)");
                } catch (err) {
                  console.log("Error while sending BCAST_FAIL (signature is empty):", err);
                }
                try {
                  pushNotif({
                    type: "transaction",
                    status: "fail",
                    chain: chainNameForFlow,
                    address: selectedAddress,
                    message: t("Invalid signature returned by device."),
                  });
                } catch {}
                try {
                  await teardownBleAfterBroadcast(device);
                } catch {}
                continue;
              }

              try {
                pushNotif({
                  type: "transaction",
                  status: "pending",
                  chain: chainNameForFlow,
                  address: selectedAddress,
                  message: t("Signed. Broadcasting transaction..."),
                });
              } catch {}

              setTimeout(async () => {
                try {
                  const chainNameForFlow = (chainRaw || "")
                    .trim()
                    .toLowerCase();
                  logFlowStep(
                    "9/10",
                    "BROADCAST_SUBMITTED",
                    "",
                    { chain: chainNameForFlow, address: selectedAddress }
                  );

                  if (chainNameForFlow === "solana") {
                    try {
                      const ctxStr = await AsyncStorage.getItem(
                        "solanaBroadcastContext"
                      );
                      const ctx = ctxStr ? JSON.parse(ctxStr) : null;
                      if (!ctx) {
                        throw new Error("Missing solanaBroadcastContext");
                      }

                      const solanaBroadcastPayload = {
                        chain: "solana",
                        from: ctx.from || selectedAddress,
                        to: ctx.to || "",
                        hash: ctx.hash || "",
                        mint: ctx.mint ?? "",
                        amount: Number(ctx.amount ?? 0),
                        isNft: Boolean(ctx.isNft),
                        ...(String(ctx.protocolType || "").trim()
                          ? { protocolType: String(ctx.protocolType).trim() }
                          : {}),
                        ...(Boolean(ctx.isNft) &&
                        String(ctx.tokenid || ctx.tokenId || "").trim()
                          ? { tokenid: String(ctx.tokenid || ctx.tokenId).trim() }
                          : {}),
                        signature: (hexRaw || "").trim(),
                      };
                      console.log(
                        "solana_broadcast request:",
                        JSON.stringify(
                          {
                            url: signAPI.solana_broadcast,
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: solanaBroadcastPayload,
                          },
                          null,
                          2
                        )
                      );

                      const solanaBroadcastRes = await fetch(
                        signAPI.solana_broadcast,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(solanaBroadcastPayload),
                        }
                      );
                      const solanaBroadcastJson =
                        await solanaBroadcastRes.json();
                      console.log(
                        "solana_broadcast response:\n" +
                          JSON.stringify(solanaBroadcastJson, null, 2)
                      );
                      const solanaBroadcastError =
                        solanaBroadcastJson?.error ||
                        solanaBroadcastJson?.msg ||
                        "";
                      if (solanaBroadcastError) {
                        console.log(
                          "solana_broadcast error:",
                          solanaBroadcastError
                        );
                        await notifyBroadcastFailure(
                          String(solanaBroadcastError),
                          device
                        );
                        return;
                      }

                      const solanaHexString =
                        typeof solanaBroadcastJson === "string"
                          ? solanaBroadcastJson
                          : solanaBroadcastJson?.data?.data ??
                            solanaBroadcastJson?.data ??
                            solanaBroadcastJson?.hex ??
                            solanaBroadcastJson?.signedTx ??
                            "";

                      if (
                        !solanaHexString ||
                        typeof solanaHexString !== "string"
                      ) {
                        throw new Error("Invalid solana_broadcast return");
                      }

                      const finalPostData = {
                        chain: "solana",
                        hex: solanaHexString,
                        address: ctx.from || selectedAddress,
                      };
                      console.log(
                        "Prepared Solana hex for broadcast:\n" +
                          JSON.stringify(finalPostData, null, 2)
                      );

                      const response = await fetch(accountAPI.broadcastHex, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(finalPostData),
                      });
                      const responseData = await response.json();

                      if (response.ok && isMsgSuccess(responseData?.msg)) {
                        console.log(
                          "Transaction broadcast succeeded:\n" +
                            JSON.stringify(responseData, null, 2)
                        );
                        try {
                          const msg = frameBle(bleCmd.bcastOk());
                          await device.writeCharacteristicWithResponseForService(
                            serviceUUID,
                            writeCharacteristicUUID,
                            msg
                          );
                          console.log("'BCAST_OK' command sent to embedded");
                        } catch (err) {
                          console.log("Error sending BCAST_OK:", err);
                        }
                        const txHash = responseData.data;
                        showBroadcastModal(responseData?.msg, txHash);
                        startWssMonitor(
                          {
                            chain: "solana",
                            address: ctx.from || selectedAddress,
                            orderId: txHash,
                          },
                          { updateUI: false }
                        );
                        try {
                          await teardownBleAfterBroadcast(device);
                        } catch {}
                      } else {
                        console.log("Transaction broadcast failed:", responseData);
                        try {
                          const msg = frameBle(bleCmd.bcastFail());
                          await device.writeCharacteristicWithResponseForService(
                            serviceUUID,
                            writeCharacteristicUUID,
                            msg
                          );
                          console.log("BCAST_FAIL sent to embedded");
                        } catch (err) {
                          console.log("Error sending BCAST_FAIL:", err);
                        }
                        showBroadcastModal(
                          responseData?.msg,
                          responseData?.data
                        );
                        try {
                          const possibleOrderId =
                            (responseData &&
                              (responseData.data?.orderId ||
                                responseData.data?.txHash)) ||
                            undefined;
                          if (possibleOrderId) {
                            startWssMonitor(
                              {
                                chain: "solana",
                                address: ctx.from || selectedAddress,
                                orderId: possibleOrderId,
                              },
                              { updateUI: false }
                            );
                          }
                        } catch (e) {
                          console.log(
                            "Failed to start WSS monitor after broadcast failure:",
                            e?.message || e
                          );
                        }
                        try {
                          await teardownBleAfterBroadcast(device);
                        } catch {}
                      }
                    } catch (errFlow) {
                      console.log("Solana special flow failed:", errFlow?.message || errFlow);
                      try {
                        const msg = frameBle(bleCmd.bcastFail());
                        await device.writeCharacteristicWithResponseForService(
                          serviceUUID,
                          writeCharacteristicUUID,
                          msg
                        );
                        console.log("BCAST_FAIL sent to embedded");
                      } catch (err) {
                        console.log("Error sending BCAST_FAIL:", err);
                      }
                      setModalStatus({
                        title: t("Transaction Error"),
                        subtitle: t(
                          "An error occurred while broadcasting the transaction."
                        ),
                        image: require("../../assets/animations/Fail.webp"),
                      });
                      try {
                        await teardownBleAfterBroadcast(device);
                      } catch {}
                    } finally {
                      try {
                        await AsyncStorage.removeItem("solanaBroadcastContext");
                      } catch {}
                    }
                  } else if (chainNameForFlow === "aptos") {
                    try {
                      const ctxStr = await AsyncStorage.getItem(
                        "aptosBroadcastContext"
                      );
                      const ctx = ctxStr ? JSON.parse(ctxStr) : null;
                      if (!ctx) {
                        throw new Error("Missing aptosBroadcastContext");
                      }

                      const aptosBroadcastPayload = {
                        chain: "aptos",
                        from: ctx.from || selectedAddress,
                        sequenceNumber: ctx.sequenceNumber,
                        maxGasAmount: ctx.maxGasAmount,
                        gasUnitPrice: ctx.gasUnitPrice,
                        receiveAddress: ctx.receiveAddress,
                        receiveAmount: Number(ctx.receiveAmount ?? 0),
                        typeArg: ctx.typeArg,
                        expiration: ctx.expiration ?? 600,
                        publicKey: ctx.publicKey,
                        signature: (hexRaw || "").trim(),
                      };
                      console.log(
                        "aptos_broadcast request:",
                        JSON.stringify(
                          {
                            url: signAPI.aptos_broadcast,
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: aptosBroadcastPayload,
                          },
                          null,
                          2
                        )
                      );

                      const aptosBroadcastRes = await fetch(
                        signAPI.aptos_broadcast,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(aptosBroadcastPayload),
                        }
                      );
                      const aptosBroadcastJson = await aptosBroadcastRes.json();
                      console.log("aptos_broadcast returns:", aptosBroadcastJson);

                      const aptosHexString =
                        typeof aptosBroadcastJson === "string"
                          ? aptosBroadcastJson
                          : aptosBroadcastJson?.data?.data ??
                            aptosBroadcastJson?.data ??
                            aptosBroadcastJson?.hex ??
                            aptosBroadcastJson?.signedTx ??
                            "";

                      if (
                        !aptosHexString ||
                        typeof aptosHexString !== "string"
                      ) {
                        throw new Error("Invalid aptos_broadcast return");
                      }
                      const finalPostData = {
                        chain: "aptos",
                        hex: aptosHexString,
                        address: ctx.from || selectedAddress,
                      };
                      console.log("Prepare to broadcast Aptos hex:", finalPostData);

                      const response = await fetch(accountAPI.broadcastHex, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(finalPostData),
                      });
                      const responseData = await response.json();

                      if (response.ok && isMsgSuccess(responseData?.msg)) {
                        console.log(
                          "Transaction broadcast succeeded:\n" +
                            JSON.stringify(responseData, null, 2)
                        );
                        try {
                          const msg = frameBle(bleCmd.bcastOk());
                          await device.writeCharacteristicWithResponseForService(
                            serviceUUID,
                            writeCharacteristicUUID,
                            msg
                          );
                          console.log("'BCAST_OK' command sent to embedded");
                        } catch (err) {
                          console.log("Error sending BCAST_OK:", err);
                        }
                        const txHash = responseData.data;
                        showBroadcastModal(responseData?.msg, txHash);
                        startWssMonitor(
                          {
                            chain: "aptos",
                            address: ctx.from || selectedAddress,
                            orderId: txHash,
                          },
                          { updateUI: false }
                        );
                        try {
                          await teardownBleAfterBroadcast(device);
                        } catch {}
                      } else {
                        console.log("Transaction broadcast failed:", responseData);
                        try {
                          const msg = frameBle(bleCmd.bcastFail());
                          await device.writeCharacteristicWithResponseForService(
                            serviceUUID,
                            writeCharacteristicUUID,
                            msg
                          );
                          console.log("BCAST_FAIL sent to embedded");
                        } catch (err) {
                          console.log("Error sending BCAST_FAIL:", err);
                        }
                        showBroadcastModal(
                          responseData?.msg,
                          responseData?.data
                        );
                        try {
                          const possibleOrderId =
                            (responseData &&
                              (responseData.data?.orderId ||
                                responseData.data?.txHash)) ||
                            undefined;
                          if (possibleOrderId) {
                            startWssMonitor(
                              {
                                chain: "aptos",
                                address: ctx.from || selectedAddress,
                                orderId: possibleOrderId,
                              },
                              { updateUI: false }
                            );
                          }
                        } catch (e) {
                          console.log(
                            "Failed to start WSS monitor after Aptos broadcast failure:",
                            e?.message || e
                          );
                        }
                      }
                      try {
                        await teardownBleAfterBroadcast(device);
                      } catch {}
                    } catch (errFlow) {
                      console.log(
                        "Aptos special flow failed:",
                        errFlow?.message || errFlow
                      );
                      try {
                        const msg = frameBle(bleCmd.bcastFail());
                        await device.writeCharacteristicWithResponseForService(
                          serviceUUID,
                          writeCharacteristicUUID,
                          msg
                        );
                        console.log("BCAST_FAIL sent to embedded");
                      } catch (err) {
                        console.log("Error sending BCAST_FAIL:", err);
                      }
                      setModalStatus({
                        title: t("Transaction Error"),
                        subtitle: t(
                          "An error occurred while broadcasting the transaction."
                        ),
                        image: require("../../assets/animations/Fail.webp"),
                      });
                      try {
                        await teardownBleAfterBroadcast(device);
                      } catch {}
                    } finally {
                      try {
                        await AsyncStorage.removeItem("aptosBroadcastContext");
                      } catch {}
                    }
                  } else if (chainNameForFlow === "sui") {
                    try {
                      const ctxStr = await AsyncStorage.getItem(
                        "suiBroadcastContext"
                      );
                      const ctx = ctxStr ? JSON.parse(ctxStr) : null;
                      if (!ctx) {
                        throw new Error("Missing suiBroadcastContext");
                      }

                      const signedHex = (hexRaw || "").trim();
                      if (!signedHex) {
                        throw new Error("Invalid sui signResult hex");
                      }

                      const suiBroadcastPayload = {
                        chainKey: String(ctx.chainKey || "sui")
                          .trim()
                          .toLowerCase(),
                        type: String(ctx.type || "").trim().toLowerCase() || "native",
                        objects: ctx.objects,
                        from: ctx.from || selectedAddress,
                        to: ctx.to || "",
                        amount: Number(ctx.amount ?? 0),
                        gasPrice: ctx.gasPrice,
                        gasBudget: ctx.gasBudget,
                        epoch: ctx.epoch,
                        ...(String(ctx.type || "").trim().toLowerCase() === "token"
                          ? {
                              contractAddress: String(
                                ctx.contractAddress || "",
                              ).trim(),
                              ...(Number.isFinite(Number(ctx.decimals))
                                ? { decimals: Number(ctx.decimals) }
                                : {}),
                              tokenobjects: Array.isArray(ctx.tokenObjects)
                                ? ctx.tokenObjects.map((o) => ({
                                    objectId: o.objectId,
                                    digest: o.digest,
                                    version: Number(o.version),
                                  }))
                                : [],
                            }
                          : {}),
                        signature: signedHex,
                      };
                      console.log(
                        "sui_broadcast request:",
                        JSON.stringify(
                          {
                            url: signAPI.sui_broadcast,
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: suiBroadcastPayload,
                          },
                          null,
                          2
                        )
                      );

                      const suiBroadcastRes = await fetch(
                        signAPI.sui_broadcast,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(suiBroadcastPayload),
                        }
                      );
                      const suiBroadcastJson = await suiBroadcastRes.json();
                      console.log("sui_broadcast returns:", suiBroadcastJson);

                      const extraData =
                        typeof suiBroadcastJson === "string"
                          ? suiBroadcastJson
                          : String(
                              suiBroadcastJson?.data?.data ??
                                suiBroadcastJson?.data ??
                                ""
                            ).trim();
                      if (!extraData) {
                        throw new Error("Invalid sui_broadcast extraData");
                      }

                      const finalPostData = {
                        chain: "sui",
                        hex: signedHex,
                        extraData,
                        address: ctx.from || selectedAddress,
                      };
                      console.log(
                        "Prepared Sui hex for broadcast:",
                        JSON.stringify(finalPostData, null, 2)
                      );

                      const response = await fetch(accountAPI.broadcastHex, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(finalPostData),
                      });
                      const responseData = await response.json();

                      if (response.ok && isMsgSuccess(responseData?.msg)) {
                        console.log(
                          "Transaction broadcast succeeded:\n" +
                            JSON.stringify(responseData, null, 2)
                        );
                        try {
                          const msg = frameBle(bleCmd.bcastOk());
                          await device.writeCharacteristicWithResponseForService(
                            serviceUUID,
                            writeCharacteristicUUID,
                            msg
                          );
                          console.log("'BCAST_OK' command sent to embedded");
                        } catch (err) {
                          console.log("Error sending BCAST_OK:", err);
                        }
                        const txHash = responseData.data;
                        showBroadcastModal(responseData?.msg, txHash);
                        startWssMonitor(
                          {
                            chain: "sui",
                            address: ctx.from || selectedAddress,
                            orderId: txHash,
                          },
                          { updateUI: false }
                        );
                        try {
                          await teardownBleAfterBroadcast(device);
                        } catch {}
                      } else {
                        console.log("Transaction broadcast failed:", responseData);
                        try {
                          const msg = frameBle(bleCmd.bcastFail());
                          await device.writeCharacteristicWithResponseForService(
                            serviceUUID,
                            writeCharacteristicUUID,
                            msg
                          );
                          console.log("BCAST_FAIL sent to embedded");
                        } catch (err) {
                          console.log("Error sending BCAST_FAIL:", err);
                        }
                        showBroadcastModal(
                          responseData?.msg,
                          responseData?.data
                        );
                        try {
                          const possibleOrderId =
                            (responseData &&
                              (responseData.data?.orderId ||
                                responseData.data?.txHash)) ||
                            undefined;
                          if (possibleOrderId) {
                            startWssMonitor(
                              {
                                chain: "sui",
                                address: ctx.from || selectedAddress,
                                orderId: possibleOrderId,
                              },
                              { updateUI: false }
                            );
                          }
                        } catch (e) {
                          console.log(
                            "Failed to start WSS monitor after Sui broadcast failure:",
                            e?.message || e
                          );
                        }
                      }
                      try {
                        await teardownBleAfterBroadcast(device);
                      } catch {}
                    } catch (errFlow) {
                      console.log(
                        "Sui special flow failed:",
                        errFlow?.message || errFlow
                      );
                      try {
                        const msg = frameBle(bleCmd.bcastFail());
                        await device.writeCharacteristicWithResponseForService(
                          serviceUUID,
                          writeCharacteristicUUID,
                          msg
                        );
                        console.log("BCAST_FAIL sent to embedded");
                      } catch (err) {
                        console.log("Error sending BCAST_FAIL:", err);
                      }
                      setModalStatus({
                        title: t("Transaction Error"),
                        subtitle: t(
                          "An error occurred while broadcasting the transaction."
                        ),
                        image: require("../../assets/animations/Fail.webp"),
                      });
                      try {
                        await teardownBleAfterBroadcast(device);
                      } catch {}
                    } finally {
                      try {
                        await AsyncStorage.removeItem("suiBroadcastContext");
                      } catch {}
                    }
                  } else if (chainNameForFlow === "cosmos") {
                    try {
                      const ctxStr = await AsyncStorage.getItem(
                        "cosmosBroadcastContext"
                      );
                      const ctx = ctxStr ? JSON.parse(ctxStr) : null;
                      if (!ctx) {
                        throw new Error("Missing cosmosBroadcastContext");
                      }

                      const cosmosBroadcastPayload = {
                        chain: "cosmos",
                        from: ctx.from || selectedAddress,
                        to: ctx.to || "",
                        amount: Number(ctx.amount ?? 0),
                        sequence: ctx.sequence,
                        chainKey: ctx.chainKey || "cosmos",
                        accountNumber: ctx.accountNumber,
                        feeAmount: ctx.feeAmount,
                        gasLimit: ctx.gasLimit,
                        memo: ctx.memo ?? "",
                        timeoutHeight: ctx.timeoutHeight,
                        publicKey: ctx.publicKey,
                        signature: (hexRaw || "").trim(),
                      };
                      console.log(
                        "cosmos_broadcast request:",
                        JSON.stringify(
                          {
                            url: signAPI.cosmos_broadcast,
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: cosmosBroadcastPayload,
                          },
                          null,
                          2
                        )
                      );

                      const cosmosBroadcastRes = await fetch(
                        signAPI.cosmos_broadcast,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(cosmosBroadcastPayload),
                        }
                      );
                      const cosmosBroadcastJson =
                        await cosmosBroadcastRes.json();
                      console.log(
                        "cosmos_broadcast response:",
                        cosmosBroadcastJson
                      );

                      const cosmosHexString =
                        typeof cosmosBroadcastJson === "string"
                          ? cosmosBroadcastJson
                          : cosmosBroadcastJson?.data?.data ??
                            cosmosBroadcastJson?.data ??
                            cosmosBroadcastJson?.hex ??
                            cosmosBroadcastJson?.signedTx ??
                            "";

                      if (
                        !cosmosHexString ||
                        typeof cosmosHexString !== "string"
                      ) {
                        throw new Error("Invalid cosmos_broadcast return");
                      }

                      const finalPostData = {
                        chain: "cosmos",
                        hex: cosmosHexString,
                        address: ctx.from || selectedAddress,
                      };
                      console.log("Prepare to broadcast Cosmos hex:", finalPostData);

                      const response = await fetch(accountAPI.broadcastHex, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(finalPostData),
                      });
                      const responseData = await response.json();

                      if (response.ok && isMsgSuccess(responseData?.msg)) {
                        console.log(
                          "Transaction broadcast succeeded:\n" +
                            JSON.stringify(responseData, null, 2)
                        );
                        try {
                          const msg = frameBle(bleCmd.bcastOk());
                          await device.writeCharacteristicWithResponseForService(
                            serviceUUID,
                            writeCharacteristicUUID,
                            msg
                          );
                          console.log("'BCAST_OK' command sent to embedded");
                        } catch (err) {
                          console.log("Error sending BCAST_OK:", err);
                        }
                        const txHash = responseData.data;
                        showBroadcastModal(responseData?.msg, txHash);
                        startWssMonitor(
                          {
                            chain: "cosmos",
                            address: ctx.from || selectedAddress,
                            orderId: txHash,
                          },
                          { updateUI: false }
                        );
                        try {
                          await teardownBleAfterBroadcast(device);
                        } catch {}
                      } else {
                        console.log("Transaction broadcast failed:", responseData);
                        try {
                          const msg = frameBle(bleCmd.bcastFail());
                          await device.writeCharacteristicWithResponseForService(
                            serviceUUID,
                            writeCharacteristicUUID,
                            msg
                          );
                          console.log("BCAST_FAIL sent to embedded");
                        } catch (err) {
                          console.log("Error sending BCAST_FAIL:", err);
                        }
                        showBroadcastModal(
                          responseData?.msg,
                          responseData?.data
                        );
                        try {
                          const possibleOrderId =
                            (responseData &&
                              (responseData.data?.orderId ||
                                responseData.data?.txHash)) ||
                            undefined;
                          if (possibleOrderId) {
                            startWssMonitor(
                              {
                                chain: "cosmos",
                                address: ctx.from || selectedAddress,
                                orderId: possibleOrderId,
                              },
                              { updateUI: false }
                            );
                          }
                        } catch (e) {
                          console.log(
                            "Failed to start WSS monitor after Cosmos broadcast failure:",
                            e?.message || e
                          );
                        }
                      }
                      try {
                        await teardownBleAfterBroadcast(device);
                      } catch {}
                    } catch (errFlow) {
                      console.log(
                        "Cosmos special flow failed:",
                        errFlow?.message || errFlow
                      );
                      try {
                        const msg = frameBle(bleCmd.bcastFail());
                        await device.writeCharacteristicWithResponseForService(
                          serviceUUID,
                          writeCharacteristicUUID,
                          msg
                        );
                        console.log("BCAST_FAIL sent to embedded");
                      } catch (err) {
                        console.log("Error sending BCAST_FAIL:", err);
                      }
                      setModalStatus({
                        title: t("Transaction Error"),
                        subtitle: t(
                          "An error occurred while broadcasting the transaction."
                        ),
                        image: require("../../assets/animations/Fail.webp"),
                      });
                      try {
                        await teardownBleAfterBroadcast(device);
                      } catch {}
                    } finally {
                      try {
                        await AsyncStorage.removeItem("cosmosBroadcastContext");
                      } catch {}
                    }
                  } else {
                    const response = await fetch(accountAPI.broadcastHex, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(postData),
                    });
                    const responseData = await response.json();

                    if (response.ok && isMsgSuccess(responseData?.msg)) {
                      console.log(
                        "Transaction broadcast succeeded:\n" +
                          JSON.stringify(responseData, null, 2)
                      );
                      try {
                        const msg = frameBle(bleCmd.bcastOk());
                        await device.writeCharacteristicWithResponseForService(
                          serviceUUID,
                          writeCharacteristicUUID,
                          msg
                        );
                        console.log("'BCAST_OK' command sent to embedded");
                      } catch (err) {
                        console.log("Error sending BCAST_OK:", err);
                      }
                      const txHash = responseData.data;
                      showBroadcastModal(responseData?.msg, txHash);
                      startWssMonitor(
                        {
                          chain: (chainRaw || "").trim(),
                          address: selectedAddress,
                          orderId: txHash,
                        },
                        { updateUI: false }
                      );
                      try {
                        await teardownBleAfterBroadcast(device);
                      } catch {}
                    } else {
                      console.log("Transaction broadcast failed:", responseData);
                      try {
                        const msg = frameBle(bleCmd.bcastFail());
                        await device.writeCharacteristicWithResponseForService(
                          serviceUUID,
                          writeCharacteristicUUID,
                          msg
                        );
                        console.log("BCAST_FAIL sent to embedded");
                      } catch (err) {
                        console.log("Error sending BCAST_FAIL:", err);
                      }
                      showBroadcastModal(responseData?.msg, responseData?.data);
                      try {
                        const possibleOrderId =
                          (responseData &&
                            (responseData.data?.orderId ||
                              responseData.data?.txHash)) ||
                          undefined;
                        const chainNameForQuery = (chainRaw || "").trim();

                        try {
                          pushNotif({
                            type: "transaction",
                            status: "fail",
                            chain: chainNameForQuery,
                            address: selectedAddress,
                            orderId: possibleOrderId,
                            message: responseData?.msg
                              ? String(responseData.msg)
                              : t("Transaction broadcast failed"),
                          });
                        } catch {}

                        if (possibleOrderId) {
                          startWssMonitor(
                            {
                              chain: chainNameForQuery,
                              address: selectedAddress,
                              orderId: possibleOrderId,
                            },
                            { updateUI: false }
                          );
                        }
                        try {
                          await teardownBleAfterBroadcast(device);
                        } catch {}
                      } catch (e) {
                        console.log(
                          "Failed to start WSS monitor after broadcast failure:",
                          e?.message || e
                        );
                      }
                    }
                  }
                } catch (broadcastError) {
                  console.log(
                    "Transaction broadcast failed with error:",
                    broadcastError?.message || broadcastError
                  );
                  try {
                    const msg = frameBle(bleCmd.bcastFail());
                    await device.writeCharacteristicWithResponseForService(
                      serviceUUID,
                      writeCharacteristicUUID,
                      msg
                    );
                    console.log("BCAST_FAIL sent to embedded");
                  } catch (err) {
                    console.log("Error sending BCAST_FAIL:", err);
                  }
                  setModalStatus({
                    title: t("Transaction Error"),
                    subtitle: t(
                      "An error occurred while broadcasting the transaction."
                    ),
                    image: require("../../assets/animations/Fail.webp"),
                  });
                  try {
                    await teardownBleAfterBroadcast(device);
                  } catch {}
                }
              }, 0);
            }

            if (signResultBytes.length > MAX_BUFFER) {
              signResultBytes = signResultBytes.slice(
                -Math.max(START_LEN * 2, 4096)
              );
            }
          } catch (e) {
            console.log("Failed to parse signResult frame:", e?.message || e);
          }
        }
      }
    );

    return monitorSubscription.current;
  };
};

export default createMonitorSignedResult;
