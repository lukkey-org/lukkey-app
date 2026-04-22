/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { createContext, useState, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "../config/i18n";
import { initialAdditionalCryptos } from "../config/assetInfo";
import currencies from "../config/currencies";
import { accountAPI, metricsAPII, pushAPI } from "../env/apiEndpoints";
import { firmwareAPI } from "../env/apiEndpoints";
import { BleManager } from "react-native-ble-plx";
import * as Notifications from "expo-notifications";
import { RUNTIME_DEV } from "./runtimeFlags";
import { fetchMergedTransactions } from "./queryTransactions";
import { getSecureItem, setSecureItem } from "./secureStorage";
import {
  FIRMWARE_UPDATE_CACHE_KEY,
  OTA_TRANSFER_COMPLETED_KEY,
} from "./firmwareUpdateKeys";
import { ensureCryptoCardRuntimeFields } from "./assetRuntimeFields";
import {
  buildChainAddrEntry,
  areAddressesEquivalent,
  isBchChainName,
  normalizeBchAddressType,
} from "../config/networkUtils";
import { getStoredPubkey } from "./pubkeyStorage";
import {
  enrichBchAddressData,
  getBchAddressByTypeFromCard,
  getBchQueryAddressesFromCard,
  isBchCard,
  switchBchAddressTypeForCard,
} from "./bchAddress";
import {
  BTC_ADDRESS_TYPES,
  enrichBtcAddressData,
  getBtcAddressByTypeFromCard,
  getBtcQueryAddressesFromCard,
  isBtcChainName,
  isBtcCard,
  normalizeBtcAddressType,
  switchBtcAddressTypeForCard,
} from "./btcAddress";
import {
  enrichLtcAddressData,
  getLtcAddressByTypeFromCard,
  getLtcQueryAddressesFromCard,
  isLtcChainName,
  isLtcCard,
  normalizeLtcAddressType,
  switchLtcAddressTypeForCard,
} from "./ltcAddress";

export const DeviceContext = createContext();
export const DarkModeContext = createContext();

const NEW_EXCHANGE_RATE_API_URL = metricsAPII.exchangeRate;
const HIDDEN_CHAIN_NAMES = new Set(["juno", "okb"]);

const filterHiddenChains = (cards) =>
  (Array.isArray(cards) ? cards : []).filter(
    (card) =>
      !HIDDEN_CHAIN_NAMES.has(
        String(card?.queryChainName || "").trim().toLowerCase(),
      ),
  );

const DEFAULT_ADDITIONAL_CRYPTOS = filterHiddenChains(initialAdditionalCryptos);

const createLazyBleManagerProxy = (getManager) =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        const manager = getManager();
        const value = manager?.[prop];
        return typeof value === "function" ? value.bind(manager) : value;
      },
      set(_target, prop, value) {
        const manager = getManager();
        manager[prop] = value;
        return true;
      },
    },
  );

export const CryptoProvider = ({ children }) => {
  const bleManagerRef = useRef(null);
  const bleManagerInstanceRef = useRef(null);
  const getBleManager = () => {
    if (bleManagerInstanceRef.current === null) {
      bleManagerInstanceRef.current = new BleManager();
    }
    return bleManagerInstanceRef.current;
  };
  if (bleManagerRef.current === null) {
    bleManagerRef.current = createLazyBleManagerProxy(getBleManager);
  }
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [isScreenLockEnabled, setIsScreenLockEnabled] = useState(false);
  const [screenLockPassword, setScreenLockPassword] = useState("");
  const [screenLockType, setScreenLockType] = useState("password");
  const [isSelfDestructEnabled, setIsSelfDestructEnabled] = useState(false);
  const [selfDestructPassword, setSelfDestructPassword] = useState("");
  const [selfDestructType, setSelfDestructType] = useState("password");
  const [cryptoCount, setCryptoCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currencyUnit, setCurrencyUnit] = useState("USD");
  const [ActivityLog, setActivityLog] = useState([]);
  const [initialAdditionalCryptosState, setInitialAdditionalCryptos] = useState(
    DEFAULT_ADDITIONAL_CRYPTOS
  );
  const [additionalCryptos, setAdditionalCryptos] = useState(
    initialAdditionalCryptosState
  );
  const [isVerificationSuccessful, setIsVerificationSuccessful] =
    useState(false);
  const [verifiedDevices, setVerifiedDevices] = useState([]);
  const [isAppLaunching, setIsAppLaunching] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [cryptoCards, setCryptoCards] = useState([]);
  const [addedCryptos, setAddedCryptos] = useState([]);
  const [exchangeRates, setConvertRates] = useState({});
  const [accountName, setAccountName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [versionHasUpdate, setVersionHasUpdate] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notificationDedupRef = useRef(new Map());
  const [appState, setAppState] = useState(AppState.currentState);
  const wssRef = useRef(null);
  const wssTimeoutRef = useRef(null);
  const wssTargetsRef = useRef("");
  const wssTargetListRef = useRef([]);
  const wssSeenRef = useRef(new Set());
  const wssReconnectTimerRef = useRef(null);
  const wssShouldReconnectRef = useRef(false);
  const wssConnSeqRef = useRef(0);
  const wssConnMetaRef = useRef(null);
  const wssRefreshMapRef = useRef(new Map());
  const activityLogRef = useRef([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      try {
        bleManagerInstanceRef.current?.destroy?.();
      } catch {}
      bleManagerInstanceRef.current = null;
    };
  }, []);

  const supportedChains = ["ETH", "BTC", "SOL", "TRX"];

  const matchesAddressTarget = (item, queryChainShortName) => {
    const target = String(queryChainShortName || "").trim().toUpperCase();
    if (!target) return false;
    const itemQueryShort = String(item?.queryChainShortName || "")
      .trim()
      .toUpperCase();
    if (itemQueryShort && itemQueryShort === target) return true;
    const itemShort = String(item?.shortName || "").trim().toUpperCase();
    const itemCoinType = String(item?.coin_type || "").trim().toLowerCase();
    return !itemQueryShort && itemShort === target && itemCoinType === "native";
  };

  const loadStoredBtcPubkeys = async () => ({
    legacy: await getStoredPubkey("bitcoin", "m/44'/0'/0'/0/0"),
    nestedSegwit: await getStoredPubkey("bitcoin", "m/49'/0'/0'/0/0"),
    nativeSegwit: await getStoredPubkey("bitcoin", "m/84'/0'/0'/0/0"),
    taproot: await getStoredPubkey("bitcoin", "m/86'/0'/0'/0/0"),
  });

  const loadStoredLtcPubkeys = async () => ({
    legacy: await getStoredPubkey("litecoin", "m/44'/2'/0'/0/0"),
    nestedSegwit: await getStoredPubkey("litecoin", "m/49'/2'/0'/0/0"),
    nativeSegwit: await getStoredPubkey("litecoin", "m/84'/2'/0'/0/0"),
  });

  const refreshBtcAddressData = async () => {
    try {
      const [btcPubkeysByType, ltcPubkeysByType] = await Promise.all([
        loadStoredBtcPubkeys(),
        loadStoredLtcPubkeys(),
      ]);
      const hasAnyPubkey = [
        ...Object.values(btcPubkeysByType),
        ...Object.values(ltcPubkeysByType),
      ].some(
        (value) => String(value || "").trim() !== "",
      );
      if (!hasAnyPubkey) return;

      setInitialAdditionalCryptos((prevCryptos) => {
        const updatedCryptos = prevCryptos.map((crypto) =>
          isBtcCard(crypto)
            ? enrichBtcAddressData(
                crypto,
                crypto?.btcAddressType,
                btcPubkeysByType,
              )
            : isLtcCard(crypto)
              ? enrichLtcAddressData(
                  crypto,
                  crypto?.ltcAddressType,
                  ltcPubkeysByType,
                )
              : crypto,
        );
        AsyncStorage.setItem(
          "initialAdditionalCryptos",
          JSON.stringify(updatedCryptos),
        ).catch((error) => {
          console.error("Failed to persist initialAdditionalCryptos:", error);
        });
        setAdditionalCryptos(updatedCryptos);
        return updatedCryptos;
      });

      setCryptoCards((prevCards) => {
        const updatedCards = prevCards.map((card) =>
          isBtcCard(card)
            ? ensureCryptoCardRuntimeFields(
                enrichBtcAddressData(
                  card,
                  card?.btcAddressType,
                  btcPubkeysByType,
                ),
              )
            : isLtcCard(card)
              ? ensureCryptoCardRuntimeFields(
                  enrichLtcAddressData(
                    card,
                    card?.ltcAddressType,
                    ltcPubkeysByType,
                  ),
                )
              : card,
        );
        AsyncStorage.setItem("cryptoCards", JSON.stringify(updatedCards)).catch(
          (error) => {
            console.error("Failed to persist cryptoCards:", error);
          },
        );
        setAddedCryptos(updatedCards);
        AsyncStorage.setItem("addedCryptos", JSON.stringify(updatedCards)).catch(
          (error) => {
            console.error("Failed to persist addedCryptos:", error);
          },
        );
        return updatedCards;
      });
    } catch (error) {
      console.error("Failed to refresh BTC address data:", error);
    }
  };

  const updateCryptoAddress = (queryChainShortName, newAddress) => {
    const normalizedAddress = String(newAddress || "").trim();
    if (!normalizedAddress) return;

    setInitialAdditionalCryptos((prevCryptos) => {
      const updatedCryptos = prevCryptos.map((crypto) =>
        matchesAddressTarget(crypto, queryChainShortName)
          ? enrichLtcAddressData(
              enrichBtcAddressData(
                enrichBchAddressData(
                  { ...crypto, address: normalizedAddress },
                  crypto?.bchAddressType,
                ),
                crypto?.btcAddressType,
              ),
              crypto?.ltcAddressType,
            )
          : crypto
      );

      AsyncStorage.setItem(
        "initialAdditionalCryptos",
        JSON.stringify(updatedCryptos)
      ).catch((error) => {
        console.error("Failed to persist initialAdditionalCryptos:", error);
      });
      setAdditionalCryptos(updatedCryptos);

      setCryptoCards((prevCards) => {
        const updatedCards = prevCards.map((card) =>
          matchesAddressTarget(card, queryChainShortName)
            ? ensureCryptoCardRuntimeFields(
                enrichLtcAddressData(
                  enrichBtcAddressData(
                    enrichBchAddressData(
                      { ...card, address: normalizedAddress },
                      card?.bchAddressType,
                    ),
                    card?.btcAddressType,
                  ),
                  card?.ltcAddressType,
                ),
              )
            : card
        );

        if (
          supportedChains.includes(queryChainShortName) &&
          !prevCards.find(
            (card) => matchesAddressTarget(card, queryChainShortName)
          )
        ) {
          const toPush = updatedCryptos.find(
            (crypto) => matchesAddressTarget(crypto, queryChainShortName)
          );
          if (toPush) updatedCards.push(ensureCryptoCardRuntimeFields(toPush));
        }

        AsyncStorage.setItem("cryptoCards", JSON.stringify(updatedCards)).catch(
          (error) => {
            console.error("Failed to persist cryptoCards:", error);
          }
        );
        setAddedCryptos(updatedCards);
        AsyncStorage.setItem("addedCryptos", JSON.stringify(updatedCards)).catch(
          (error) => {
            console.error("Failed to persist addedCryptos:", error);
          }
        );
        return updatedCards;
      });

      return updatedCryptos;
    });
  };

  const switchBchAddressType = (nextType) => {
    const normalizedType = normalizeBchAddressType(nextType);
    const currentTarget = (Array.isArray(cryptoCards) ? cryptoCards : []).find((card) =>
      isBchCard(card),
    );
    const previewAddress = currentTarget
      ? getBchAddressByTypeFromCard(currentTarget, normalizedType)
      : "";

    setInitialAdditionalCryptos((prevCryptos) => {
      const updatedCryptos = prevCryptos.map((crypto) =>
        isBchCard(crypto)
          ? switchBchAddressTypeForCard(crypto, normalizedType)
          : crypto,
      );
      AsyncStorage.setItem(
        "initialAdditionalCryptos",
        JSON.stringify(updatedCryptos),
      ).catch((error) => {
        console.error("Failed to persist initialAdditionalCryptos:", error);
      });
      setAdditionalCryptos(updatedCryptos);
      return updatedCryptos;
    });

    setCryptoCards((prevCards) => {
      const updatedCards = prevCards.map((card) =>
        isBchCard(card)
          ? ensureCryptoCardRuntimeFields(
              switchBchAddressTypeForCard(card, normalizedType),
            )
          : card,
      );
      AsyncStorage.setItem("cryptoCards", JSON.stringify(updatedCards)).catch(
        (error) => {
          console.error("Failed to persist cryptoCards:", error);
        },
      );
      setAddedCryptos(updatedCards);
      AsyncStorage.setItem("addedCryptos", JSON.stringify(updatedCards)).catch(
        (error) => {
          console.error("Failed to persist addedCryptos:", error);
        },
      );
      return updatedCards;
    });

    return previewAddress;
  };

  const switchBtcAddressType = (nextType) => {
    const normalizedType = normalizeBtcAddressType(nextType);
    const currentTarget = (Array.isArray(cryptoCards) ? cryptoCards : []).find((card) =>
      isBtcCard(card),
    );
    const previewAddress = currentTarget
      ? getBtcAddressByTypeFromCard(currentTarget, normalizedType)
      : "";

    setInitialAdditionalCryptos((prevCryptos) => {
      const updatedCryptos = prevCryptos.map((crypto) =>
        isBtcCard(crypto)
          ? switchBtcAddressTypeForCard(crypto, normalizedType)
          : crypto,
      );
      AsyncStorage.setItem(
        "initialAdditionalCryptos",
        JSON.stringify(updatedCryptos),
      ).catch((error) => {
        console.error("Failed to persist initialAdditionalCryptos:", error);
      });
      setAdditionalCryptos(updatedCryptos);
      return updatedCryptos;
    });

    setCryptoCards((prevCards) => {
      const updatedCards = prevCards.map((card) =>
        isBtcCard(card)
          ? ensureCryptoCardRuntimeFields(
              switchBtcAddressTypeForCard(card, normalizedType),
            )
          : card,
      );
      AsyncStorage.setItem("cryptoCards", JSON.stringify(updatedCards)).catch(
        (error) => {
          console.error("Failed to persist cryptoCards:", error);
        },
      );
      setAddedCryptos(updatedCards);
      AsyncStorage.setItem("addedCryptos", JSON.stringify(updatedCards)).catch(
        (error) => {
          console.error("Failed to persist addedCryptos:", error);
        },
      );
      return updatedCards;
    });

    return previewAddress;
  };

  const switchLtcAddressType = (nextType) => {
    const normalizedType = normalizeLtcAddressType(nextType);
    const currentTarget = (Array.isArray(cryptoCards) ? cryptoCards : []).find((card) =>
      isLtcCard(card),
    );
    const previewAddress = currentTarget
      ? getLtcAddressByTypeFromCard(currentTarget, normalizedType)
      : "";

    setInitialAdditionalCryptos((prevCryptos) => {
      const updatedCryptos = prevCryptos.map((crypto) =>
        isLtcCard(crypto)
          ? switchLtcAddressTypeForCard(crypto, normalizedType)
          : crypto,
      );
      AsyncStorage.setItem(
        "initialAdditionalCryptos",
        JSON.stringify(updatedCryptos),
      ).catch((error) => {
        console.error("Failed to persist initialAdditionalCryptos:", error);
      });
      setAdditionalCryptos(updatedCryptos);
      return updatedCryptos;
    });

    setCryptoCards((prevCards) => {
      const updatedCards = prevCards.map((card) =>
        isLtcCard(card)
          ? ensureCryptoCardRuntimeFields(
              switchLtcAddressTypeForCard(card, normalizedType),
            )
          : card,
      );
      AsyncStorage.setItem("cryptoCards", JSON.stringify(updatedCards)).catch(
        (error) => {
          console.error("Failed to persist cryptoCards:", error);
        },
      );
      setAddedCryptos(updatedCards);
      AsyncStorage.setItem("addedCryptos", JSON.stringify(updatedCards)).catch(
        (error) => {
          console.error("Failed to persist addedCryptos:", error);
        },
      );
      return updatedCards;
    });

    return previewAddress;
  };

  const getCardQueryAddresses = (card) => {
    if (isBchCard(card)) return getBchQueryAddressesFromCard(card);
    if (isBtcCard(card)) return getBtcQueryAddressesFromCard(card);
    if (isLtcCard(card)) return getLtcQueryAddressesFromCard(card);
    const address = String(card?.address || "").trim();
    return address ? [address] : [];
  };

  const updateCryptoData = (shortName, newData) => {
    if (supportedChains.includes(shortName)) {
      setInitialAdditionalCryptos((prevCryptos) => {
        const updatedCryptos = prevCryptos.map((crypto) =>
          crypto.shortName === shortName ? { ...crypto, ...newData } : crypto
        );
        AsyncStorage.setItem(
          "initialAdditionalCryptos",
          JSON.stringify(updatedCryptos)
        );
        return updatedCryptos;
      });
    }
  };

  const fetchAndStoreConvertRates = async () => {
    try {
      try {
        const saved = await AsyncStorage.getItem("exchangeRates");
        if (saved) {
          const parsed = JSON.parse(saved);
          setConvertRates((prev) => ({ ...parsed, ...prev }));
        }
      } catch {}

      if (!metricsAPII.enabled) {
        console.log("[Startup] exchange-rate fetch skipped: market API is not configured");
        return;
      }

      const response = await fetch(NEW_EXCHANGE_RATE_API_URL);
      if (RUNTIME_DEV) {
        console.log("Response status:", response.status);
      }

      if (!response.ok) {
        throw new Error(
          `Network response was not ok, status: ${response.status}`
        );
      }

      const data = await response.json();

      if (data.code === 0 && data.data) {
        const flattenedData = {};
        for (const [currency, rateArray] of Object.entries(data.data)) {
          if (Array.isArray(rateArray) && rateArray.length > 0) {
            flattenedData[currency] = rateArray[0];
          }
        }
        setConvertRates((prev) => {
          const next = { ...prev, ...flattenedData };
          AsyncStorage.setItem("exchangeRates", JSON.stringify(next)).catch(
            () => {}
          );
          return next;
        });
      } else {
        console.error("Failed to fetch exchange rates:", data.msg);
      }
    } catch (error) {
      console.log("Error fetching exchange rates:", error);
    }
  };

  const syncFirmwareUpdateInfo = async (hasUpdate, options = {}) => {
    const markTransferCompleted = !!options?.transferCompleted;
    if (markTransferCompleted) {
      try {
        await AsyncStorage.setItem(OTA_TRANSFER_COMPLETED_KEY, "1");
      } catch {}
    }
    let transferCompletedOnce = false;
    try {
      transferCompletedOnce =
        (await AsyncStorage.getItem(OTA_TRANSFER_COMPLETED_KEY)) === "1";
    } catch {}
    const nextValue = transferCompletedOnce ? false : !!hasUpdate;
    setVersionHasUpdate(nextValue);
    try {
      await AsyncStorage.setItem(
        FIRMWARE_UPDATE_CACHE_KEY,
        JSON.stringify({
          checkedAt: Date.now(),
          hasUpdate: nextValue,
          transferCompletedOnce,
        }),
      );
    } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("notifications");
        if (saved) {
          setNotifications(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Failed to load notifications:", e);
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
    });
    return () => {
      try {
        sub.remove();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const loadActivityLog = async () => {
      try {
        const history = await AsyncStorage.getItem("ActivityLog");
        if (history !== null) {
          setActivityLog(JSON.parse(history));
        }
      } catch (error) {
        console.error("Failed to load transaction history:", error);
      }
    };
    loadActivityLog();
  }, []);

  useEffect(() => {
    activityLogRef.current = ActivityLog;
  }, [ActivityLog]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const persist = async () => {
      try {
        await AsyncStorage.setItem(
          "notifications",
          JSON.stringify(notifications)
        );
      } catch (error) {
        console.error("Failed to save notifications:", error);
      }
    };
    persist();
  }, [notifications]);

  useEffect(() => {
    const saveActivityLog = async () => {
      try {
        await AsyncStorage.setItem("ActivityLog", JSON.stringify(ActivityLog));
      } catch (error) {
        console.error("Failed to save transaction history:", error);
      }
    };
    if (ActivityLog.length > 0) {
      saveActivityLog();
    }
  }, [ActivityLog]);

  useEffect(() => {
    const saveAddedCryptos = async () => {
      try {
        await AsyncStorage.setItem(
          "addedCryptos",
          JSON.stringify(addedCryptos)
        );
      } catch (error) {
        console.error("Error saving addedCryptos:", error);
      }
    };
    if (addedCryptos.length > 0) {
      saveAddedCryptos();
    }
  }, [addedCryptos]);

  useEffect(() => {
    const saveCryptoCards = async () => {
      if (!settingsLoaded) return;
      try {
        await AsyncStorage.setItem("cryptoCards", JSON.stringify(cryptoCards));
      } catch (error) {
        console.error("Error saving cryptoCards:", error);
      }
    };
    saveCryptoCards();
  }, [cryptoCards, settingsLoaded]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const darkModeValue = await AsyncStorage.getItem("darkMode");
        if (darkModeValue !== null) setIsDarkMode(JSON.parse(darkModeValue));

        const currencyValue = await AsyncStorage.getItem("currencyUnit");
        if (currencyValue !== null) setCurrencyUnit(currencyValue);

        const languageValue = await AsyncStorage.getItem("language");
        if (languageValue !== null) i18n.changeLanguage(languageValue);

        const savedCryptos = await AsyncStorage.getItem("addedCryptos");
        let parsedCryptos = [];
        if (savedCryptos !== null) {
          const parsedSavedCryptos = JSON.parse(savedCryptos);
          parsedCryptos = filterHiddenChains(
            Array.isArray(parsedSavedCryptos)
              ? parsedSavedCryptos.map((card) =>
                  ensureCryptoCardRuntimeFields(card),
                )
              : [],
          );
          setAddedCryptos(parsedCryptos);
          setCryptoCount(parsedCryptos.length);
        }

        const savedCards = await AsyncStorage.getItem("cryptoCards");
        if (savedCards !== null) {
          const parsedCards = JSON.parse(savedCards);
          const normalizedCards = filterHiddenChains(
            Array.isArray(parsedCards)
              ? parsedCards.map((card) => ensureCryptoCardRuntimeFields(card))
              : [],
          );
          setCryptoCards(normalizedCards);
          if (parsedCryptos.length === 0 && normalizedCards.length > 0) {
            setAddedCryptos(normalizedCards);
            setCryptoCount(normalizedCards.length);
          }
        }

        const storedStatus = await AsyncStorage.getItem(
          "isVerificationSuccessful"
        );
        if (storedStatus !== null) {
          setIsVerificationSuccessful(JSON.parse(storedStatus));
        }

        const savedDevices = await AsyncStorage.getItem("verifiedDevices");
        if (savedDevices !== null) {
          setVerifiedDevices(JSON.parse(savedDevices));
        }

        const storedAccountName = await AsyncStorage.getItem("accountName");
        if (storedAccountName !== null) {
          setAccountName(storedAccountName);
        }
        const storedAccountId = await getSecureItem("accountId", [
          "currentAccountId",
        ]);
        if (storedAccountId !== null) {
          setAccountId(storedAccountId);
        }

        const screenLockEnabled = await AsyncStorage.getItem(
          "screenLockEnabled"
        );
        const storedScreenLockPassword = await getSecureItem(
          "screenLockPassword"
        );
        const storedScreenLockType = await AsyncStorage.getItem(
          "screenLockType"
        );
        const selfDestructEnabled = await AsyncStorage.getItem(
          "selfDestructEnabled"
        );
        const storedSelfDestructPassword = await getSecureItem(
          "selfDestructPassword"
        );
        const storedSelfDestructType = await AsyncStorage.getItem(
          "selfDestructType"
        );
        if (screenLockEnabled !== null)
          setIsScreenLockEnabled(JSON.parse(screenLockEnabled));
        if (storedScreenLockPassword !== null)
          setScreenLockPassword(storedScreenLockPassword);
        if (storedScreenLockType !== null) setScreenLockType(storedScreenLockType);
        if (selfDestructEnabled !== null)
          setIsSelfDestructEnabled(JSON.parse(selfDestructEnabled));
        if (storedSelfDestructPassword !== null)
          setSelfDestructPassword(storedSelfDestructPassword);
        if (storedSelfDestructType !== null)
          setSelfDestructType(storedSelfDestructType);

        const savedInitialCryptos = await AsyncStorage.getItem(
          "initialAdditionalCryptos"
        );
        if (savedInitialCryptos !== null) {
          const savedList = JSON.parse(savedInitialCryptos);

          const makeKey = (c) => `${c.name}__${c.queryChainName}`;
          const savedMap = new Map(savedList.map((c) => [makeKey(c), c]));

          const merged = [];
          for (const def of DEFAULT_ADDITIONAL_CRYPTOS) {
            const k = makeKey(def);
            if (savedMap.has(k)) {
              merged.push({ ...def, ...savedMap.get(k) });
            } else {
              merged.push(def);
            }
          }
          for (const s of savedList) {
            const k = makeKey(s);
            if (!merged.find((x) => makeKey(x) === k)) {
              merged.push(s);
            }
          }

          const normalizedMerged = filterHiddenChains(
            merged.map((card) =>
              enrichLtcAddressData(
                enrichBtcAddressData(
                  enrichBchAddressData(card, card?.bchAddressType),
                  card?.btcAddressType,
                ),
                card?.ltcAddressType,
              ),
            ),
          );
          setInitialAdditionalCryptos(normalizedMerged);
          setAdditionalCryptos(normalizedMerged);
        } else {
          const normalizedDefaults = DEFAULT_ADDITIONAL_CRYPTOS.map((card) =>
            enrichLtcAddressData(
              enrichBtcAddressData(
                enrichBchAddressData(card, card?.bchAddressType),
                card?.btcAddressType,
              ),
              card?.ltcAddressType,
            ),
          );
          setInitialAdditionalCryptos(normalizedDefaults);
          setAdditionalCryptos(normalizedDefaults);
          await AsyncStorage.setItem(
            "initialAdditionalCryptos",
            JSON.stringify(normalizedDefaults)
          );
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setIsAppLaunching(true);
        setSettingsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    refreshBtcAddressData().catch(() => {});
  }, [settingsLoaded]);

  useEffect(() => {
    const saveSettings = async () => {
      if (!settingsLoaded) return;
      try {
        await AsyncStorage.setItem("darkMode", JSON.stringify(isDarkMode));
        await AsyncStorage.setItem("currencyUnit", currencyUnit);
        await AsyncStorage.setItem("language", i18n.language);
        await AsyncStorage.setItem(
          "addedCryptos",
          JSON.stringify(addedCryptos)
        );
        await AsyncStorage.setItem(
          "isVerificationSuccessful",
          JSON.stringify(isVerificationSuccessful)
        );
        await AsyncStorage.setItem(
          "verifiedDevices",
          JSON.stringify(verifiedDevices)
        );
        await AsyncStorage.setItem(
          "screenLockEnabled",
          JSON.stringify(isScreenLockEnabled)
        );
        await AsyncStorage.setItem("screenLockType", screenLockType);
        await AsyncStorage.setItem(
          "selfDestructEnabled",
          JSON.stringify(isSelfDestructEnabled)
        );
        await AsyncStorage.setItem("selfDestructType", selfDestructType);
        await AsyncStorage.setItem(
          "initialAdditionalCryptos",
          JSON.stringify(initialAdditionalCryptosState)
        );
        await setSecureItem("screenLockPassword", screenLockPassword);
        await setSecureItem("selfDestructPassword", selfDestructPassword);
      } catch (error) {
        console.error("Error saving settings:", error);
      }
    };
    saveSettings();
  }, [
    isDarkMode,
    currencyUnit,
    i18n.language,
    addedCryptos,
    isVerificationSuccessful,
    verifiedDevices,
    isScreenLockEnabled,
    screenLockPassword,
    screenLockType,
    isSelfDestructEnabled,
    selfDestructPassword,
    selfDestructType,
    initialAdditionalCryptosState,
  ]);

  const toggleScreenLock = async (enabled) => {
    setIsAppLaunching(false);
    setIsScreenLockEnabled(enabled);
    await AsyncStorage.multiSet([
      ["screenLockEnabled", JSON.stringify(enabled)],
      ["isAppLaunching", JSON.stringify(false)],
    ]);
  };

  const changeScreenLockPassword = async (newPassword) => {
    setScreenLockPassword(newPassword);
    setScreenLockType("password");
    await setSecureItem("screenLockPassword", newPassword);
    await AsyncStorage.multiSet([
      ["screenLockType", "password"],
    ]);
  };

  const setScreenLockCredential = async (credential, type) => {
    setScreenLockPassword(credential);
    setScreenLockType(type);
    await setSecureItem("screenLockPassword", credential);
    await AsyncStorage.multiSet([
      ["screenLockType", type],
    ]);
  };

  const toggleSelfDestruct = async (enabled) => {
    setIsSelfDestructEnabled(enabled);
    await AsyncStorage.setItem(
      "selfDestructEnabled",
      JSON.stringify(enabled)
    );
  };

  const setSelfDestructCredential = async (credential, type) => {
    setSelfDestructPassword(credential);
    setSelfDestructType(type);
    await setSecureItem("selfDestructPassword", credential);
    await AsyncStorage.multiSet([
      ["selfDestructType", type],
    ]);
  };

  const switchLockInputMode = async (type) => {
    setIsScreenLockEnabled(false);
    setScreenLockPassword("");
    setScreenLockType(type);
    setIsSelfDestructEnabled(false);
    setSelfDestructPassword("");
    setSelfDestructType(type);
    await setSecureItem("screenLockPassword", "");
    await setSecureItem("selfDestructPassword", "");
    await AsyncStorage.multiSet([
      ["screenLockEnabled", JSON.stringify(false)],
      ["screenLockType", type],
      ["selfDestructEnabled", JSON.stringify(false)],
      ["selfDestructType", type],
      ["screenLockEnabled", JSON.stringify(false)],
    ]);
  };

  const addNotification = (entry) => {
    try {
      const fingerprintParts = [
        String(entry?.type || "").trim().toLowerCase(),
        String(entry?.status || "").trim().toLowerCase(),
        String(entry?.direction || "").trim().toLowerCase(),
        String(entry?.txHash || entry?.orderId || "").trim().toLowerCase(),
        String(entry?.chain || "").trim().toLowerCase(),
      ];
      const fingerprint = fingerprintParts.join("|");
      const now = Date.now();
      const lastSeenAt = notificationDedupRef.current.get(fingerprint) || 0;
      if (fingerprint.replace(/\|/g, "") && now - lastSeenAt < 8000) {
        console.log("[NOTIFICATION][DEDUP] skipped duplicate notification", {
          fingerprint,
          deltaMs: now - lastSeenAt,
        });
        return;
      }
      if (fingerprint.replace(/\|/g, "")) {
        notificationDedupRef.current.set(fingerprint, now);
      }
      for (const [key, ts] of notificationDedupRef.current.entries()) {
        if (now - ts > 60000) {
          notificationDedupRef.current.delete(key);
        }
      }

      const enriched = {
        id: `${now}_${Math.random().toString(16).slice(2)}`,
        timestamp: now,
        read: false,
        ...entry,
      };
      setNotifications((prev) => {
        const next = [...prev, enriched];
        const trimmed =
          next.length > 100 ? next.slice(next.length - 100) : next;
        AsyncStorage.setItem("notifications", JSON.stringify(trimmed)).catch(
          () => {}
        );
        return trimmed;
      });

      (async () => {
        try {
          if (
            enriched?.type === "transaction" &&
            (enriched?.direction === "received" ||
              enriched?.direction === "sent")
          ) {
            const perm = await Notifications.getPermissionsAsync();
            const granted =
              perm?.status === "granted" || perm?.granted === true;
            if (!granted) return;

            const status = String(enriched.status || "").toLowerCase();
            let title = "Transaction";
            if (status === "success") title = "Transaction Confirmed";
            else if (status === "fail") title = "Transaction Failed";
            else if (status === "pending") title = "Pending Confirmation";

            const bodyParts = [];
            if (enriched.chain) bodyParts.push(`Chain: ${enriched.chain}`);
            if (
              enriched.hasOwnProperty("amount") &&
              enriched.amount !== undefined &&
              enriched.amount !== null &&
              String(enriched.amount).trim() !== ""
            ) {
              const unit =
                enriched.unit && String(enriched.unit).trim() !== ""
                  ? ` ${String(enriched.unit).trim()}`
                  : "";
              bodyParts.push(
                `Amount: ${String(enriched.amount).trim()}${unit}`
              );
            }
            const shortenAddr = (val) => {
              const s = String(val || "");
              if (s.length <= 12) return s;
              return `${s.slice(0, 6)}...${s.slice(-6)}`;
            };
            if (enriched.from) {
              bodyParts.push(`From: ${shortenAddr(enriched.from)}`);
            }
            if (enriched.to) {
              bodyParts.push(`To: ${shortenAddr(enriched.to)}`);
            }
            const body = bodyParts.join(" | ");

            await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                sound: true,
              },
              trigger: null,
            });
          }
        } catch (_e) {
        }
      })();
    } catch (e) {
      console.error("addNotification failed:", e);
    }
  };

  const normalizeText = (val) => String(val || "").trim().toLowerCase();
  const formatWssReason = (val) => {
    if (val === undefined || val === null) return "";
    if (typeof val === "string") return val.trim();
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  };

  const getChainAddrInfo = (chain, address) => {
    const chainLc = String(chain || "").trim().toLowerCase();
    const addr = String(address || "").trim();
    if (!chainLc || !addr) return null;

    const byBoth = cryptoCards.find(
      (c) =>
        String(c?.queryChainName || "").trim().toLowerCase() === chainLc &&
        areAddressesEquivalent(
          chainLc,
          String(c?.address || "").trim(),
          addr,
        )
    );
    const byAddr = cryptoCards.find(
      (c) =>
        areAddressesEquivalent(
          String(c?.queryChainName || "").trim().toLowerCase(),
          String(c?.address || "").trim(),
          addr,
        )
    );
    const picked = byBoth || byAddr;
    const chainName = picked
      ? String(picked.queryChainName || "").trim()
      : chainLc;
    const addressResolved = picked ? String(picked.address || "").trim() : addr;
    if (!chainName || !addressResolved) return null;
    const queryAddresses = picked
      ? getCardQueryAddresses(picked)
      : isBchChainName(chainName)
        ? getBchQueryAddressesFromCard({
            queryChainName: chainName,
            address: addressResolved,
          })
        : isBtcChainName(chainName)
          ? getBtcQueryAddressesFromCard({
              queryChainName: chainName,
              address: addressResolved,
            })
          : isLtcChainName(chainName)
            ? getLtcQueryAddressesFromCard({
                queryChainName: chainName,
                address: addressResolved,
              })
            : [addressResolved];
    const chainAddr = queryAddresses
      .map((queryAddress) => buildChainAddrEntry(chainName, queryAddress))
      .filter(Boolean)
      .join(",");
    return {
      chainName,
      address: addressResolved,
      chainKey: `${chainName}:${addressResolved}`,
      chainAddr,
    };
  };

  const isValidTx = (tx) => {
    if (!tx) return false;
    const amt = tx.amount;
    const num = Number(amt);
    if (
      amt === null ||
      amt === undefined ||
      amt === "" ||
      amt === "0" ||
      num === 0 ||
      Number.isNaN(num)
    ) {
      return false;
    }
    const st = tx.state;
    if (st === 0 || st === "0" || st === null || st === undefined) {
      return false;
    }
    return true;
  };

  const hasTx = (txHash) => {
    if (!txHash) return false;
    const key = String(txHash);
    return activityLogRef.current.some((tx) => {
      const k = tx?.txId || tx?.txid || tx?.tx_id || tx?.id || tx?.hash;
      return k && String(k) === key;
    });
  };

  const mergeActivityLog = (items, chainInfo) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const enriched = items.map((tx) => ({
      ...tx,
      chain: tx.chain || chainInfo.chainName,
      chainKey: tx.chainKey || chainInfo.chainKey,
      address: tx.address || chainInfo.address,
    }));
    const filtered = enriched.filter(isValidTx);
    if (filtered.length === 0) return;
    setActivityLog((prev) => {
      const all = [...filtered, ...(Array.isArray(prev) ? prev : [])];
      const map = new Map();
      for (const tx of all) {
        const k = tx?.txId || tx?.txid || tx?.tx_id || tx?.id || tx?.hash;
        if (k && !map.has(k)) map.set(k, tx);
      }
      return Array.from(map.values());
    });
  };

  const refreshActivityLogFromWss = async ({
    chain,
    address,
    txHash,
    status,
  }) => {
    if (status !== "success") return;
    const chainInfo = getChainAddrInfo(chain, address);
    if (!chainInfo) return;
    if (hasTx(txHash)) return;

    const now = Date.now();
    const last = wssRefreshMapRef.current.get(chainInfo.chainAddr) || 0;
    if (now - last < 8000) return;
    wssRefreshMapRef.current.set(chainInfo.chainAddr, now);

    const timeoutMs = 6000;
    let timer;
    try {
      const result = await Promise.race([
        fetchMergedTransactions({
          endpoint: accountAPI.queryTransaction,
          chainAddr: chainInfo.chainAddr,
          page: 1,
        }),
        new Promise((resolve) => {
          timer = setTimeout(
            () => resolve({ ok: false, transactions: [] }),
            timeoutMs
          );
        }),
      ]);
      if (!mountedRef.current) return;
      if (!result?.ok || !Array.isArray(result?.transactions)) return;
      mergeActivityLog(result.transactions, chainInfo);
    } catch (_e) {
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const rememberWssMessage = (key) => {
    if (!key) return true;
    const seen = wssSeenRef.current;
    if (seen.has(key)) return false;
    seen.add(key);
    if (seen.size > 200) {
      const first = seen.values().next().value;
      seen.delete(first);
    }
    return true;
  };

  const buildWssTargets = (cryptos = []) => {
    const out = new Map();
    const pushTarget = (chain, address) => {
      const chainName = String(chain || "").trim().toLowerCase();
      const addr = String(address || "").trim();
      if (!chainName || !addr) return;
      const dedupeKey = `${chainName}__${addr.toLowerCase()}`;
      if (!out.has(dedupeKey)) {
        out.set(dedupeKey, `${chainName}:${addr}`);
      }
    };
    (Array.isArray(cryptos) ? cryptos : []).forEach((crypto) => {
      const address = String(crypto?.address || "").trim();
      const chain = String(crypto?.queryChainName || "").trim().toLowerCase();
      if (!address || !chain) return;
      pushTarget(chain, address);
      if (isBchCard(crypto)) {
        const normalized = enrichBchAddressData(crypto, crypto?.bchAddressType);
        pushTarget(chain, normalized?.bchCashAddr);
        pushTarget(chain, normalized?.bchLegacyAddr);
      } else if (isBtcCard(crypto)) {
        const normalized = enrichBtcAddressData(crypto, crypto?.btcAddressType);
        pushTarget(chain, normalized?.btcLegacyAddr);
        pushTarget(chain, normalized?.btcNestedSegwitAddr);
        pushTarget(chain, normalized?.btcNativeSegwitAddr);
        pushTarget(chain, normalized?.btcTaprootAddr);
      } else if (isLtcCard(crypto)) {
        const normalized = enrichLtcAddressData(crypto, crypto?.ltcAddressType);
        pushTarget(chain, normalized?.ltcLegacyAddr);
        pushTarget(chain, normalized?.ltcNestedSegwitAddr);
        pushTarget(chain, normalized?.ltcNativeSegwitAddr);
      }
    });
    return Array.from(out.values());
  };

  const clearWssReconnectTimer = () => {
    if (wssReconnectTimerRef.current) {
      clearTimeout(wssReconnectTimerRef.current);
      wssReconnectTimerRef.current = null;
    }
  };

  const closeWss = (reason = "close") => {
    try {
      if (reason === "no-targets" || reason === "cleanup") {
        wssShouldReconnectRef.current = false;
      }
      clearWssReconnectTimer();
      if (wssTimeoutRef.current) {
        clearTimeout(wssTimeoutRef.current);
        wssTimeoutRef.current = null;
      }
      if (wssRef.current) {
        const ws = wssRef.current;
        const meta = wssConnMetaRef.current;
        wssRef.current = null;
        wssConnMetaRef.current = null;
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        const aliveMs =
          meta?.openedAt && Number.isFinite(meta.openedAt)
            ? Date.now() - meta.openedAt
            : undefined;
        try {
          ws.close();
        } catch {}
      }
    } catch {}
  };

  const scheduleWssReconnect = (reason = "unknown") => {
    if (!wssShouldReconnectRef.current) return;
    if (!wssTargetListRef.current || wssTargetListRef.current.length === 0) {
      return;
    }
    if (wssReconnectTimerRef.current) return;
    wssReconnectTimerRef.current = setTimeout(() => {
      wssReconnectTimerRef.current = null;
      if (!wssShouldReconnectRef.current) return;
      if (!wssTargetListRef.current || wssTargetListRef.current.length === 0) {
        return;
      }
      openWss(wssTargetListRef.current);
    }, 5000);
  };

  const openWss = (targets) => {
    closeWss("restart");
    if (!targets || targets.length === 0) return;
    if (!pushAPI.enabled) {
      wssShouldReconnectRef.current = false;
      return;
    }
    wssShouldReconnectRef.current = true;
    const targetKey = targets.join(",");
    wssTargetsRef.current = targetKey;
    wssTargetListRef.current = targets;

    const ws = new WebSocket(pushAPI.transactionsWS);
    const connId = ++wssConnSeqRef.current;
    const openedAt = Date.now();
    wssConnMetaRef.current = { id: connId, openedAt, targetKey };
    wssRef.current = ws;

    wssTimeoutRef.current = setTimeout(() => {
      closeWss("timeout");
    }, 7 * 60 * 1000);

    ws.onopen = () => {
      try {
        ws.send(
          JSON.stringify({
            type: "subscribe_tx",
            targets: targetKey,
          })
        );
      } catch (err) {
        console.log(
          "[TX_WSS][GLOBAL] subscribe error:",
          {
            connId,
            targets: targetKey,
            message: err?.message || String(err || ""),
          }
        );
      }
    };

    ws.onerror = (err) => {
      console.log("[TX_WSS][GLOBAL] error:", {
        connId,
        targets: targetKey,
        message: err?.message || String(err || ""),
      });
    };

    ws.onclose = (event) => {
      const closeInfo = {
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
      };
      scheduleWssReconnect(`onclose:${closeInfo.code ?? "unknown"}`);
    };

    ws.onmessage = (event) => {
      try {
        const raw = event?.data;
        const msg =
          typeof raw === "string" && raw.trim().startsWith("{")
            ? JSON.parse(raw)
            : raw;
        if (!msg || typeof msg !== "object") return;
        if (msg?.type === "heartbeat") return;

        const messageType = msg?.type;
        const data = msg?.data && typeof msg.data === "object" ? msg.data : msg;
        const statusRaw = data?.status || data?.state || data?.result || "";
        const statusText = normalizeText(statusRaw);
        const status =
          statusText === "success"
            ? "success"
            : statusText === "fail" ||
              statusText === "failed" ||
              statusText === "error" ||
              statusText === "rejected" ||
              statusText === "cancelled"
            ? "fail"
            : "pending";

        const txHash =
          data?.tx_id ||
          data?.txid ||
          data?.txHash ||
          data?.hash ||
          data?.orderId ||
          data?.order_id;

        let chain = data?.chain;
        let address = data?.address;
        const fromAddress = data?.from_address || data?.fromAddress || data?.from;
        const toAddress = data?.to_address || data?.toAddress || data?.to;
        if ((!chain || !address) && wssTargetListRef.current.length === 1) {
          const [singleChain, singleAddress] =
            wssTargetListRef.current[0].split(":");
          chain = chain || singleChain;
          address = address || singleAddress;
        }

        const timestampRaw =
          data?.raw_timestamp || data?.timestamp || data?.time || data?.ts;
        const timestampNum = Number(timestampRaw);
        const failReason = formatWssReason(
          data?.reason ??
            data?.error ??
            data?.message ??
            data?.detail ??
            data?.details ??
            data?.vm_status ??
            data?.vmStatus
        );

        const msgKey =
          data?._msg_id ||
          `${messageType || "msg"}:${txHash || ""}:${timestampRaw || ""}`;
        if (!rememberWssMessage(msgKey)) return;

        if (
          messageType === "broadcast_status" ||
          messageType === "new_transaction"
        ) {
          addNotification({
            type: "transaction",
            status,
            chain,
            address,
            txHash,
            orderId: txHash,
            amount: data?.amount,
            unit: data?.symbol,
            symbol: data?.symbol,
            from: fromAddress,
            to: toAddress,
            direction:
              messageType === "new_transaction"
                ? data?.direction || "received"
                : undefined,
            timestamp: Number.isFinite(timestampNum)
              ? timestampNum
              : Date.now(),
            message:
              status === "success"
                ? i18n.t("Transaction confirmed")
                : status === "fail"
                ? failReason || i18n.t("Transaction Failed")
                : i18n.t(
                  "Waiting for on-chain confirmation, this may take a few minutes..."
                ),
          });
          refreshActivityLogFromWss({
            chain,
            address,
            txHash,
            status,
          });
        }
      } catch (e) {
        console.log("[TX_WSS][GLOBAL] message error:", e?.message || e);
      }
    };
  };

  useEffect(() => {
    if (verificationStatus === "waiting") {
      closeWss("syncing-wallet");
      return;
    }
    const targets = buildWssTargets(addedCryptos);
    const targetKey = targets.join(",");
    if (!targetKey) {
      closeWss("no-targets");
      return;
    }
    if (wssRef.current && wssTargetsRef.current === targetKey) {
      return;
    }
    openWss(targets);
    return () => {
      closeWss("cleanup");
    };
  }, [addedCryptos, verificationStatus]);

  const markNotificationRead = async (id) => {
    try {
      if (!id) return;
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        AsyncStorage.setItem("notifications", JSON.stringify(next)).catch(
          () => {}
        );
        return next;
      });
    } catch (e) {
      console.error("markNotificationRead failed:", e);
    }
  };

  const clearNotifications = async () => {
    try {
      setNotifications([]);
      await AsyncStorage.removeItem("notifications");
    } catch (e) {
      console.error("clearNotifications failed:", e);
    }
  };

  const updateExchangeRates = (partial = {}) => {
    try {
      setConvertRates((prev) => {
        const next = { ...prev, ...partial };
        AsyncStorage.setItem("exchangeRates", JSON.stringify(next)).catch(
          () => {}
        );
        return next;
      });
    } catch (e) {}
  };

  useEffect(() => {
    fetchAndStoreConvertRates();
  }, []);

  useEffect(() => {
    const parseVersion = (str) => {
      const raw = String(str || "").trim();
      const normalized = raw
        .replace(/^hw[_:-]*/i, "")
        .replace(/^bl[_:-]*/i, "")
        .trim();
      const match = normalized.match(/(\d+)[._-](\d+)[._-](\d+)/);
      if (!match) return null;
      return [
        Number(match[1] || 0),
        Number(match[2] || 0),
        Number(match[3] || 0),
      ];
    };

    const compareVersion = (a, b) => {
      if (!a || !b) return 0;
      for (let i = 0; i < 3; i += 1) {
        const av = Number(a[i] || 0);
        const bv = Number(b[i] || 0);
        if (av > bv) return 1;
        if (av < bv) return -1;
      }
      return 0;
    };

    const loadCachedFirmwareUpdateInfo = async () => {
      try {
        const raw = await AsyncStorage.getItem(FIRMWARE_UPDATE_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return parsed;
      } catch {
        return null;
      }
    };

    const fetchFirmwareUpdateInfo = async () => {
      if (!firmwareAPI.enabled) {
        return {
          checkedAt: Date.now(),
          hasUpdate: false,
        };
      }

      const [hardwareVersion, bluetoothVersion] = await Promise.all([
        getSecureItem("hardwareVersion"),
        getSecureItem("bluetoothVersion"),
      ]);

      if (!hardwareVersion && !bluetoothVersion) {
        return {
          checkedAt: Date.now(),
          hasUpdate: false,
        };
      }

      const response = await fetch(firmwareAPI.lvglList, {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json();
      const versionsMap =
        payload && typeof payload.versions === "object" ? payload.versions : {};

      let latestHardware = null;
      let latestBluetooth = null;

      Object.values(versionsMap).forEach((versionRaw) => {
        const versionStr = String(versionRaw || "").trim();
        const parsed = parseVersion(versionStr);
        if (!parsed) return;
        if (/^hw_/i.test(versionStr)) {
          if (!latestHardware || compareVersion(parsed, latestHardware) > 0) {
            latestHardware = parsed;
          }
        }
        if (/^bl_/i.test(versionStr)) {
          if (!latestBluetooth || compareVersion(parsed, latestBluetooth) > 0) {
            latestBluetooth = parsed;
          }
        }
      });

      const hardwareNeedsUpdate =
        !!hardwareVersion &&
        !!latestHardware &&
        compareVersion(latestHardware, parseVersion(hardwareVersion)) > 0;
      const bluetoothNeedsUpdate =
        !!bluetoothVersion &&
        !!latestBluetooth &&
        compareVersion(latestBluetooth, parseVersion(bluetoothVersion)) > 0;

      return {
        checkedAt: Date.now(),
        hasUpdate: hardwareNeedsUpdate || bluetoothNeedsUpdate,
      };
    };

    const refreshFirmwareUpdateInfo = async () => {
      let transferCompletedOnce = false;
      try {
        transferCompletedOnce =
          (await AsyncStorage.getItem(OTA_TRANSFER_COMPLETED_KEY)) === "1";
      } catch {}
      if (transferCompletedOnce) {
        setVersionHasUpdate(false);
        try {
          await AsyncStorage.setItem(
            FIRMWARE_UPDATE_CACHE_KEY,
            JSON.stringify({
              checkedAt: Date.now(),
              hasUpdate: false,
              transferCompletedOnce: true,
            }),
          );
        } catch {}
        return;
      }
      const cached = await loadCachedFirmwareUpdateInfo();
      if (cached) {
        setVersionHasUpdate(!!cached.hasUpdate);
      }

      try {
        const fresh = await fetchFirmwareUpdateInfo();
        setVersionHasUpdate(!!fresh.hasUpdate);
        await AsyncStorage.setItem(
          FIRMWARE_UPDATE_CACHE_KEY,
          JSON.stringify(fresh),
        );
      } catch {
        if (cached) {
          setVersionHasUpdate(!!cached.hasUpdate);
        }
      }
    };

    refreshFirmwareUpdateInfo();

    return () => {
    };
  }, []);

  return (
    <DeviceContext.Provider
      value={{
        bleManagerRef,
        verificationStatus,
        setVerificationStatus,
        updateCryptoData,
        cryptoCount,
        setCryptoCount,
        currencyUnit,
        setCurrencyUnit,
        currencies,
        initialAdditionalCryptos: initialAdditionalCryptosState,
        setInitialAdditionalCryptos,
        additionalCryptos,
        setAdditionalCryptos,
        setAddedCryptos,
        updateCryptoAddress,
        switchBchAddressType,
        switchBtcAddressType,
        switchLtcAddressType,
        refreshBtcAddressData,
        isVerificationSuccessful,
        setIsVerificationSuccessful,
        verifiedDevices,
        setVerifiedDevices,
        isScreenLockEnabled,
        setIsScreenLockEnabled,
        toggleScreenLock,
        screenLockPassword,
        screenLockType,
        changeScreenLockPassword,
        setScreenLockCredential,
        isSelfDestructEnabled,
        setIsSelfDestructEnabled,
        toggleSelfDestruct,
        selfDestructPassword,
        selfDestructType,
        setSelfDestructCredential,
        switchLockInputMode,
        settingsLoaded,
        isAppLaunching,
        setIsAppLaunching,
        cryptoCards,
        addedCryptos,
        setCryptoCards,
        exchangeRates,
        updateExchangeRates,
        ActivityLog,
        setActivityLog,
        accountName,
        setAccountName,
        accountId,
        setAccountId,
        versionHasUpdate,
        syncFirmwareUpdateInfo,
        notifications,
        addNotification,
        markNotificationRead,
        clearNotifications,
      }}
    >
      <DarkModeContext.Provider value={{ isDarkMode, setIsDarkMode }}>
        {children}
      </DarkModeContext.Provider>
    </DeviceContext.Provider>
  );
};

export default CryptoProvider;
