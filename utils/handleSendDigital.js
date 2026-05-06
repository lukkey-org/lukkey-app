/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { accountAPI, signAPI } from "../env/apiEndpoints";
import { families } from "../config/mappingRegistry";
import assetOps from "../config/assetOps";
import { isBleDisconnectError } from "./bleErrors";
import { getSecureItem } from "./secureStorage";
import {
  createBleTransactionId,
  safeRemoveSubscription,
} from "./bleSubscription";
import { bleCmd, frameBle, parseResp } from "./bleProtocol";
import { ensureScreenUnlocked } from "./ensureScreenUnlocked";
import { resolveTransportAddrFormat } from "./addressTransportFormat";

const LOG_GREEN = "\x1b[32m";
const LOG_RED = "\x1b[31m";
const LOG_RESET = "\x1b[0m";
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
const logFlowEnd = (title, meta) => {
  const line = "=".repeat(64);
  console.log(`${LOG_RED}${line}${LOG_RESET}`);
  console.log(`${LOG_RED}${title}${LOG_RESET}`, meta || "");
  console.log(`${LOG_RED}${line}${LOG_RESET}`);
};

async function sendInChunks(
  device,
  serviceUUID,
  writeCharacteristicUUID,
  base64Str,
  chunkSize = 220
) {
  let offset = 0;
  const totalLen = base64Str.length;
  let chunkIndex = 0;
  const totalChunks = Math.ceil(totalLen / chunkSize);

  while (offset < totalLen) {
    const isLastChunk = chunkIndex === totalChunks - 1;
    const chunk = base64Str.slice(offset, offset + chunkSize);

    console.log(
      `Sending chunk [${chunkIndex}/${totalChunks}] offset=${offset}, length=${chunk.length}, total=${totalLen}, isLast=${isLastChunk}`
    );

    await device.writeCharacteristicWithResponseForService(
      serviceUUID,
      writeCharacteristicUUID,
      chunk
    );

    await new Promise((r) => setTimeout(r, 5));
    offset += chunkSize;
    chunkIndex++;
  }
  console.log(`Subpackage sending completed, total number of packages: ${totalChunks}`);
}

const getChainMappingMethod = (chainKey) => {
  if (families.evm.includes(chainKey)) return "evm";
  if (families.sol.includes(chainKey)) return "solana";
  return null;
};
export const handleSendDigital = async ({
  selectedNFT,
  device,
  Buffer,
  serviceUUID,
  writeCharacteristicUUID,
  notifyCharacteristicUUID,
  recipientAddress,
  paymentAddress,
  setModalStatus,
  t,
  monitorSubscription,
  monitorSignedResult,
  setVerificationStatus,
  setBleVisible,
  setCheckStatusModalVisible,
  selectedFeeTab,
  recommendedFee,
  rapidFeeValue,
  isDarkMode,
}) => {
  if (!accountAPI?.enabled || !signAPI?.enabled) {
    console.log("Chain API is not configured, NFT send flow skipped");
    return;
  }

  try {
    const targetDevice = device;
    if (!targetDevice) {
      console.log("The device object is missing. Device pre-check needs to be completed first.");
      return;
    }
    if (!selectedNFT) {
      console.log("selectedNFT is empty");
      return;
    }
    const contractAddress =
      selectedNFT?.tokenContractAddress || selectedNFT?.contractAddress || "";
    const hasLegacyTokenId = selectedNFT?.tokenId != null;
    const rawTokenId = hasLegacyTokenId
      ? String(selectedNFT.tokenId)
      : selectedNFT?.mint != null
      ? String(selectedNFT.mint)
      : "";
    const tokenIdStr = rawTokenId.trim();
    const mintAddress = String(
      selectedNFT?.mintAddress ??
        selectedNFT?.rawMintAddress ??
        (hasLegacyTokenId ? selectedNFT?.mint ?? "" : ""),
    ).trim();
    let resolvedTokenId = tokenIdStr;
    const chainKey = selectedNFT?.queryChainName?.toLowerCase?.() || "";
    const protocolType = String(selectedNFT?.protocolType || "").trim();
    const normalizedProtocolType = protocolType.toUpperCase();
    const amount = Number(selectedNFT?.amount) || 1;

    logFlowStart("[SIGN_FLOW][START] review-confirm NFT transfer", {
      assetType: "NFT",
      chain: chainKey || "",
      protocolType,
      from: paymentAddress || "",
      to: recipientAddress || "",
      tokenId: tokenIdStr || rawTokenId || "",
      contractAddress,
      amount,
    });

    const requiresNumericTokenId = chainKey !== "solana";
    if (
      !tokenIdStr ||
      (requiresNumericTokenId && !/^\d+$/.test(tokenIdStr)) ||
      !chainKey
    ) {
      console.log("NFT key information is missing or tokenId is illegal:", {
        contractAddress,
        tokenId: rawTokenId,
        chainKey,
      });
    }
    if (!recipientAddress) {
      console.log("recipientAddress is missing");
      return;
    }
    if (!paymentAddress) {
      console.log("paymentAddress is missing");
      return;
    }
    if (!serviceUUID || !writeCharacteristicUUID || !notifyCharacteristicUUID) {
      console.log("BLE UUID configuration is incomplete");
      return;
    }

    const path = assetOps[chainKey];
    if (!path) {
      console.log(`Unsupported paths: ${chainKey}`);
      logFlowEnd("[SIGN_FLOW][END] NFT transfer aborted", {
        stage: "unsupported-path",
        chainKey,
      });
      return;
    }
    logFlowStep("1/7", "ACCOUNT_ID verify", "resolve nft path", {
      assetType: "NFT",
      chainKey,
      path,
      tokenId: tokenIdStr,
    });

    try {
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
    } catch (connErr) {
      console.log("Failed to connect to device and invoke Bluetooth pairing:", connErr?.message || connErr);
      logFlowEnd("[SIGN_FLOW][END] NFT transfer aborted", {
        stage: "device-connect-failed",
        message: connErr?.message || String(connErr || ""),
      });
      try {
        setCheckStatusModalVisible && setCheckStatusModalVisible(false);
      } catch {}
      try {
        setBleVisible && setBleVisible(true);
      } catch {}
      return;
    }

    const storedAccountId =
      (await getSecureItem("accountId", ["currentAccountId"])) ?? "";

    const feePreference =
      selectedFeeTab === "Recommended" ? "recommended" : "rapid";
    const transactionFeeSelected =
      Number(
        (selectedFeeTab === "Recommended" ? recommendedFee : rapidFeeValue) || 0
      ) || 0;

    try {
 
      await ensureScreenUnlocked(targetDevice, { label: "NFT_SEND" });
    } catch (screenErr) {
      const msg = String(screenErr?.message || screenErr);
      console.log("[NFT_SEND] screen check failed:", msg);
      if (msg === "SCREEN_PWD_CANCEL" || msg === "SCREEN_CHECK_TIMEOUT") {
        try { setVerificationStatus && setVerificationStatus(null); } catch {}
        try { setCheckStatusModalVisible && setCheckStatusModalVisible(false); } catch {}
        if (msg === "SCREEN_PWD_CANCEL") {
          try {
            if (typeof global !== "undefined" && typeof global.__SHOW_APP_TOAST__ === "function") {
              setTimeout(() => {
                global.__SHOW_APP_TOAST__({
                  message: t ? t("NFT transaction canceled") : "NFT transaction canceled",
                  variant: "cancel",
                  durationMs: 3000,
                  showCountdown: true,
                });
              }, 200);
            }
          } catch {}
        }
        try {
          const isConn = await targetDevice?.isConnected?.();
          if (isConn) await targetDevice.cancelConnection();
        } catch {}
        return;
      }
      throw screenErr;
 
    }

    const destAddrFormat = resolveTransportAddrFormat(chainKey, paymentAddress);
    const firstTradeMsg =
      bleCmd.destAddr(
        paymentAddress,
        recipientAddress,
        transactionFeeSelected,
        chainKey,
        storedAccountId,
        destAddrFormat
      ) + "\r\n";
    const firstTradeBase64 = Buffer.from(firstTradeMsg, "utf-8").toString("base64");
    logFlowStep("2/7", "DEST_ADDR send", "wait for device signature gate", {
      assetType: "NFT",
      chainKey,
      addrFormat: destAddrFormat,
      feePreference,
      transactionFeeSelected,
      storedAccountId,
    });
    console.log("The first step is to send transaction information (NFT):", firstTradeMsg);
    console.log("Wait for the device to send the Signed_OK command...(NFT)");
    let signedRejectDisconnected = false;
    const triggerSignedRejectToast = () => {
      if (
        typeof global !== "undefined" &&
        typeof global.__SHOW_APP_TOAST__ === "function"
      ) {
        setTimeout(() => {
          global.__SHOW_APP_TOAST__({
            message: t
              ? t("Device signature rejected, NFT transaction canceled")
              : "Device signature rejected, NFT transaction canceled",
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
        safeRemoveSubscription(monitorSubscription?.current);
        if (monitorSubscription && typeof monitorSubscription === "object") {
          monitorSubscription.current = null;
        }
      } catch {}
      setTimeout(async () => {
        try {
          const isConn = await targetDevice?.isConnected?.();
          if (isConn) {
            await targetDevice.cancelConnection();
            console.log(
              `[SIGN_REJECT] Device disconnected: ${targetDevice?.id}`
            );
          } else {
            console.log("[SIGN_REJECT] Device already disconnected");
          }
        } catch (e) {
          console.log(
            "[SIGN_REJECT] cancelConnection error (ignored):",
            e?.message || e
          );
        }
      }, 300);
    };
    const signedResult = await new Promise((resolve) => {
      let isResolved = false;
      try {
        safeRemoveSubscription(monitorSubscription?.current);
      } catch {}
      if (monitorSubscription && typeof monitorSubscription === "object") {
        monitorSubscription.current = null;
      }
      const signedTxId = createBleTransactionId("nft-signed", targetDevice?.id);
      monitorSubscription &&
        (monitorSubscription.current =
          targetDevice.monitorCharacteristicForService(
            serviceUUID,
            notifyCharacteristicUUID,
            (error, characteristic) => {
              if (error) {
                if (isBleDisconnectError(error)) {
                  try {
                    safeRemoveSubscription(monitorSubscription?.current);
                  } catch {}
                  try {
                    if (
                      monitorSubscription &&
                      typeof monitorSubscription === "object"
                    ) {
                      monitorSubscription.current = null;
                    }
                  } catch {}
                  resolve({ disconnected: true });
                  return;
                }
                console.log("Error while listening for Signed_OK (NFT):", error.message);
                return;
              }
              const text = Buffer.from(characteristic.value, "base64").toString(
                "utf8"
              );
              const raw = Buffer.from(characteristic.value, "base64");
              const received = text.replace(/[\x00-\x1F\x7F]/g, "").trim();

              console.log("Device response received (sanitized):", received);
              if (
                !isResolved &&
                (() => {
                  const p = parseResp(received);
                  return p?.resp === "signedOk" || received.includes("Signed_OK");
                })()
              ) {
                isResolved = true;
                try {
                  safeRemoveSubscription(monitorSubscription?.current);
                } catch {}
                try {
                  if (
                    monitorSubscription &&
                    typeof monitorSubscription === "object"
                  ) {
                    monitorSubscription.current = null;
                  }
                } catch {}
                try {
                  setModalStatus &&
                    setModalStatus({
                      title: t ? t("Device Confirmed") : "Device Confirmed",
                      subtitle: t
                        ? t(
                            "The device has confirmed the transaction signature."
                          )
                        : "The device has confirmed the transaction signature.",
                      image: isDarkMode
                        ? require("../assets/animations/pendingDark.webp")
                        : require("../assets/animations/pendingLight.webp"),
                    });
                } catch {}
                resolve();
              } else if (
                !isResolved &&
                (() => {
                  const p = parseResp(received);
                  return p?.resp === "signedReject" || received.includes("Signed_REJECT");
                })()
              ) {
                isResolved = true;
                try {
                  safeRemoveSubscription(monitorSubscription?.current);
                } catch {}
                try {
                  if (
                    monitorSubscription &&
                    typeof monitorSubscription === "object"
                  ) {
                    monitorSubscription.current = null;
                  }
                } catch {}
                try {
                  setCheckStatusModalVisible &&
                    setCheckStatusModalVisible(false);
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
                  const p = parseResp(received);
                  return p?.resp === "accountIdFail" || received.includes("ACCOUNT_ID_FAIL");
                })()
              ) {
                isResolved = true;
                try {
                  safeRemoveSubscription(monitorSubscription?.current);
                } catch {}
                try {
                  if (
                    monitorSubscription &&
                    typeof monitorSubscription === "object"
                  ) {
                    monitorSubscription.current = null;
                  }
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
            signedTxId
          ));

      (async () => {
        try {
          await new Promise((r) => setTimeout(r, 80));
          await targetDevice.writeCharacteristicWithResponseForService(
            serviceUUID,
            writeCharacteristicUUID,
            firstTradeBase64
          );
          console.log("The first step of transaction information has been successfully sent to the device (NFT)");
        } catch (error) {
          console.log("An error occurred while sending the first step of transaction information to the device (NFT):", error);
        }
      })();
    });
    if (signedResult?.disconnected) {
      console.log("The device has been disconnected, terminating waiting for Signed_OK");
      logFlowEnd("[SIGN_FLOW][END] NFT transfer aborted", {
        stage: "signed-gate-disconnected",
      });
      return;
    }
    if (signedResult?.rejected) {
      console.log("Device rejects signature: Signed_REJECT");
      logFlowEnd("[SIGN_FLOW][END] NFT transfer aborted", {
        stage: "signed-reject",
      });
      return;
    }
    if (signedResult?.accountIdFail) {
      console.log("Device account verification failed: ACCOUNT_ID_FAIL");
      logFlowEnd("[SIGN_FLOW][END] NFT transfer aborted", {
        stage: "account-id-fail",
      });
      return;
    }
    console.log("Device confirmation reply: Signed_OK (NFT)");
    logFlowStep("3/7", "DEVICE_SIGN_GATE ok", "Signed_OK received", {
      assetType: "NFT",
      chainKey,
    });

    const postChain = chainKey;
    const chainMethod = getChainMappingMethod(chainKey);
    if (!chainMethod) {
      console.log("NFT sending for this chain is not currently supported:", chainKey);
      logFlowEnd("[SIGN_FLOW][END] NFT transfer aborted", {
        stage: "unsupported-chain-method",
        chainKey,
      });
      return;
    }
    logFlowStep("4/7", "SIGN_PARAM fetch", "prepare nft pre-sign params", {
      assetType: "NFT",
      chainKey,
      chainMethod,
      protocolType,
    });

    let nonce, gasPrice, blockHash, gasLimit;

    if (chainMethod === "evm") {
      console.log("EVM NFT: Get pre-signed parameters...");
      const postData = {
        chain: postChain,
        from: paymentAddress,
        to: recipientAddress,
        txAmount: "0",
        extJson: {
          protocol: selectedNFT?.protocolType || "",
          tokenAddress: "",
          permissionType: "",
          feeLimit: "",
        },
      };

      console.log(
        "Sending getSignParam request (ERC NFT):\n" +
          JSON.stringify(
            {
              url: accountAPI.getSignParam,
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: postData,
            },
            null,
            2
          )
      );

      const walletParamsResponse = await fetch(accountAPI.getSignParam, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });

      if (!walletParamsResponse.ok) {
        console.log(
          "Failed to get EVM nonce/gasPrice:",
          walletParamsResponse.status
        );
        return;
      }
      const walletParamsData = await walletParamsResponse.json();
      console.log("EVM NFT getSignParam returns:", walletParamsData);

      if (walletParamsData.data?.nonce == null) {
        console.log("The data returned by the interface is incomplete (missing nonce):", walletParamsData);
        return;
      }
      nonce = walletParamsData.data.nonce;
      gasPrice =
        walletParamsData.data.gasPrice != null
          ? Number(walletParamsData.data.gasPrice)
          : undefined;
      {
        const defaultLimit = normalizedProtocolType.includes("1155")
          ? 120000
          : 53000;
        gasLimit =
          walletParamsData.data.gasLimit != null
            ? Number(walletParamsData.data.gasLimit)
            : defaultLimit;
      }
    } else if (chainMethod === "solana") {
      console.log("Solana NFT: Get pre-signed parameters...");
      const postData = {
        chain: postChain,
        from: paymentAddress,
        to: recipientAddress,
        txAmount: "1",
        extJson: {
          feePreference,
          feeSource: "blockchain-fee",
          protocol: "nft",
          tokenAddress: mintAddress || "",
        },
      };

      console.log(
        "Sending getSignParam request (Solana NFT):\n" +
          JSON.stringify(
            {
              url: accountAPI.getSignParam,
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: postData,
            },
            null,
            2
          )
      );

      const walletParamsResponse = await fetch(accountAPI.getSignParam, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });

      if (!walletParamsResponse.ok) {
        console.log("Failed to get Solana blockHash:", walletParamsResponse.status);
        return;
      }
      const walletParamsData = await walletParamsResponse.json();
      console.log("Solana NFT getSignParam returns:", walletParamsData);

      if (walletParamsData.data?.blockHash == null) {
        console.log("The data returned by the interface is incomplete (blockHash is missing):", walletParamsData);
        return;
      }
      blockHash = walletParamsData.data.blockHash;
      resolvedTokenId = String(
        walletParamsData.data?.tokenId ?? tokenIdStr ?? ""
      ).trim();
    }

    let signApiUrl = null;
    let requestData = null;

    if (chainMethod === "evm") {
      const effectiveGasLimit = Number(
        gasLimit != null
          ? gasLimit
          : normalizedProtocolType.includes("1155")
          ? 120000
          : 53000
      );

      let gasPriceToUse = null;
      if (
        (gasPrice == null || Number(gasPrice) <= 0) &&
        transactionFeeSelected > 0
      ) {
        const gasPriceEth = transactionFeeSelected / effectiveGasLimit;
        gasPriceToUse = Math.max(1, Math.round(gasPriceEth * 1e18));
        console.log("EVM NFT handling fee derivation gasPrice:", {
          selectedFeeTab,
          transactionFeeSelected,
          gasLimit: effectiveGasLimit,
          gasPriceEth,
          gasPriceWei: gasPriceToUse,
        });
      }

      requestData = {
        chainKey,
        nonce: Number(nonce),
        gasLimit: effectiveGasLimit,
        ...(gasPrice != null && Number(gasPrice) > 0
          ? { gasPrice: Number(gasPrice) }
          : gasPriceToUse != null
          ? { gasPrice: gasPriceToUse }
          : {}),
        value: 0,
        to: recipientAddress,
        from: paymentAddress,
        contractAddress: contractAddress || "",
        contractValue: normalizedProtocolType.includes("1155")
          ? Number(amount)
          : 1,
        tokenId: tokenIdStr,
      };
      signApiUrl = signAPI.encode_evm;
    } else if (chainMethod === "solana") {
      requestData = {
        chain: "solana",
        from: paymentAddress,
        to: recipientAddress,
        hash: blockHash,
        mint: mintAddress || contractAddress || "",
        ...(resolvedTokenId ? { tokenid: resolvedTokenId } : {}),
        ...(protocolType ? { protocolType } : {}),
        amount: 1,
        isNft: true,
      };
      signApiUrl = signAPI.encode_solana;
    }

    if (!signApiUrl || !requestData) {
      console.log("Unsupported NFT chain or request data construction failed:", {
        chainMethod,
        signApiUrl,
        requestData,
      });
      return;
    }

    logFlowStep("5/7", "ENCODE request", "request unsigned nft payload", {
      assetType: "NFT",
      chainKey,
      chainMethod,
      signApiUrl,
    });
    console.log(
      "NFT encode request:\n" +
        JSON.stringify(
          {
            url: signApiUrl,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestData,
          },
          null,
          2
        )
    );

    const response = await fetch(signApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });
    const responseData = await response.json();
    console.log("Pre-signed data returned by NFT transaction encode:", responseData);

    try {
      if (chainMethod === "solana" && responseData?.data?.data) {
        const ctx = {
          from: paymentAddress,
          to: recipientAddress,
          hash: blockHash,
          mint: mintAddress || "",
          amount: 1,
          isNft: true,
          protocolType,
          tokenid: resolvedTokenId,
        };
        await AsyncStorage.setItem(
          "solanaBroadcastContext",
          JSON.stringify(ctx)
        );
        console.log("Saved Solana NFT broadcast context:", ctx);
        logFlowStep("6/7", "BROADCAST context", "persist solana nft context", {
          assetType: "NFT",
          chainKey,
          from: paymentAddress,
          to: recipientAddress,
          mint: contractAddress || "",
        });
      }
    } catch (e) {
      console.log("Save broadcast context error (NFT):", e?.message || e);
    }

    try {
      logFlowStep("6/7", "BROADCAST monitor", "attach signed-result listener", {
        assetType: "NFT",
        chainKey,
      });
      typeof monitorSignedResult === "function" &&
        monitorSignedResult(targetDevice);
    } catch (e) {
      console.log("Failed to call monitorSignedResult (ignorable):", e?.message || e);
    }

    if (responseData?.data?.data) {
      const signMessage = bleCmd.sign(chainKey, path, responseData.data.data) + "\r\n";
      console.log("Constructed NFT sign message:", JSON.stringify(signMessage));
      const signBase64 = Buffer.from(signMessage, "utf-8").toString("base64");
      logFlowStep("7/7", "BLE_SIGN payload", "chunked nft sign payload send", {
        assetType: "NFT",
        chainKey,
        base64Length: signBase64.length,
      });

      try {
        await sendInChunks(
          targetDevice,
          serviceUUID,
          writeCharacteristicUUID,
          signBase64,
          220
        );
        console.log("The NFT sign message has been successfully subcontracted and sent to the device");
        logFlowStep("7/7", "BLE_SIGN payload", "nft sign payload sent", {
          assetType: "NFT",
          chainKey,
          status: "submitted-to-device",
        });
      } catch (error) {
        console.log("An error occurred while subcontracting to send NFT sign message:", error);
        logFlowEnd("[SIGN_FLOW][END] NFT transfer aborted", {
          stage: "ble-sign-send-failed",
          message: error?.message || String(error || ""),
        });
      }
    } else {
      console.log("The returned data does not contain the NFT sign message data_obtained from the server");
      logFlowEnd("[SIGN_FLOW][END] NFT transfer aborted", {
        stage: "encode-response-missing-data",
      });
      return responseData;
    }

    try {
      setModalStatus &&
        setModalStatus({
          title: t ? t("Transaction Submitted") : "Transaction Submitted",
          subtitle: t
            ? t("Waiting for device signature result…")
            : "Waiting for device signature result…",
          image: isDarkMode
            ? require("../assets/animations/pendingDark.webp")
            : require("../assets/animations/pendingLight.webp"),
        });
    } catch {}

    logFlowStep("7/7", "WAIT_DEVICE_SIGN", "handoff to monitorSignedResult", {
      assetType: "NFT",
      chainKey,
      next: "broadcast-monitor",
    });
    return responseData;
  } catch (error) {
    console.log("Handling NFT send failure:", error?.message || error);
    logFlowEnd("[SIGN_FLOW][END] NFT transfer crashed", {
      stage: "exception",
      message: error?.message || String(error || ""),
    });
  }
};
