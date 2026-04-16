/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CHAIN_NAMES } from "../../config/chainConfig";

const DEFAULT_SELECTED_CHAIN_KEY = "selectedChain";

const useChainSelection = ({
  cryptoCards,
  setChainSelectionModalVisible,
  storageKey = DEFAULT_SELECTED_CHAIN_KEY,
}) => {
  const [selectedChainShortName, setSelectedChainShortName] =
    useState(CHAIN_NAMES);
  const [selectedChain, setSelectedChain] = useState("All");

  const chainFilteredCards = useMemo(
    () =>
      (cryptoCards || []).filter((card) =>
        (selectedChainShortName || []).includes(card?.queryChainShortName),
      ),
    [cryptoCards, selectedChainShortName],
  );

  useEffect(() => {
    const loadSelectedChain = async () => {
      const availableChainKeys = Array.from(
        new Set(
          (cryptoCards || [])
            .map((card) => card?.queryChainShortName)
            .filter(Boolean),
        ),
      );
      try {
        const savedChain = await AsyncStorage.getItem(storageKey);
        const hasSavedChain =
          savedChain &&
          (savedChain === "All" || availableChainKeys.includes(savedChain));

        if (hasSavedChain) {
          setSelectedChain(savedChain);
          if (savedChain === "All") {
            setSelectedChainShortName(
              availableChainKeys,
            );
          } else {
            setSelectedChainShortName([savedChain]);
          }
        } else {
          if (savedChain && savedChain !== "All") {
            try {
              await AsyncStorage.setItem(storageKey, "All");
            } catch {}
          }
          // If no saved chain, default to All.
          setSelectedChain("All");
          setSelectedChainShortName(availableChainKeys);
        }
      } catch (e) {
        console.error("Error loading selected chain:", e);
        setSelectedChain("All");
        setSelectedChainShortName(availableChainKeys);
      }
    };

    loadSelectedChain(); // Always run once to avoid empty state.
  }, [cryptoCards, storageKey]);

  const handleSelectChain = useCallback(
    async (chain) => {
      try {
        await AsyncStorage.setItem(storageKey, chain); // Persist user selection.
      } catch (e) {
        console.error("Error saving chain:", e);
      }

      if (chain === "All") {
        setSelectedChainShortName(
          Array.from(
            new Set(
              (cryptoCards || [])
                .map((card) => card?.queryChainShortName || "")
                .filter(Boolean),
            ),
          ),
        ); // All chains.
      } else {
        setSelectedChainShortName([chain]); // Single chain.
      }
      setSelectedChain(chain); // Update selected chain.
      if (typeof setChainSelectionModalVisible === "function") {
        setChainSelectionModalVisible(false); // Close modal.
      }
    },
    [cryptoCards, setChainSelectionModalVisible, storageKey],
  );

  return {
    selectedChainShortName,
    selectedChain,
    chainFilteredCards,
    handleSelectChain,
  };
};

export default useChainSelection;
