/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const normalizeLegacyKeys = (key, legacyKeys = []) =>
  Array.from(new Set([key, ...(Array.isArray(legacyKeys) ? legacyKeys : [])]));

const canUseSecureStore = async () => {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

export const getSecureItem = async (key, legacyKeys = []) => {
  const keys = normalizeLegacyKeys(key, legacyKeys);
  const secureAvailable = await canUseSecureStore();

  if (secureAvailable) {
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue != null) {
        return secureValue;
      }
    } catch {}
  }

  for (const legacyKey of keys) {
    try {
      const legacyValue = await AsyncStorage.getItem(legacyKey);
      if (legacyValue != null) {
        if (secureAvailable) {
          try {
            await SecureStore.setItemAsync(
              key,
              legacyValue,
              SECURE_STORE_OPTIONS,
            );
            await AsyncStorage.multiRemove(keys);
          } catch {}
        }
        return legacyValue;
      }
    } catch {}
  }

  return null;
};

export const setSecureItem = async (key, value, legacyKeys = []) => {
  const keys = normalizeLegacyKeys(key, legacyKeys);
  const normalized =
    value === undefined || value === null ? "" : String(value);
  const secureAvailable = await canUseSecureStore();

  if (!normalized) {
    if (secureAvailable) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {}
    }
    await AsyncStorage.multiRemove(keys).catch(() => {});
    return;
  }

  if (secureAvailable) {
    await SecureStore.setItemAsync(key, normalized, SECURE_STORE_OPTIONS);
    await AsyncStorage.multiRemove(keys).catch(() => {});
    return;
  }

  await AsyncStorage.setItem(key, normalized);
  const staleKeys = keys.filter((legacyKey) => legacyKey !== key);
  if (staleKeys.length > 0) {
    await AsyncStorage.multiRemove(staleKeys).catch(() => {});
  }
};

export const deleteSecureItem = async (key, legacyKeys = []) => {
  const keys = normalizeLegacyKeys(key, legacyKeys);
  const secureAvailable = await canUseSecureStore();

  if (secureAvailable) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  }

  await AsyncStorage.multiRemove(keys).catch(() => {});
};

export const deleteSecureItems = async (entries = []) => {
  for (const entry of entries) {
    if (!entry) continue;
    if (typeof entry === "string") {
      await deleteSecureItem(entry);
      continue;
    }
    await deleteSecureItem(entry.key, entry.legacyKeys);
  }
};
