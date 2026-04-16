/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteSecureItems } from "./secureStorage";
import { deleteAllStoredPubkeys, PUBKEY_CHAINS } from "./pubkeyStorage";
import { stripRuntimeAssetMetrics } from "./assetRuntimeFields";

const BASE_KEYS = [
  "cryptoCards",
  "addedCryptos",
  "initialAdditionalCryptos",
  "accountName",
  "accountId",
  "isVerificationSuccessful",
  "verifiedDevices",
  "deviceSecureId",
  "hardwareVersion",
  "bluetoothVersion",
  "baseVersion",
  "verificationStatus",
];

function resetInitialAdditionalCryptos(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    ...stripRuntimeAssetMetrics(item),
    address: "",
  }));
}

export async function clearWalletOnPinTimeout({
  setCryptoCards,
  setAddedCryptos,
  setInitialAdditionalCryptos,
  setAdditionalCryptos,
  setCryptoCount,
  setVerifiedDevices,
  setIsVerificationSuccessful,
  setVerificationStatus,
  keepVerificationStatus,
  initialAdditionalCryptos,
}) {
  console.log("[PIN_TIMEOUT] clearWalletOnPinTimeout start");
  // First clear in-memory state to prevent stale re-persist
  try {
    console.log("[PIN_TIMEOUT] setCryptoCards -> []");
    setCryptoCards?.([]);
  } catch {}
  try {
    console.log("[PIN_TIMEOUT] setAddedCryptos -> []");
    setAddedCryptos?.([]);
  } catch {}
  try {
    console.log("[PIN_TIMEOUT] reset initial/additional cryptos");
    if (typeof setInitialAdditionalCryptos === "function") {
      const resetList = resetInitialAdditionalCryptos(initialAdditionalCryptos);
      setInitialAdditionalCryptos(resetList);
      setAdditionalCryptos?.(resetList);
      try {
        await AsyncStorage.setItem(
          "initialAdditionalCryptos",
          JSON.stringify(resetList)
        );
      } catch {}
    } else {
      setAdditionalCryptos?.([]);
    }
  } catch {}
  try {
    console.log("[PIN_TIMEOUT] setVerifiedDevices -> []");
    setVerifiedDevices?.([]);
  } catch {}
  try {
    console.log("[PIN_TIMEOUT] setCryptoCount -> 0");
    setCryptoCount?.(0);
  } catch {}
  try {
    console.log("[PIN_TIMEOUT] setIsVerificationSuccessful -> false");
    setIsVerificationSuccessful?.(false);
  } catch {}
  try {
    if (!keepVerificationStatus) {
      console.log("[PIN_TIMEOUT] setVerificationStatus -> null");
      setVerificationStatus?.(null);
    } else {
      console.log("[PIN_TIMEOUT] keep verificationStatus");
    }
  } catch {}
  // initialAdditionalCryptos handled above

  try {
    const keys = await AsyncStorage.getAllKeys();
    const pubkeyKeys = (keys || []).filter((k) => k.startsWith("pubkey_"));
    const removeKeys = [...BASE_KEYS, ...pubkeyKeys];
    console.log(
      "[PIN_TIMEOUT] removing keys:",
      removeKeys.filter(Boolean).length
    );
    await AsyncStorage.multiRemove(removeKeys);
    await deleteSecureItems([
      "screenLockPassword",
      "selfDestructPassword",
      { key: "accountId", legacyKeys: ["currentAccountId"] },
      "deviceSecureId",
      "hardwareVersion",
      "bluetoothVersion",
      "baseVersion",
    ]);
    await deleteAllStoredPubkeys(PUBKEY_CHAINS);
  } catch (e) {
    console.log("[PIN_TIMEOUT] clear storage failed:", e?.message || e);
  }
  console.log("[PIN_TIMEOUT] clearWalletOnPinTimeout end");
}
