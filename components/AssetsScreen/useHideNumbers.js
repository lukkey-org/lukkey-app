/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  HIDE_NUMBERS_BY_CARD_KEY,
  HIDE_NUMBERS_KEY,
  resetStoredHideNumbers,
} from "../../utils/hideNumbersStorage";

const useHideNumbers = () => {
  const [hideNumbers, setHideNumbers] = useState(false);
  const [hideNumbersByCard, setHideNumbersByCard] = useState({});
  const hideNumbersByCardLoadedRef = useRef(false);

  // Load persisted hide-numbers flag (default false).
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(HIDE_NUMBERS_KEY);
        // Support "1"/"0" and "true"/"false".
        setHideNumbers(saved === "1" || saved === "true");
      } catch {}
    })();
  }, []);

  // Persist hide-numbers flag.
  useEffect(() => {
    try {
      AsyncStorage.setItem(HIDE_NUMBERS_KEY, hideNumbers ? "1" : "0");
    } catch {}
  }, [hideNumbers]);

  // Load and persist per-card hidden state.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(HIDE_NUMBERS_BY_CARD_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            setHideNumbersByCard(parsed);
          }
        }
      } catch {}
      hideNumbersByCardLoadedRef.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!hideNumbersByCardLoadedRef.current) return;
    try {
      AsyncStorage.setItem(
        HIDE_NUMBERS_BY_CARD_KEY,
        JSON.stringify(hideNumbersByCard || {}),
      );
    } catch {}
  }, [hideNumbersByCard]);

  const getCardHideKey = useCallback((card) => {
    if (!card) return "";
    const chain =
      card.queryChainShortName ||
      card.queryChainName ||
      "unknown";
    const contract = card.contractAddress || card.contract_address || "";
    const symbol = card.shortName || card.name || "token";
    return contract
      ? `${chain}:${String(contract).toLowerCase()}`
      : `${chain}:${symbol}`;
  }, []);

  const toggleCardHideNumbers = useCallback(
    (card) => {
      if (!card) return;
      const key = getCardHideKey(card);
      if (!key) return;
      setHideNumbersByCard((prev) => {
        const safePrev =
          prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {};
        const next = { ...safePrev };
        if (next[key]) {
          delete next[key];
        } else {
          next[key] = true;
        }
        return next;
      });
    },
    [getCardHideKey],
  );

  const resetHideNumbers = useCallback(() => {
    setHideNumbers(false);
    setHideNumbersByCard({});
    resetStoredHideNumbers();
  }, []);

  return {
    hideNumbers,
    setHideNumbers,
    hideNumbersByCard,
    getCardHideKey,
    toggleCardHideNumbers,
    resetHideNumbers,
  };
};

export default useHideNumbers;
