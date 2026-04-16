/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { Buffer } from "buffer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { accountAPI, signAPI } from "../../env/apiEndpoints";
import { families } from "../../config/mappingRegistry";
import assetOps from "../../config/assetOps";
import { RUNTIME_DEV } from "../../utils/runtimeFlags";
import { getSecureItem } from "../../utils/secureStorage";
import { bluetoothConfig } from "../../env/bluetoothConfig";
import { isBleDisconnectError } from "../../utils/bleErrors";
import { safeRemoveSubscription } from "../../utils/bleSubscription";
import { canonicalizeAddressForTransport } from "../../config/networkUtils";
import { bleCmd, frameBle } from "../../utils/bleProtocol";
import { ensureScreenUnlocked } from "../../utils/ensureScreenUnlocked";

const LOG_GREEN = "\x1b[32m";
const LOG_RESET = "\x1b[0m";
const SUI_MAINNET_RPC = "https://fullnode.mainnet.sui.io:443";
const SUI_GAS_COIN_TYPE_RE = /^0x0*2::coin::coin<0x0*2::sui::sui>$/;
const logFlowStart = (title, meta) => {
  const line = "=".repeat(64);
  console.log(`${LOG_GREEN}${line}${LOG_RESET}`);
  console.log(`${LOG_GREEN}${title}${LOG_RESET}`, meta || "");
  console.log(`${LOG_GREEN}${line}${LOG_RESET}`);
};
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

const isSuiGasCoinType = (typeStr) =>
  SUI_GAS_COIN_TYPE_RE.test(String(typeStr || "").trim().toLowerCase());

const normalizeSuiTypeTag = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^0x0+/, "0x");

const resolveSuiTransferType = ({
  chainKey,
  coinType,
  contractAddress,
  tokenShortName,
}) => {
  if (String(chainKey || "").trim().toLowerCase() !== "sui") return "";

  const normalizedCoinType = String(coinType || "")
    .trim()
    .toLowerCase();
  const normalizedSymbol = String(tokenShortName || "")
    .trim()
    .toUpperCase();
  const normalizedContract = String(contractAddress || "").trim();

  if (
    normalizedCoinType === "native" ||
    normalizedSymbol === "SUI" ||
    !normalizedContract
  ) {
    return "native";
  }

  return "token";
};

const extractSuiObjectType = (objResp) =>
  String(
    objResp?.data?.content?.type ||
      objResp?.data?.type ||
      objResp?.content?.type ||
      objResp?.type ||
      ""
  ).trim();

const inspectSuiObjects = async (objects) => {
  const candidates = Array.isArray(objects)
    ? objects.filter((o) => o?.objectId)
    : [];
  if (!candidates.length) return [];

  try {
    const rpcPayload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "sui_multiGetObjects",
      params: [
        candidates.map((o) => o.objectId),
        { showType: true, showContent: true },
      ],
    };
    const rpcRes = await fetch(SUI_MAINNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcPayload),
    });
    const rpcJson = await rpcRes.json();
    const resultList = Array.isArray(rpcJson?.result) ? rpcJson.result : [];
    const typeByObjectId = new Map();
    for (const item of resultList) {
      const objectId =
        item?.data?.objectId || item?.objectId || item?.reference?.objectId;
      if (!objectId) continue;
      typeByObjectId.set(objectId, extractSuiObjectType(item));
    }

    return candidates.map((o) => ({
      objectId: o.objectId,
      digest: o.digest,
      version: Number(o.version),
      type: typeByObjectId.get(o.objectId) || "",
    }));
  } catch (e) {
    console.log(
      "Sui object inspection failed, the original object is rolled back:",
      e?.message || e,
    );
    return candidates.map((o) => ({
      objectId: o.objectId,
      digest: o.digest,
      version: Number(o.version),
      type: "",
    }));
  }
};

const serviceUUID = bluetoothConfig.serviceUUID;
const writeCharacteristicUUID = bluetoothConfig.writeCharacteristicUUID;
const notifyCharacteristicUUID = bluetoothConfig.notifyCharacteristicUUID;
const signTransaction = async (
  device,
  amount,
  paymentAddress,
  inputAddress,
  selectedQueryChainName,
  contractAddress,
  selectedFeeTab,
  recommendedFee,
  rapidFeeValue,
  setModalStatus,
  t,
  monitorSignedResult,
  monitorSubscription,
  setVerificationStatus,
  setCheckStatusModalVisible,
  coinType,
  tokenDecimals,
  tokenShortName,
  tokenFullName,
  isDarkMode,
  setErrorModalVisible,
  setErrorModalMessage,
) => {
  if (!accountAPI?.enabled || !signAPI?.enabled) {
    console.log("[SIGN_FLOW] chain API is not configured");
    return;
  }

  try {
    const resolveBtcPathByAddress = (addr) => {
      const normalized = String(addr || "").trim().toLowerCase();
      if (normalized.startsWith("1")) return "m/44'/0'/0'/0/0";
      if (normalized.startsWith("bc1q") || normalized.startsWith("tb1q")) {
        return "m/84'/0'/0'/0/0";
      }
      if (normalized.startsWith("bc1p") || normalized.startsWith("tb1p")) {
        return "m/86'/0'/0'/0/0";
      }
      return "m/49'/0'/0'/0/0";
    };

    const normalizedInputAddress = canonicalizeAddressForTransport(
      selectedQueryChainName,
      inputAddress,
    );
    inputAddress = normalizedInputAddress;

    logFlowStart("[SIGN_FLOW][START] review-confirm transfer", {
      chain: selectedQueryChainName || "",
      from: paymentAddress || "",
      to: normalizedInputAddress || "",
      amount: amount ?? "",
    });

    if (!device?.isConnected) {
      console.log("Invalid device");
      return;
    }

    try {
      const already = await device.isConnected?.();
      if (!already) {
        await device.connect();
      }
    } catch {
      await device.connect();
    }
    await device.discoverAllServicesAndCharacteristics();

    const chainKey = selectedQueryChainName?.toLowerCase();

    if (!chainKey || !assetOps[chainKey]) {
      console.log(`Unsupported path: ${chainKey}`);
      return;
    }

    const path =
      chainKey === "bitcoin"
        ? resolveBtcPathByAddress(paymentAddress)
        : assetOps[chainKey];
    console.log("Path chosen:", path);
    logFlowStep("1/7", "ACCOUNT_ID verify", "", { chainKey, path });

    const senderAddress = paymentAddress;
    const receiveAddress = normalizedInputAddress;
    const transactionFee =
      selectedFeeTab === "Recommended" ? recommendedFee : rapidFeeValue;
    const storedAccountId =
      (await getSecureItem("accountId", ["currentAccountId"])) ?? "";

    try {
      await ensureScreenUnlocked(device, { label: "SIGN_FLOW" });
    } catch (screenErr) {
      const msg = String(screenErr?.message || screenErr);
      console.log("[SIGN_FLOW] screen check failed:", msg);
      if (msg === "SCREEN_PWD_CANCEL" || msg === "SCREEN_CHECK_TIMEOUT") {
        try { setVerificationStatus && setVerificationStatus(null); } catch {}
        try { setCheckStatusModalVisible && setCheckStatusModalVisible(false); } catch {}
        if (msg === "SCREEN_PWD_CANCEL") {
          try {
            if (typeof global !== "undefined" && typeof global.__SHOW_APP_TOAST__ === "function") {
              setTimeout(() => {
                global.__SHOW_APP_TOAST__({
                  message: t ? t("Transaction canceled") : "Transaction canceled",
                  variant: "cancel",
                  durationMs: 3000,
                  showCountdown: true,
                });
              }, 200);
            }
          } catch {}
        }
        try {
          const isConn = await device?.isConnected?.();
          if (isConn) await device.cancelConnection();
        } catch {}
        return;
      }
      throw screenErr;
    }

    const firstTradeMsg = bleCmd.destAddr(senderAddress, receiveAddress, amount, chainKey, storedAccountId) + "\r\n";
    logFlowStep("2/7", "DEVICE_CONFIRM", "", {
      chain: chainKey,
      amount: String(amount),
    });
    console.log("Transaction amount:", amount);
    console.log("Send the transaction summary to the device:", firstTradeMsg);
 
    const firstTradeBuffer = Buffer.from(firstTradeMsg, "utf-8");
    const firstTradeBase64 = firstTradeBuffer.toString("base64");

    try {
      await sendInChunks(
        device,
        serviceUUID,
        writeCharacteristicUUID,
        firstTradeBase64,
        220,
      );
      console.log("The transaction summary was sent to the device.");
    } catch (error) {
      console.log("An error occurred while sending the first step of transaction information to the device:", error);
    }
 

    let signedRejectDisconnected = false;
    let disconnectOnce = false;
    const triggerSignedRejectToast = () => {
      if (
        typeof global !== "undefined" &&
        typeof global.__SHOW_APP_TOAST__ === "function"
      ) {
        setTimeout(() => {
          global.__SHOW_APP_TOAST__({
            message: t
              ? t("Device signature rejected, transaction canceled")
              : "Device signature rejected, transaction canceled",
            variant: "cancel",
            durationMs: 3000,
            showCountdown: true,
          });
        }, 200);
      }
    };
    const disconnectAfterSignedReject = (cause = "signed_reject") => {
      if (signedRejectDisconnected) return;
      signedRejectDisconnected = true;
      try {
        safeRemoveSubscription(monitorSubscription.current, {
          label: "signed-reject:cleanup",
        });
        monitorSubscription.current = null;
      } catch {}
      setTimeout(async () => {
        try {
          const isConn = await device?.isConnected?.();
          if (isConn) {
            await device.cancelConnection();
            console.log(`[SIGN_REJECT] Device disconnected: ${device?.id}`);
          } else {
            console.log(`[SIGN_REJECT] Device already disconnected`);
          }
        } catch (e) {
          console.log(
            "[SIGN_REJECT] cancelConnection error (ignored):",
            e?.message || e,
          );
        }
      }, 300);
    };
    const disconnectBleSafely = (cause = "flow_end") => {
      if (disconnectOnce) return;
      disconnectOnce = true;

      try {
        safeRemoveSubscription(monitorSubscription?.current, {
          label: `disconnect:${cause}`,
        });
        if (monitorSubscription && typeof monitorSubscription === "object") {
          monitorSubscription.current = null;
        }
      } catch {}

      setTimeout(async () => {
        try {
          const isConn = await device?.isConnected?.();
          if (isConn) {
            await device.cancelConnection();
            console.log(`[BLE] Disconnected: ${device?.id} cause=${cause}`);
          } else {
            console.log(
              `[BLE] Already disconnected: ${device?.id} cause=${cause}`,
            );
          }
        } catch (e) {
          console.log(
            "[BLE] cancelConnection error (ignored):",
            e?.message || e,
          );
        }
      }, 300);
    };

    const signedOkPromise = new Promise((resolve) => {
      let isResolved = false;
      try {
        safeRemoveSubscription(monitorSubscription.current, {
          label: "signed-ok:init",
        });
      } catch {}

      monitorSubscription.current = device.monitorCharacteristicForService(
        serviceUUID,
        notifyCharacteristicUUID,
        (error, characteristic) => {
          if (error) {
            if (isBleDisconnectError(error)) {
              resolve({ disconnected: true });
              return;
            }
            console.log("Error while listening for Signed_OK:", error.message);
            return;
          }
          const text = Buffer.from(characteristic.value, "base64").toString(
            "utf8",
          );
          const raw = Buffer.from(characteristic.value, "base64");
          const received = text.replace(/[\x00-\x1F\x7F]/g, "").trim();

          if (
            !isResolved &&
            (() => {
              const parsed = require("../../utils/bleProtocol").parseResp(received);
              return parsed?.resp === "signedOk" || received.includes("Signed_OK");
            })()
          ) {
            isResolved = true;
            safeRemoveSubscription(monitorSubscription.current, {
              label: "signed-ok:ok",
            });
            setModalStatus({
              title: t("Device Confirmed"),
              subtitle: t(
                "The device has confirmed the transaction signature.",
              ),
              image: isDarkMode
                ? require("../../assets/animations/pendingDark.webp")
                : require("../../assets/animations/pendingLight.webp"),
            });
            resolve({ ok: true });
          } else if (
            !isResolved &&
            (() => {
              const parsed = require("../../utils/bleProtocol").parseResp(received);
              return parsed?.resp === "signedReject" || received.includes("Signed_REJECT");
            })()
          ) {
            isResolved = true;
            safeRemoveSubscription(monitorSubscription.current, {
              label: "signed-ok:reject",
            });
            try {
              setCheckStatusModalVisible && setCheckStatusModalVisible(false);
            } catch {}
            try {
              setVerificationStatus && setVerificationStatus(null);
            } catch {}
            triggerSignedRejectToast();
            disconnectAfterSignedReject("signed_reject_rx");
            resolve({ rejected: true });
          } else if (
            !isResolved &&
            (() => {
              const parsed = require("../../utils/bleProtocol").parseResp(received);
              return parsed?.resp === "accountIdFail" || received.includes("ACCOUNT_ID_FAIL");
            })()
          ) {
            isResolved = true;
            safeRemoveSubscription(monitorSubscription.current, {
              label: "signed-ok:accountIdFail",
            });
            try {
              setModalStatus({
                title: t("Account Mismatch"),
                subtitle: t(
                  "The selected address does not match the connected device account. Please verify the device account and try again.",
                ),
                image: require("../../assets/animations/Fail.webp"),
              });
            } catch {}
            try {
              setVerificationStatus && setVerificationStatus("accountMismatch");
            } catch {}
            try {
              setCheckStatusModalVisible && setCheckStatusModalVisible(true);
            } catch {}
            disconnectAfterSignedReject("account_id_fail");
            resolve({ accountIdFail: true });
          }
        },
      );

      (async () => {
        try {
          await new Promise((r) => setTimeout(r, 80));
          await device.writeCharacteristicWithResponseForService(
            serviceUUID,
            writeCharacteristicUUID,
            firstTradeBase64,
          );
          console.log("The transaction summary was sent to the device.");
        } catch (error) {
          console.log("An error occurred while sending the first step of transaction information to the device:", error);
        }
      })();
    });
    const signedOkResult = await signedOkPromise;
    if (signedOkResult?.disconnected) {
      console.log("The device has been disconnected, terminating waiting for Signed_OK");
      return;
    }
    if (signedOkResult?.rejected) {
      console.log("Device rejects signature: Signed_REJECT");
      return;
    }
    if (signedOkResult?.accountIdFail) {
      console.log("Device account verification failed: ACCOUNT_ID_FAIL");
      return;
    }
    console.log("Steps 2 to 3 are completed and the user has confirmed and approved the transfer.");
    logFlowStep(
      "3/7",
      "DEVICE_APPROVED",
      "",
      { chain: selectedQueryChainName || "" }
    );
    const postChain = selectedQueryChainName;
    const feePreference =
      selectedFeeTab === "Recommended" ? "recommended" : "rapid";
    const normalizedProtocol = String(coinType || "")
      .trim()
      .toLowerCase();
    const suiTransferType = resolveSuiTransferType({
      chainKey: postChain,
      coinType,
      contractAddress,
      tokenShortName,
    });
    const isBtcFamilyForPost = families?.btc?.includes?.(postChain);
    const isTronForPost = families?.tron?.includes?.(postChain);
    const selectedFeeAmountCoinForPost =
      Number(
        feePreference === "recommended" ? recommendedFee : rapidFeeValue,
      ) || 0;
    let gasPrice,
      nonce,
      feeRate,
      gasLimit,
      sequence,
      utxoList,
      maxGasAmount,
      typeArg,
      blockHash,
      suiObjects,
      tokenObjects,
      epoch,
      accountNumber,
      effectiveFeeAmount,
      effectiveFeeAmountStr,
      heigh,
      fee,
      tronLatestBlock;

    const postData = {
      chain: postChain,
      from: paymentAddress,
      to: inputAddress,
      txAmount: `${amount}`,
      extJson: {
        ...((postChain === "sui" ? suiTransferType : normalizedProtocol)
          ? {
              protocol: postChain === "sui" ? suiTransferType : normalizedProtocol,
            }
          : {}),
        feePreference,
        feeSource: "blockchain-fee",
        ...(isBtcFamilyForPost
          ? {
              selectedFeeAmount: selectedFeeAmountCoinForPost,
              selectedFeeCurrency: postChain,
            }
          : {}),
      },
    };

    logFlowStep(
      "4/7",
      "GET_SIGN_PARAM",
      "",
      { endpoint: accountAPI.getSignParam, chain: postChain }
    );
    console.log(
      "Request signing parameters from the server API (getSignParam):\n" +
        JSON.stringify(
          {
            url: accountAPI.getSignParam,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: postData,
          },
          null,
          2,
        ),
    );

    const walletParamsResponse = await fetch(accountAPI.getSignParam, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });

    if (!walletParamsResponse.ok) {
      console.log("Failed to get nonce and gasPrice:", walletParamsResponse.status);
      return;
    }
    const walletParamsData = await walletParamsResponse.json();
    console.log(
      `Pre-sign parameter response (${accountAPI.getSignParam}):\n` +
        JSON.stringify(walletParamsData, null, 2),
    );

    if (families?.evm?.includes?.(postChain)) {
      if (walletParamsData.data?.nonce == null) {
        return console.log("The data returned by the interface is incomplete:", walletParamsData);
      }
      const {
        nonce: ethNonce,
        gasLimit: ethGasLimit,
        gasPrice: ethGasPrice,
      } = walletParamsData.data;
      nonce = ethNonce;
      gasLimit = ethGasLimit;
      gasPrice = ethGasPrice;
      console.log(
        `\x1b[33m${postChain} returned data: ${JSON.stringify(
          { gasLimit, gasPrice, nonce },
          null,
          0,
        )}\x1b[0m`,
      );
    } else if (
      families?.btc?.includes?.(postChain) ||
      families?.dogecoin?.includes?.(postChain)
    ) {
      if (!walletParamsData.data?.feeRate || !walletParamsData.data?.utxoList) {
        return console.log("The data returned by the interface is incomplete:", walletParamsData);
      }
      const { feeRate: btcFeeRate, utxoList: btcUtxoList } =
        walletParamsData.data;
      feeRate = btcFeeRate;
      utxoList = btcUtxoList;
      console.log(`Data returned by ${postChain}:`, { feeRate, utxoList });
    } else if (isTronForPost) {
      const tronBlockList = walletParamsData.data?.tronBlockVoList;
      const firstBlock = Array.isArray(tronBlockList) ? tronBlockList[0] : null;
      if (!firstBlock) {
        console.log("The block data returned by the TRON interface is empty:", walletParamsData);
      } else {
        tronLatestBlock = {
          hash: firstBlock.blockHash || "",
          number: Number(firstBlock.blockNumber) || null,
          timestamp: Number(firstBlock.timestamp) || null,
        };
      }
      console.log("Block data returned by TRON getSignParam:", tronLatestBlock);
    } else if (postChain === "aptos") {
      if (
        !walletParamsData.data?.gasPrice ||
        !walletParamsData.data?.sequence ||
        !walletParamsData.data?.maxGasAmount ||
        !walletParamsData.data?.typeArg
      ) {
        return console.log("The data returned by the interface is incomplete:", walletParamsData);
      }

      gasPrice = walletParamsData.data.gasPrice;
      sequence = walletParamsData.data.sequence;
      maxGasAmount = walletParamsData.data.maxGasAmount;
      typeArg = walletParamsData.data.typeArg;

      console.log("Data returned by Aptos:", {
        gasPrice,
        nonce,
        sequence,
        maxGasAmount,
        typeArg,
      });
    } else if (families?.cosmos?.includes?.(postChain)) {
      const data = walletParamsData?.data || {};
      if (
        data.gasPrice == null ||
        data.sequence == null ||
        data.accountNumber == null
      ) {
        return console.log("The data returned by the interface is incomplete:", walletParamsData);
      }
      gasPrice = data.gasPrice;
      nonce = data.nonce ?? "";
      sequence = Number(data.sequence);
      gasLimit = Number(data.gasLimit ?? data.maxGasAmount ?? 120000);
      maxGasAmount = Number(data.maxGasAmount ?? data.gasLimit ?? gasLimit);
      accountNumber = Number(data.accountNumber);
      const feeAmountRaw = data.feeAmount;
      effectiveFeeAmountStr =
        feeAmountRaw != null ? String(feeAmountRaw) : "3000";
      effectiveFeeAmount = feeAmountRaw != null ? Number(feeAmountRaw) : 3000;
      const heightNum = Number(data.height ?? data.heigh);
      heigh =
        Number.isFinite(heightNum) && heightNum > 0 ? heightNum : undefined;

      const selectedFeeAtom = Number(
        selectedFeeTab === "Recommended" ? recommendedFee : rapidFeeValue,
      );
      if (Number.isFinite(selectedFeeAtom) && selectedFeeAtom > 0) {
        effectiveFeeAmountStr = String(Math.round(selectedFeeAtom * 1e6));
        effectiveFeeAmount = Number(effectiveFeeAmountStr);
        console.log("Cosmos uses the UI to select the fee coverage:", {
          selectedFeeTab,
          selectedFeeAtom,
          feeAmountUatom: effectiveFeeAmountStr,
        });
      } else if (effectiveFeeAmountStr == null || effectiveFeeAmount == null) {
        const gp = Number(gasPrice);
        const gl = Number(gasLimit);
        if (Number.isFinite(gp) && Number.isFinite(gl)) {
          const derived = Math.round(gp * gl);
          effectiveFeeAmountStr = String(derived);
          effectiveFeeAmount = derived;
          console.log("Cosmos derives the handling fee based on gasLimit*gasPrice:", {
            gasPrice,
            gasLimit,
            feeAmountUatom: effectiveFeeAmountStr,
          });
        }
      }

      console.log("Data returned by cosmos (final use):", {
        gasPrice,
        nonce,
        sequence,
        gasLimit,
        maxGasAmount,
        accountNumber,
        feeAmount: effectiveFeeAmountStr,
        height: heigh,
      });
    } else if (families?.sol?.includes?.(postChain)) {
      if (walletParamsData.data?.blockHash == null) {
        return console.log("The data returned by the interface is incomplete:", walletParamsData);
      }
      const { blockHash: solBlockHash } = walletParamsData.data;
      blockHash = solBlockHash;
      console.log(`Data returned by solana (${accountAPI.getSignParam}):`, {
        blockHash,
      });
    } else if (families?.sui?.includes?.(postChain)) {
      const {
        gasPrice: suiGasPrice,
        gasLimit: suiGasLimit,
        suiObjects: suiObjectsRaw,
        tokenObjects: tokenObjectsRaw,
        epoch: suiEpoch,
      } = walletParamsData.data;

      gasPrice = Number(suiGasPrice);
      gasLimit = Number(suiGasLimit);
      epoch = Number(suiEpoch);

      const normalizedSuiObjects = Array.isArray(suiObjectsRaw)
        ? suiObjectsRaw
            .filter((o) => o?.objectId)
            .map((o) => ({
              objectId: o.objectId,
              digest: o.digest,
              version: Number(o.version),
            }))
        : [];
      const inspectedSuiObjects = await inspectSuiObjects(suiObjectsRaw);
      const gasObjects = inspectedSuiObjects
        .filter((o) => isSuiGasCoinType(o.type))
        .map(({ objectId, digest, version }) => ({
          objectId,
          digest,
          version: Number(version),
        }));
      if (!gasObjects.length) {
        console.log(
          "The available gas object of Sui is empty and the signing process is terminated:",
          {
            rawCount: Array.isArray(suiObjectsRaw) ? suiObjectsRaw.length : 0,
          },
        );
        return;
      }
      const normalizedContract = normalizeSuiTypeTag(contractAddress);
      const tokenCandidatesFromTypes = inspectedSuiObjects
        .filter((o) => {
          const normalizedType = normalizeSuiTypeTag(o.type);
          if (!normalizedType || isSuiGasCoinType(normalizedType)) return false;
          return normalizedContract
            ? normalizedType.includes(`<${normalizedContract}::`)
            : false;
        })
        .map(({ objectId, digest, version }) => ({
          objectId,
          digest,
          version: Number(version),
        }));
      const fallbackTokenObjects = Array.isArray(tokenObjectsRaw)
        ? tokenObjectsRaw
            .filter((o) => o?.objectId)
            .map((o) => ({
              objectId: o.objectId,
              digest: o.digest,
              version: Number(o.version),
            }))
        : [];
      const gasObjectIds = new Set(gasObjects.map((o) => o.objectId));
      const dedupeByObjectId = (list) => {
        const seen = new Set();
        return list.filter((o) => {
          const id = String(o?.objectId || "");
          if (!id || seen.has(id) || gasObjectIds.has(id)) return false;
          seen.add(id);
          return true;
        });
      };
      suiObjects = gasObjects;
      tokenObjects = dedupeByObjectId(
        tokenCandidatesFromTypes.length ? tokenCandidatesFromTypes : fallbackTokenObjects,
      );

      console.log("Extracted Sui parameters:", {
        gasPrice,
        gasLimit,
        epoch,
        objects: suiObjects,
        tokenObjects,
        allSuiObjects: normalizedSuiObjects,
        inspectedSuiObjects,
        backendTokenObjects: fallbackTokenObjects,
      });
    } else if (families?.xrp?.includes?.(postChain)) {
      const { fee: feeDropsRaw, sequence: seqRaw } =
        walletParamsData.data || {};
      fee = Number(feeDropsRaw); // fee is already drops, don’t add gasPrice anymore
      sequence = Number(seqRaw); // Ripple sequence is the account sequence number

      console.log("Ripple parameter extraction successful:", { fee, sequence });
    } else {
      if (
        !walletParamsData.data?.gasPrice ||
        walletParamsData.data?.nonce == null
      ) {
        return console.log("The data returned by the interface is incomplete:", walletParamsData);
      }
      const { gasPrice, nonce, sequence } = walletParamsData.data;
      console.log("Data returned by other chains:", { gasPrice, nonce, sequence });
    }

    const getChainMappingMethod = (chainKey) => {
      if (families.evm.includes(chainKey)) return "evm";
      if (families.dogecoin.includes(chainKey)) return "dogecoin";
      if (families.btc.includes(chainKey)) return "btc";
      if (families.tron.includes(chainKey)) return "tron";
      if (families.aptos.includes(chainKey)) return "aptos";
      if (families.cosmos.includes(chainKey)) return "cosmos";
      if (families.sol.includes(chainKey)) return "solana";
      if (families.sui.includes(chainKey)) return "sui";
      if (families.xrp.includes(chainKey)) return "ripple";
      return null;
    };

    const chainMethod = getChainMappingMethod(chainKey);
    let requestData = null;

    const getPublicKeyByChain = async (chainKey) => {
      try {
        const key = await getSecureItem(
          `pubkey_${String(chainKey).toLowerCase()}`,
          [`pubkey_${String(chainKey).toLowerCase()}`],
        );
        if (key) return key;
      } catch (e) {
        console.log("Failed to read local public key:", e?.message || e);
      }
      return "";
    };

    const selectedFeeAmountCoin =
      Number(
        selectedFeeTab === "Recommended" ? recommendedFee : rapidFeeValue,
      ) || 0;
    const isBtcFamily = families?.btc?.includes?.(chainKey);

    const guessOutputTypeFromAddress = (addr) => {
      if (!addr || typeof addr !== "string") return "P2WPKH";
      const a = addr.toLowerCase();
      if (a.startsWith("bc1") || a.startsWith("tb1")) return "P2WPKH";
      if (a.startsWith("1") || a.startsWith("m") || a.startsWith("n"))
        return "P2PKH";
      if (a.startsWith("3") || a.startsWith("2")) return "P2SH_P2WPKH";
      return "P2WPKH";
    };

    const INPUT_VBYTES = { P2PKH: 148, P2WPKH: 68, P2SH_P2WPKH: 91 };
    const OUTPUT_VBYTES = { P2PKH: 34, P2WPKH: 31, P2SH_P2WPKH: 32 };

    const guessInputType = (utxo) => {
      const t = (
        utxo?.scriptType ||
        utxo?.scriptPubKeyType ||
        utxo?.type ||
        ""
      ).toUpperCase();
      if (t.includes("P2WPKH")) return "P2WPKH";
      if (t.includes("P2SH") && t.includes("WPKH")) return "P2SH_P2WPKH";
      if (t.includes("P2PKH")) return "P2PKH";
      return guessOutputTypeFromAddress(utxo?.address);
    };

    const estimateBtcVSize = (utxos = [], fromAddr, toAddr) => {
      try {
        let inV = 0;
        for (const u of utxos) {
          const it = guessInputType(u);
          inV += INPUT_VBYTES[it] ?? 68;
        }
        const toType = guessOutputTypeFromAddress(toAddr);
        const changeType = guessOutputTypeFromAddress(fromAddr);
        const outV =
          (OUTPUT_VBYTES[toType] ?? 31) + (OUTPUT_VBYTES[changeType] ?? 31);
        const base = 10;
        const total = base + inV + outV;
        return total;
      } catch {
        return Math.max(68 * (utxos?.length || 1) + 31 * 2 + 10, 180);
      }
    };

    if (chainMethod === "evm") {
      const isNative = String(coinType || "").toLowerCase() === "native";
      const normalizedContractAddress = String(contractAddress || "").trim();
      if (!isNative && !normalizedContractAddress) {
        const assetLabel = String(tokenShortName || tokenFullName || "token").trim();
        console.log("EVM token transfer is missing contractAddress, terminating signing flow:", {
          chainKey,
          coinType,
          asset: assetLabel,
          contractAddress,
        });
        await notifySignFailure(
          t
            ? t("Token contract is missing. Please refresh assets and try again.")
            : "Token contract is missing. Please refresh assets and try again.",
        );
        return;
      }
      requestData = {
        chain: chainKey,
        chainKey: chainKey,
        nonce: Number(nonce),
        gasLimit: gasLimit,
        gasPrice: gasPrice,
        value: isNative ? Number(amount) : 0,
        to: inputAddress,
        contractAddress: isNative ? "" : normalizedContractAddress,
        contractValue: isNative ? 0 : Number(amount),
      };
    } else if (chainMethod === "btc") {
      const normalizedUtxoList = utxoList.map((utxo) => ({
        ...utxo,
        amount: Number(utxo.amount),
      }));

      let feeRateToUse = Number(feeRate);
      if (isBtcFamily && selectedFeeAmountCoin > 0) {
        const estVb = estimateBtcVSize(
          normalizedUtxoList,
          paymentAddress,
          inputAddress,
        );
        const satTotal = Math.max(1, Math.floor(selectedFeeAmountCoin * 1e8));
        const derived = Math.max(1, Math.floor(satTotal / Math.max(estVb, 1)));
        feeRateToUse = derived;
        console.log("BTC rate coverage (based on UI selection):", {
          selectedFeeTab,
          selectedFeeAmountCoin,
          estVb,
          satTotal,
          derivedFeeRate: feeRateToUse,
          serverFeeRate: Number(feeRate),
        });
      } else {
        console.log("BTC server feeRate:", {
          serverFeeRate: Number(feeRate),
        });
      }

      requestData = {
        chain: chainKey,
        chainKey: chainKey,
        inputs: normalizedUtxoList,
        feeRate: Number(feeRateToUse),
        receiveAddress: canonicalizeAddressForTransport(chainKey, inputAddress),
        receiveAmount: Number(amount),
        changeAddress: canonicalizeAddressForTransport(chainKey, paymentAddress),
      };
    } else if (chainMethod === "dogecoin") {
      const normalizedUtxoList = utxoList.map((utxo) => ({
        ...utxo,
        amount: Number(utxo.amount),
      }));

      requestData = {
        chain: chainKey,
        chainKey: chainKey,
        inputs: normalizedUtxoList,
        feeRate: Number(feeRate),
        receiveAddress: inputAddress,
        receiveAmount: Number(amount),
        changeAddress: paymentAddress,
      };
    } else if (chainMethod === "tron") {
      requestData = {
        chain: chainKey,
        chainKey,
        value: Number(amount),
        to: inputAddress,
        contractAddress: "",
      };
    } else if (chainMethod === "aptos") {
      const now = Math.floor(Date.now() / 1000);

      requestData = {
        chain: chainKey,
        from: paymentAddress,
        sequenceNumber: Number(sequence),
        maxGasAmount: Number(maxGasAmount),
        gasUnitPrice: Number(gasPrice),
        receiveAddress: inputAddress,
        receiveAmount: Number(amount),
        typeArg: typeArg,
        expiration: now + 600,
      };
      console.log("Aptos expiration:", requestData.expiration);
    } else if (chainMethod === "cosmos") {
      const cosmosPubKey = await getPublicKeyByChain(chainKey);
      console.log(
        "[DEBUG] Cosmos public key (from getPublicKeyByChain):",
        cosmosPubKey,
      );
      {
        const timeoutHeightNum = Number(heigh);
        requestData = {
          chain: chainKey,
          from: paymentAddress,
          to: inputAddress,
          amount: Number(amount),
          sequence: Number(sequence),
          chainKey: "cosmos",
          accountNumber: Number(accountNumber),
          feeAmount: String(effectiveFeeAmountStr),
          gasLimit: Number(gasLimit),
          memo: "",
          ...(Number.isFinite(timeoutHeightNum) && timeoutHeightNum > 0
            ? { timeoutHeight: timeoutHeightNum }
            : {}),
          publicKey: cosmosPubKey,
        };
      }
    } else if (chainMethod === "solana") {
      requestData = {
        chain: chainKey,
        from: paymentAddress,
        to: inputAddress,
        hash: blockHash,
        mint: contractAddress || "",
        amount: Number(amount),
        isNft: false,
      };
    } else if (chainMethod === "sui") {
      const parsedSuiGasLimit = Number(gasLimit);
      const effectiveSuiGasLimit =
        Number.isFinite(parsedSuiGasLimit) && parsedSuiGasLimit > 0
          ? parsedSuiGasLimit
          : 100000000;
      const suiTransferType = resolveSuiTransferType({
        chainKey,
        coinType,
        contractAddress,
        tokenShortName,
      });
      const parsedTokenDecimals = Number(tokenDecimals);
      const normalizedTokenDecimals =
        Number.isFinite(parsedTokenDecimals) && parsedTokenDecimals >= 0
          ? parsedTokenDecimals
          : undefined;
      if (suiTransferType === "token" && !(tokenObjects || []).length) {
        console.log(
          "Sui token transfer is missing tokenObjects, terminating signing flow:",
          {
            contractAddress: String(contractAddress || "").trim(),
            tokenShortName,
          },
        );
        return;
      }
      requestData = {
        chainKey,
        type: suiTransferType,
        from: paymentAddress,
        to: inputAddress,
        amount: Number(amount),
        gasPrice: Number(gasPrice),
        gasBudget: effectiveSuiGasLimit,
        epoch: Number(epoch),
        contractAddress: String(contractAddress || "").trim(),
        ...(suiTransferType === "token"
          ? {
              ...(normalizedTokenDecimals != null
                ? { decimals: normalizedTokenDecimals }
                : {}),
              tokenobjects: (tokenObjects || []).map((o) => ({
                objectId: o.objectId,
                digest: o.digest,
                version: Number(o.version),
              })),
            }
          : {}),
        objects: (suiObjects || []).map((o) => ({
          objectId: o.objectId,
          digest: o.digest,
          version: Number(o.version),
        })),
      };

      console.log("Constructed Sui requestData:", requestData);
    } else if (chainMethod === "ripple") {
      const sequenceNum = Number(sequence);

      requestData = {
        chain: chainKey,
        from: paymentAddress,
        to: inputAddress,
        amount: Number(amount),
        fee: String(fee),
        sequence: sequenceNum,
        publicKey: await getPublicKeyByChain("ripple"),
      };
    }
    let signApiName = "";
    let responseData;
    if (chainMethod === "tron") {
      const latestBlock = tronLatestBlock || {
        hash: "",
        number: null,
        timestamp: null,
      };
      if (!latestBlock?.hash) {
        console.log(
          `TRON block info is empty, using placeholder data:\n${JSON.stringify(
            latestBlock,
            null,
            2,
          )}`,
        );
      }

      const decimalsOverride = 6;
      const valueBaseUnits = String(
        Math.max(
          0,
          Math.round(Number(amount) * Math.pow(10, decimalsOverride)),
        ),
      );
      const feeInTrx = Number(transactionFee);
      const feeSun = Number.isFinite(feeInTrx)
        ? Math.max(0, Math.round(feeInTrx * 1e12))
        : 1000000;

      const tronPayload = {
        token: "",
        contract_address: contractAddress || "",
        from: paymentAddress,
        to: inputAddress,
        value: valueBaseUnits,
        latest_block: latestBlock,
        override: {
          token_short_name: tokenShortName,
          token_full_name: tokenFullName,
          decimals: decimalsOverride,
        },
        fee: feeSun,
        memo: "",
      };

      responseData = { data: { data: JSON.stringify(tronPayload) } };
      console.log(
        `TRON pre-sign payload constructed locally:\n${JSON.stringify(tronPayload, null, 2)}`,
      );
    } else if (chainMethod === "dogecoin") {
      const dogePresignJson = JSON.stringify(requestData);
      responseData = { data: { data: dogePresignJson } };
      console.log("Pre-signed data (JSON) constructed by DOGE:", dogePresignJson);
    } else {
      let signApiUrl = null;
      switch (chainMethod) {
        case "evm":
          signApiUrl = signAPI.encode_evm;
          signApiName = "signAPI.encode_evm";
          break;
        case "btc":
          signApiUrl = signAPI.encode_btc;
          signApiName = "signAPI.encode_btc";
          break;
        case "aptos":
          signApiUrl = signAPI.encode_aptos;
          signApiName = "signAPI.encode_aptos";
          break;
        case "cosmos":
          signApiUrl = signAPI.encode_cosmos;
          signApiName = "signAPI.encode_cosmos";
          break;
        case "solana":
          signApiUrl = signAPI.encode_solana;
          signApiName = signAPI.encode_solana;
          break;
        case "sui":
          signApiUrl = signAPI.encode_sui;
          signApiName = "signAPI.encode_sui";
          break;
        case "ripple":
          signApiUrl = signAPI.encode_xrp;
          signApiName = "signAPI.encode_xrp";
          break;
      }

      if (!signApiUrl) {
        console.log("Unsupported chainMethod:", chainMethod);
        return;
      }
      logFlowStep(
        "5/7",
        "ENCODE_PRESIGN",
        "",
        { chainMethod, endpoint: signApiUrl }
      );
      console.log(
        `requestData(${signApiName}):\n${JSON.stringify(requestData, null, 2)}`,
      );
      const response = await fetch(signApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      responseData = await response.json();
      console.log(
        `Pre-sign data returned by the transaction request (${
          signApiName || "unknown"
        }):\n${JSON.stringify(responseData, null, 2)}`,
      );
    }

    try {
      if (chainMethod === "solana" && responseData?.data?.data) {
        const protocolType =
          normalizedProtocol && normalizedProtocol !== "native"
            ? normalizedProtocol
            : "";
        const ctx = {
          from: paymentAddress,
          to: inputAddress,
          hash: blockHash,
          mint: contractAddress || "",
          amount: Number(amount),
          isNft: false,
          ...(protocolType ? { protocolType } : {}),
        };
        await AsyncStorage.setItem(
          "solanaBroadcastContext",
          JSON.stringify(ctx),
        );
      }
      if (chainMethod === "aptos" && responseData?.data?.data) {
        const ctx = {
          from: paymentAddress,
          sequenceNumber: Number(sequence),
          maxGasAmount: Number(maxGasAmount),
          gasUnitPrice: Number(gasPrice),
          receiveAddress: inputAddress,
          receiveAmount: Number(amount),
          typeArg: typeArg,
          expiration: requestData.expiration,
          publicKey: await getPublicKeyByChain("aptos"),
        };
        await AsyncStorage.setItem(
          "aptosBroadcastContext",
          JSON.stringify(ctx),
        );
        console.log(
          "Saved Aptos broadcast context; monitorSignedResult will continue after signResult:",
          ctx,
        );
      }
      if (chainMethod === "sui" && responseData?.data?.data) {
        const parsedCtxSuiGasLimit = Number(
          requestData?.gasBudget ?? gasLimit
        );
        const parsedCtxTokenDecimals = Number(requestData?.decimals);
        const ctxSuiGasLimit =
          Number.isFinite(parsedCtxSuiGasLimit) && parsedCtxSuiGasLimit > 0
            ? parsedCtxSuiGasLimit
            : 100000000;
        const ctx = {
          chainKey,
          type: resolveSuiTransferType({
            chainKey,
            coinType,
            contractAddress,
            tokenShortName,
          }),
          objects: suiObjects.map((o) => ({
            objectId: o.objectId,
            digest: o.digest,
            version: Number(o.version),
          })),
          from: paymentAddress,
          to: inputAddress,
          amount: Number(amount),
          gasPrice: Number(gasPrice),
          gasBudget: ctxSuiGasLimit,
          epoch: Number(epoch),
          contractAddress: String(contractAddress || "").trim(),
          ...(Number.isFinite(parsedCtxTokenDecimals)
            ? { decimals: parsedCtxTokenDecimals }
            : {}),
          tokenObjects: (tokenObjects || []).map((o) => ({
            objectId: o.objectId,
            digest: o.digest,
            version: Number(o.version),
          })),
        };
        await AsyncStorage.setItem("suiBroadcastContext", JSON.stringify(ctx));
        console.log(
          "Saved Sui broadcast context; monitorSignedResult will continue after signResult:",
          ctx,
        );
      }
      if (chainMethod === "cosmos" && responseData?.data?.data) {
        const timeoutHeightNum = Number(heigh);
        const ctx = {
          from: paymentAddress,
          to: inputAddress,
          amount: Number(amount),
          sequence: Number(sequence),
          chainKey: "cosmos",
          accountNumber: Number(accountNumber),
          feeAmount: String(effectiveFeeAmountStr),
          gasLimit: Number(gasLimit),
          memo: "",
          ...(Number.isFinite(timeoutHeightNum) && timeoutHeightNum > 0
            ? { timeoutHeight: timeoutHeightNum }
            : {}),
          publicKey: await getPublicKeyByChain(chainKey),
        };
        await AsyncStorage.setItem(
          "cosmosBroadcastContext",
          JSON.stringify(ctx),
        );
        console.log(
          "Saved Cosmos broadcast context; monitorSignedResult will continue after signResult:",
          ctx,
        );
      }
    } catch (e) {
      console.log("Save Broadcast context error:", e?.message || e);
    }

    logFlowStep(
      "6/7",
      "WAIT_SIGN_RESULT",
      "",
      { chainMethod }
    );
    monitorSignedResult(device);

    async function sendInChunks(
      device,
      serviceUUID,
      writeCharacteristicUUID,
      base64Str,
      chunkSize = 220,
    ) {
      let offset = 0;
      const totalLen = base64Str.length;
      let chunkIndex = 0;
      const totalChunks = Math.ceil(totalLen / chunkSize);

      while (offset < totalLen) {
        const isLastChunk = chunkIndex === totalChunks - 1;
        let chunk = base64Str.slice(offset, offset + chunkSize);

        if (RUNTIME_DEV) {
          const previewHead = chunk.slice(0, 16);
          const previewTail = chunk.slice(-16);
          console.log(
            `Sending chunk [${chunkIndex}/${totalChunks}] offset=${offset}, length=${chunk.length}, total=${totalLen}, isLast=${isLastChunk}, preview=${previewHead}...${previewTail}`,
          );
        }

        await device.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          chunk,
        );

        await new Promise((resolve) => setTimeout(resolve, 5));
        offset += chunkSize;
        chunkIndex++;
      }
      if (RUNTIME_DEV) {
        console.log(`Subpackage sending completed, total number of packages: ${totalChunks}`);
      }
    }

    const notifySignFailure = async (message) => {
      try {
        if (typeof setCheckStatusModalVisible === "function") {
          setCheckStatusModalVisible(false);
        }
        if (typeof setErrorModalMessage === "function") {
          setErrorModalMessage(message);
        }
        if (typeof setErrorModalVisible === "function") {
          setErrorModalVisible(true);
        }
      } catch {}
      try {
        const msg = frameBle(bleCmd.bcastFail());
        await device.writeCharacteristicWithResponseForService(
          serviceUUID,
          writeCharacteristicUUID,
          msg,
        );
        console.log(`BCAST_FAIL sent to embedded (pre-sign failed: ${signApiName})`);
        disconnectBleSafely(`presign_fail:${signApiName || "unknown"}`);
      } catch (err) {
        console.log(`Error while sending BCAST_FAIL(Presign failed: ${signApiName}):`, err);
      }
    };

    if (responseData?.data?.data) {
      const signPayloadRaw = responseData.data.data;
      let signPayloadPretty = signPayloadRaw;
      try {
        signPayloadPretty = JSON.stringify(JSON.parse(signPayloadRaw), null, 2);
      } catch {}
      const signMessage = bleCmd.sign(chainKey, path, signPayloadRaw) + "\r\n";
      console.log(
        `App sends the payload waiting for device signature:\nchain=${chainKey}\npath=${path}\npayload=${signPayloadPretty}`,
      );
      const signBuffer = Buffer.from(signMessage, "utf-8");
      const signBase64 = signBuffer.toString("base64");
      try {
        logFlowStep(
          "7/7",
          "SEND_PRESIGN_TO_DEVICE",
          "",
          { chain: chainKey, path }
        );
        await sendInChunks(
          device,
          serviceUUID,
          writeCharacteristicUUID,
          signBase64,
          220,
        );
        if (RUNTIME_DEV) {
          console.log("The sign message has been successfully subcontracted and sent to the device.");
        }
      } catch (error) {
        if (RUNTIME_DEV) {
          console.log("An error occurred while subcontracting and sending the sign message:", error);
        }
      }
    } else {
      console.log(
        `Returned data does not include sign payload data from the server (${signApiName})`,
      );
      const reason =
        responseData?.error ||
        responseData?.msg ||
        "Sign failed. Please try again.";
      await notifySignFailure(reason);
    }

    return responseData;
  } catch (error) {
    console.log("Failed to process transaction:", error.message || error);
  }
};

export default signTransaction;
