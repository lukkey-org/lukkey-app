/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const HIDE_NUMBERS_KEY = "hideNumbers";
export const HIDE_NUMBERS_BY_CARD_KEY = "hideNumbersByCard";

export async function resetStoredHideNumbers(storage = AsyncStorage) {
  try {
    await storage.multiSet([
      [HIDE_NUMBERS_KEY, "0"],
      [HIDE_NUMBERS_BY_CARD_KEY, JSON.stringify({})],
    ]);
  } catch {}
}
