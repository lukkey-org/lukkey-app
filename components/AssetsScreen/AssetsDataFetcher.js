/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { accountAPI, metricsAPII } from "../../env/apiEndpoints";
import { RUNTIME_DEV } from "../../utils/runtimeFlags";
import { resolveMarketSymbol } from "../../config/priceSymbolAlias";
import {
  BCH_ADDRESS_TYPES,
  buildChainAddrEntry,
  normalizeAddressForComparison,
  normalizeBchAddressType,
} from "../../config/networkUtils";
import {
  getBchAddressType,
  getBchQueryAddressesFromCard,
  isBchCard,
} from "../../utils/bchAddress";
import {
  BTC_ADDRESS_TYPES,
  getBtcAddressType,
  getBtcQueryAddressesFromCard,
  isBtcCard,
  normalizeBtcAddressType,
} from "../../utils/btcAddress";
import {
  getLtcAddressType,
  getLtcQueryAddressesFromCard,
  isLtcCard,
  LTC_ADDRESS_TYPES,
  normalizeLtcAddressType,
} from "../../utils/ltcAddress";

let balanceRequestSeq = 0;
let inflightBalancePromise = null;

const devLog = (...args) => {
  if (!RUNTIME_DEV) return;
  try {
    console.log(...args);
  } catch {}
};

const devWarn = (...args) => {
  if (!RUNTIME_DEV) return;
  try {
    console.warn(...args);
  } catch {}
};

const logFetchedBalances = (payloads) => {
  if (!Array.isArray(payloads) || payloads.length === 0) return;
};

const logBalanceQuery = (payload) => {
};

const isWalletSyncBalanceLog = (source, verificationStatus) => {
  const src = String(source || "").trim();
  const status = String(verificationStatus || "").trim();
  return src === "walletReady" || status === "walletReady";
};

const logWalletSyncBalanceResponse = ({
  requestSeq,
  source,
  verificationStatus,
  chainAddr,
  status,
  rawResponseText,
  data,
}) => {
  if (!isWalletSyncBalanceLog(source, verificationStatus)) return;
  try {
    console.log("[SyncWallet][balance] response ->", {
      requestSeq,
      source,
      verificationStatus,
      status,
      chainCount: Array.isArray(data) ? data.length : undefined,
    });
  } catch {}
};

const BALANCE_SYMBOL_ALIAS_BY_CHAIN = {
  aurora: {
    aurora: ["eth"],
  },
  // OKB is no longer supported.
  // okb: {
  //   okt: ["okb"],
  // },
};

const normalizeLower = (value) => String(value || "").trim().toLowerCase();
const normalizeChainKey = (value) => String(value || "").trim().toLowerCase();
const getNftMintValue = (card) => String(card?.tokenId ?? card?.mint ?? "");
const normalizeAddressKey = (value, chainName = "") =>
  normalizeAddressForComparison(chainName, value);
const getCardQueryAddresses = (card) => {
  if (isBchCard(card)) return getBchQueryAddressesFromCard(card);
  if (isBtcCard(card)) return getBtcQueryAddressesFromCard(card);
  if (isLtcCard(card)) return getLtcQueryAddressesFromCard(card);
  const address = String(card?.address || "").trim();
  return address ? [address] : [];
};

const getBalanceSymbolCandidates = (card) => {
  const chain = normalizeLower(card?.queryChainName);
  const shortName = normalizeLower(card?.shortName);
  const aliasMap = BALANCE_SYMBOL_ALIAS_BY_CHAIN[chain] || {};
  const aliases = Array.isArray(aliasMap[shortName]) ? aliasMap[shortName] : [];
  return Array.from(new Set([shortName, ...aliases].filter(Boolean)));
};

const isLikelyNativeCard = (card) => {
  const contract = normalizeLower(card?.contractAddress);
  if (contract) return false;

  const coinType = normalizeLower(card?.coin_type);
  if (coinType === "native") return true;

  const shortName = normalizeLower(card?.shortName);
  const chainShortName = normalizeLower(card?.queryChainShortName);
  return Boolean(shortName && chainShortName && shortName === chainShortName);
};

const findMatchedAsset = (card, assets) => {
  if (!Array.isArray(assets) || assets.length === 0) return null;

  const cardContract = normalizeLower(card?.contractAddress);
  if (cardContract) {
    const byContract = assets.find(
      (asset) => normalizeLower(asset?.tokenContractAddress) === cardContract,
    );
    if (byContract) return byContract;
  }

  const symbolCandidates = getBalanceSymbolCandidates(card);
  if (symbolCandidates.length > 0) {
    const bySymbol = assets.find((asset) =>
      symbolCandidates.includes(normalizeLower(asset?.symbol)),
    );
    if (bySymbol) return bySymbol;
  }

  const cardName = normalizeLower(card?.name);
  if (cardName) {
    const byName = assets.find(
      (asset) => normalizeLower(asset?.name) === cardName,
    );
    if (byName) return byName;
  }

  if (isLikelyNativeCard(card)) {
    const nativeAsset = assets.find((asset) => {
      const coinType = normalizeLower(asset?.coin_type);
      return coinType === "native" || !normalizeLower(asset?.tokenContractAddress);
    });
    if (nativeAsset) return nativeAsset;
  }

  return null;
};

const extractAssetAmount = (asset) => {
  const candidates = [
    asset?.amount,
    asset?.balance,
    asset?.availableAmount,
    asset?.available,
    asset?.value,
  ];
  for (const value of candidates) {
    if (typeof value === "number") return String(value);
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
};

const normalizeBalanceAmount = (asset) => {
  const amount = extractAssetAmount(asset);
  return amount !== "" ? amount : "0.0";
};

const parseNumericAmount = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const BTC_BALANCE_FIELD_BY_TYPE = {
  [BTC_ADDRESS_TYPES.LEGACY]: "btcLegacyBalance",
  [BTC_ADDRESS_TYPES.NESTED_SEGWIT]: "btcNestedSegwitBalance",
  [BTC_ADDRESS_TYPES.NATIVE_SEGWIT]: "btcNativeSegwitBalance",
  [BTC_ADDRESS_TYPES.TAPROOT]: "btcTaprootBalance",
};

const BCH_BALANCE_FIELD_BY_TYPE = {
  [BCH_ADDRESS_TYPES.CASHADDR]: "bchCashaddrBalance",
  [BCH_ADDRESS_TYPES.LEGACY]: "bchLegacyBalance",
};

const LTC_BALANCE_FIELD_BY_TYPE = {
  [LTC_ADDRESS_TYPES.LEGACY]: "ltcLegacyBalance",
  [LTC_ADDRESS_TYPES.NESTED_SEGWIT]: "ltcNestedSegwitBalance",
  [LTC_ADDRESS_TYPES.NATIVE_SEGWIT]: "ltcNativeSegwitBalance",
};

const EMPTY_BTC_ADDRESS_BALANCES = {
  [BTC_ADDRESS_TYPES.LEGACY]: "0",
  [BTC_ADDRESS_TYPES.NESTED_SEGWIT]: "0",
  [BTC_ADDRESS_TYPES.NATIVE_SEGWIT]: "0",
  [BTC_ADDRESS_TYPES.TAPROOT]: "0",
};

const EMPTY_BCH_ADDRESS_BALANCES = {
  [BCH_ADDRESS_TYPES.CASHADDR]: "0",
  [BCH_ADDRESS_TYPES.LEGACY]: "0",
};

const EMPTY_LTC_ADDRESS_BALANCES = {
  [LTC_ADDRESS_TYPES.LEGACY]: "0",
  [LTC_ADDRESS_TYPES.NESTED_SEGWIT]: "0",
  [LTC_ADDRESS_TYPES.NATIVE_SEGWIT]: "0",
};

const resolveBtcAccountAddressType = (account) => {
  const fromApi = normalizeLower(account?.addressType);
  if (BTC_BALANCE_FIELD_BY_TYPE[fromApi]) return fromApi;
  return getBtcAddressType(account?.address);
};

const resolveBchAccountAddressType = (account) => {
  const fromApi = normalizeLower(account?.addressType);
  if (BCH_BALANCE_FIELD_BY_TYPE[fromApi]) return fromApi;
  return getBchAddressType(account?.address);
};

const resolveLtcAccountAddressType = (account) => {
  const fromApi = normalizeLower(account?.addressType);
  if (LTC_BALANCE_FIELD_BY_TYPE[fromApi]) return fromApi;
  return getLtcAddressType(account?.address);
};

const buildTypedAddressBalanceFields = ({
  card,
  accounts,
  chainName,
  emptyBalances,
  fieldByType,
  resolveAddressType,
  balancesFieldName,
  totalFieldName,
}) => {
  const nextBalances = { ...emptyBalances };
  const queryAddressSet = new Set(
    getCardQueryAddresses(card).map((address) =>
      normalizeAddressKey(address, chainName),
    ),
  );

  for (const account of Array.isArray(accounts) ? accounts : []) {
    const addressKey = normalizeAddressKey(account?.address, chainName);
    if (!queryAddressSet.has(addressKey)) continue;
    const addressType = resolveAddressType(account);
    if (!fieldByType[addressType]) continue;
    const asset = findMatchedAsset(card, account?.assets);
    if (!asset) continue;
    nextBalances[addressType] = normalizeBalanceAmount(asset);
  }

  const totalBalance = Object.values(nextBalances).reduce(
    (sum, value) => sum + parseNumericAmount(value),
    0,
  );

  return Object.entries(fieldByType).reduce(
    (acc, [addressType, fieldName]) => {
      acc[fieldName] = nextBalances[addressType];
      return acc;
    },
    {
      [balancesFieldName]: nextBalances,
      [totalFieldName]: totalBalance.toString(),
    },
  );
};

const buildBtcAddressBalanceFields = (card, accounts) =>
  buildTypedAddressBalanceFields({
    card,
    accounts,
    chainName: "bitcoin",
    emptyBalances: EMPTY_BTC_ADDRESS_BALANCES,
    fieldByType: BTC_BALANCE_FIELD_BY_TYPE,
    resolveAddressType: resolveBtcAccountAddressType,
    balancesFieldName: "btcAddressBalances",
    totalFieldName: "btcTotalBalance",
  });

const buildBchAddressBalanceFields = (card, accounts) =>
  buildTypedAddressBalanceFields({
    card,
    accounts,
    chainName: "bitcoin_cash",
    emptyBalances: EMPTY_BCH_ADDRESS_BALANCES,
    fieldByType: BCH_BALANCE_FIELD_BY_TYPE,
    resolveAddressType: resolveBchAccountAddressType,
    balancesFieldName: "bchAddressBalances",
    totalFieldName: "bchTotalBalance",
  });

const buildLtcAddressBalanceFields = (card, accounts) =>
  buildTypedAddressBalanceFields({
    card,
    accounts,
    chainName: "litecoin",
    emptyBalances: EMPTY_LTC_ADDRESS_BALANCES,
    fieldByType: LTC_BALANCE_FIELD_BY_TYPE,
    resolveAddressType: resolveLtcAccountAddressType,
    balancesFieldName: "ltcAddressBalances",
    totalFieldName: "ltcTotalBalance",
  });

const getTypedBalanceFieldsForCard = (card, accounts) => {
  if (!isLikelyNativeCard(card)) return null;
  if (isBtcCard(card)) return buildBtcAddressBalanceFields(card, accounts);
  if (isBchCard(card)) return buildBchAddressBalanceFields(card, accounts);
  if (isLtcCard(card)) return buildLtcAddressBalanceFields(card, accounts);
  return null;
};

const getActiveAddressTypeForCard = (card) => {
  if (isBtcCard(card)) return normalizeBtcAddressType(card?.btcAddressType);
  if (isBchCard(card)) return normalizeBchAddressType(card?.bchAddressType);
  if (isLtcCard(card)) return normalizeLtcAddressType(card?.ltcAddressType);
  return "";
};

const getTypedBalancesForCard = (card, typedFields) => {
  if (isBtcCard(card)) return typedFields?.btcAddressBalances;
  if (isBchCard(card)) return typedFields?.bchAddressBalances;
  if (isLtcCard(card)) return typedFields?.ltcAddressBalances;
  return null;
};

const isPositiveAssetAmount = (asset) => parseNumericAmount(extractAssetAmount(asset)) > 0;

const shouldRetrySuspiciousNativeZeros = (cards, accounts) => {
  const cardList = Array.isArray(cards) ? cards : [];
  const accountList = Array.isArray(accounts) ? accounts : [];
  if (cardList.length === 0 || accountList.length === 0) return false;

  const nativeCards = cardList.filter((card) => isLikelyNativeCard(card));
  if (nativeCards.length === 0) return false;

  let requestedNativeCount = 0;
  let zeroNativeCount = 0;
  let hasPositiveTokenBalance = false;

  for (const acc of accountList) {
    const assets = Array.isArray(acc?.assets) ? acc.assets : [];
    if (assets.some((asset) => normalizeLower(asset?.coin_type) !== "native" && isPositiveAssetAmount(asset))) {
      hasPositiveTokenBalance = true;
    }
  }

  for (const card of nativeCards) {
    const chainKey = normalizeChainKey(card?.queryChainName);
    const addrKey = normalizeAddressKey(card?.address, chainKey);
    if (!chainKey || !addrKey) continue;

    const acc = accountList.find(
      (item) =>
        normalizeChainKey(item?.chain) === chainKey &&
        normalizeAddressKey(item?.address, chainKey) === addrKey,
    );
    if (!acc || !Array.isArray(acc.assets)) continue;

    const asset = findMatchedAsset(card, acc.assets);
    if (!asset) continue;

    requestedNativeCount += 1;
    if (parseNumericAmount(extractAssetAmount(asset)) === 0) {
      zeroNativeCount += 1;
    }
  }

  return requestedNativeCount > 0 && zeroNativeCount === requestedNativeCount && hasPositiveTokenBalance;
};

const buildAccountAssetSummary = (accounts) =>
  (Array.isArray(accounts) ? accounts : []).map((acc) => {
    const assets = Array.isArray(acc?.assets) ? acc.assets : [];
    const nativeAsset = assets.find(
      (asset) => normalizeLower(asset?.coin_type) === "native",
    );
    const positiveTokens = assets
      .filter(
        (asset) =>
          normalizeLower(asset?.coin_type) !== "native" && isPositiveAssetAmount(asset),
      )
      .map((asset) => `${asset?.symbol || "?"}:${extractAssetAmount(asset)}`);
    return {
      chain: acc?.chain || "",
      address: acc?.address || "",
      native: nativeAsset
        ? `${nativeAsset?.symbol || "?"}:${extractAssetAmount(nativeAsset)}`
        : "",
      positiveTokens,
    };
  });

const getCardMergeKey = (card) => {
  const chain = normalizeChainKey(card?.queryChainName || card?.queryChainShortName);
  const address = normalizeAddressKey(card?.address, chain);
  const contract = normalizeLower(
    card?.contractAddress || card?.contract_address || card?.tokenContractAddress,
  );
  const tokenId = normalizeLower(getNftMintValue(card));
  const symbol = normalizeLower(card?.shortName);
  const name = normalizeLower(card?.name);
  return `${chain}__${address}__${contract}__${tokenId}__${symbol}__${name}`;
};

const buildAccountBalanceLookup = (
  accounts,
  preferredEntryRank = new Map(),
) => {
  const lookup = new Map();
  const rankByLookupKey = new Map();
  const payloads = [];

  if (!Array.isArray(accounts)) {
    return { lookup, payloads };
  }

  for (const acc of accounts) {
    const chainKey = normalizeChainKey(acc?.chain);
    const addrKey = normalizeAddressKey(acc?.address, chainKey);
    if (!chainKey || !addrKey) continue;

    const key = `${chainKey}__${addrKey}`;
    const rawEntry =
      buildChainAddrEntry(acc?.chain, acc?.address) ||
      `${chainKey}:${String(acc?.address || "").trim()}`;
    const rank = Number(preferredEntryRank.get(rawEntry.toLowerCase()));
    const normalizedRank = Number.isFinite(rank) ? rank : Number.MAX_SAFE_INTEGER;
    const existingRank = Number(rankByLookupKey.get(key));
    const shouldReplace =
      !lookup.has(key) ||
      !Number.isFinite(existingRank) ||
      normalizedRank < existingRank;
    if (shouldReplace) {
      lookup.set(key, {
        chain: acc?.chain || "",
        address: acc?.address || "",
        addressType: acc?.addressType || "",
        addressTypeName: acc?.addressTypeName || "",
        assets: Array.isArray(acc?.assets) ? acc.assets : [],
      });
      rankByLookupKey.set(key, normalizedRank);
    }

    const assets = Array.isArray(acc?.assets) ? acc.assets : [];
    assets.forEach((asset) => {
      payloads.push({
        chain: acc?.chain || "",
        address: acc?.address || "",
        symbol: asset?.symbol || "",
        balance: normalizeBalanceAmount(asset),
      });
    });
  }

  return { lookup, payloads };
};

/**
 * Get price change data
 * @param {Array} cryptoCards - Array of currency cards
 * @param {Function} setPriceChanges - Set price change status function
 * @param {Function} setCryptoCards - function to set currency card status
 * @param {Function} setRefreshing - set refresh status function
 */
export const fetchPriceChanges = async (
  cryptoCards,
  setPriceChanges,
  setCryptoCards,
  setRefreshing,
  updateExchangeRates, // optional: persist coin->USD fallback
) => {
  if (cryptoCards.length === 0) return; // Do not request when there is no card
  if (!metricsAPII.enabled) {
    setPriceChanges?.({});
    return;
  }

  const instIds = Array.from(
    new Set(
      (cryptoCards || [])
        .map((card) =>
          resolveMarketSymbol(card?.shortName, card?.queryChainName),
        )
        .filter(Boolean)
        .map((symbol) => `${symbol}-USD`),
    ),
  ).join(",");

  try {
    const response = await fetch(
      `${metricsAPII.indexTickers}?instId=${instIds}`,
    );
    const data = await response.json();

    if (data.code === 0 && data.data) {
      const changes = {};

      // Parse the 'data' object returned and update it by currency
      Object.keys(data.data).forEach((key) => {
        const shortName = key.replace("$", "").split("-")[0]; // Extract currency name
        const ticker = data.data[key];

        changes[shortName] = {
          priceChange: ticker.last || "0", // latest price
          percentageChange: ticker.changePercent || "0", // Percent change
        };
      });

      // Backfill market symbol quotes to card symbols (e.g. OETH -> ETH quotes)
      const changesByCardSymbol = { ...changes };
      (cryptoCards || []).forEach((card) => {
        const cardSymbol = String(card?.shortName || "")
          .trim()
          .toUpperCase();
        const marketSymbol = resolveMarketSymbol(
          card?.shortName,
          card?.queryChainName,
        );
        if (!cardSymbol || !marketSymbol) return;
        if (changesByCardSymbol[cardSymbol]) return;
        if (changes[marketSymbol]) {
          changesByCardSymbol[cardSymbol] = changes[marketSymbol];
        }
      });

      setPriceChanges(changesByCardSymbol); // update status

      // Persist the latest currency→USD price as a fallback (used for fallback when the market price is not obtained)
      if (typeof updateExchangeRates === "function") {
        try {
          const patch = {};
          Object.keys(changesByCardSymbol).forEach((sn) => {
            const v = Number(changesByCardSymbol[sn]?.priceChange);
            if (!Number.isNaN(v) && v > 0) patch[sn] = v;
          });
          if (Object.keys(patch).length > 0) {
            updateExchangeRates(patch);
          }
        } catch {}
      }

      // Update priceUsd in cryptoCards
      setCryptoCards((prevCards) => {
        let hasChange = false;
        const updatedCards = prevCards.map((card) => {
          const marketSymbol = resolveMarketSymbol(
            card?.shortName,
            card?.queryChainName,
          );
          if (
            changes[marketSymbol] &&
            card.priceUsd !== changes[marketSymbol].priceChange
          ) {
            hasChange = true;
            return {
              ...card,
              priceUsd: changes[marketSymbol].priceChange, // Update prices (support alias quotes)
            };
          }
          return card;
        });
        if (hasChange) {
          return updatedCards;
        } else {
          return prevCards;
        }
      });
    }
  } catch (error) {
    //    devLog("Error fetching price changes:", error);
  } finally {
    setRefreshing(false);
  }
};

/**
 * Get wallet balance
 * @param {Array} cryptoCards - Array of currency cards
 * @param {Function} setCryptoCards - function to set currency card status
 */
export const fetchWalletBalance = async (
  cryptoCards,
  setCryptoCards,
  options = {},
) => {
  if (!accountAPI.enabled) {
    devWarn("[AssetsDataFetcher] balance fetch skipped: chain API is not configured");
    return;
  }

  try {
    const cards = Array.isArray(cryptoCards) ? cryptoCards : [];
    // 1) Only collect cards whose address is not empty and has a chain name, and remove duplicates (chain, address)
    const unique = new Map();
    const preferredEntryRank = new Map();
    for (const c of cards) {
      const chain = String(c?.queryChainName || "").trim();
      const addr = String(c?.address || "").trim();
      if (!chain || !addr) continue;
      const queryAddresses = getCardQueryAddresses(c);
      for (const queryAddress of queryAddresses) {
        const requestAddress = String(queryAddress || "").trim();
        if (!requestAddress) continue;
        const payloadEntry = buildChainAddrEntry(chain, requestAddress);
        if (!payloadEntry) continue;
        const key = payloadEntry.toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, payloadEntry);
          preferredEntryRank.set(key, preferredEntryRank.size);
        }
      }
    }

    // If there is no address that can be queried, it will be returned directly (without changing the local location)
    if (unique.size === 0) {
      devLog(
        "[AssetsDataFetcher] fetchWalletBalance start -> no queryable addresses, current cryptoCards count:",
        cards.length,
      );
      return;
    }

    // 2) Splice the chainAddr string as required
    const chainAddr = Array.from(unique.values()).join(",");
    const retryCount = Number(options?.retryCount || 0);
    const source = String(options?.source || "unknown");
    const verificationStatus = String(options?.verificationStatus || "");
    const bypassInflightReuse = Boolean(options?.bypassInflightReuse);

    if (inflightBalancePromise && !bypassInflightReuse) {
      devLog("[AssetsDataFetcher] reusing in-flight balance request (non-interruptible) ->", {
        source,
        verificationStatus,
        chainAddr,
      });
      return inflightBalancePromise;
    }

    if (inflightBalancePromise && bypassInflightReuse) {
      devLog("[AssetsDataFetcher] skipping in-flight balance request, forcing a new request ->", {
        source,
        verificationStatus,
        chainAddr,
      });
    }

    const requestSeq = ++balanceRequestSeq;
    const run = (async () => {
      // 3) One-time POST query /api/wallet/balance
      logBalanceQuery({
        chainAddr,
        requestSeq,
        retryCount,
        source,
        verificationStatus,
      });
      devLog("[AssetsDataFetcher] balance POST payload ->", {
        requestSeq,
        retryCount,
        source,
        verificationStatus,
        cardCount: cards.length,
        chainAddr,
      });
      const response = await fetch(accountAPI.balance, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ chainAddr }),
      });

      const contentType = response.headers?.get?.("content-type") || "";
      if (!response.ok || !contentType.includes("application/json")) {
        const preview = await response.text().catch(() => "");
        devLog(
          `[AssetsDataFetcher] balance batch API error, status=${
            response.status
          }, contentType=${contentType}, preview=${preview?.slice?.(0, 120)}`,
        );
        return;
      }

      let rawResponseText = "";
      try {
        rawResponseText = await response.clone().text();
        devLog("[AssetsDataFetcher] balance raw response ->", {
          requestSeq,
          retryCount,
          source,
          verificationStatus,
          chainAddr,
          rawResponseText,
        });
      } catch (e) {
        devWarn("[AssetsDataFetcher] failed to read raw balance response:", e);
      }

      let data;
      try {
        data = await response.json();
      } catch (e) {
        devWarn("[AssetsDataFetcher] failed to parse balance batch response as JSON:", {
          error: e,
          requestSeq,
          source,
          verificationStatus,
          chainAddr,
          rawResponseText,
        });
        return;
      }

      logWalletSyncBalanceResponse({
        requestSeq,
        source,
        verificationStatus,
        chainAddr,
        status: response.status,
        rawResponseText,
        data,
      });

      // No longer use codeOk to gate accounts, try to parse out the returned accounts
      let accounts = [];
      if (Array.isArray(data?.data?.accounts)) {
        accounts = data.data.accounts;
      } else if (Array.isArray(data?.accounts)) {
        accounts = data.accounts;
      } else {
        accounts = [];
      }

      if (
        retryCount < 1 &&
        shouldRetrySuspiciousNativeZeros(cards, accounts)
      ) {
        devWarn(
          "[AssetsDataFetcher] detected suspicious all-zero native coin response, retrying once after delay ->",
          {
            retryCount,
            source,
            verificationStatus,
            url: accountAPI.balance,
            chainAddr,
            summary: buildAccountAssetSummary(accounts),
          },
        );
        await new Promise((resolve) => setTimeout(resolve, 800));
        inflightBalancePromise = null;
        return fetchWalletBalance(cards, setCryptoCards, {
          ...options,
          retryCount: retryCount + 1,
        });
      }

      // 4) Construct (chain,address) -> account mapping, remove spaces and convert to lowercase, ignore differences in case and whitespace when matching
      const { lookup: accMap, payloads: fetchedBalances } =
        buildAccountBalanceLookup(accounts, preferredEntryRank);
      devLog(
        "[AssetsDataFetcher] fetchWalletBalance mapped account keys ->",
        {
          requestSeq,
          source,
          verificationStatus,
          accountKeys: Array.from(accMap.keys()),
        },
      );
      if (Array.isArray(data?.data?.errors) && data.data.errors.length > 0) {
        devWarn("[AssetsDataFetcher] balance API returned errors ->", data.data.errors);
      }

      logFetchedBalances(fetchedBalances);

      // 5) Based on the unified parsed account mapping, all card displays are updated at one time
      let hasChange = false;
      const updatedCards = cards.map((card) => {
        if (!card) return card;

        const chainKey = normalizeChainKey(card?.queryChainName);
        const addrKey = normalizeAddressKey(card?.address, chainKey);
        let nextBalance =
          typeof card?.balance === "string" && card.balance.trim() !== ""
            ? card.balance.trim()
            : "0.0";

        if (chainKey && addrKey && accMap.size > 0) {
          const typedBalanceFields = getTypedBalanceFieldsForCard(card, accounts);
          if (typedBalanceFields) {
            const activeType = getActiveAddressTypeForCard(card);
            const typedBalances = getTypedBalancesForCard(card, typedBalanceFields);
            if (typedBalances?.[activeType] != null) {
              nextBalance = typedBalances[activeType];
            }
          } else {
            const mapKey = `${chainKey}__${addrKey}`;
            const acc = accMap.get(mapKey);

            if (!acc) {
              devLog("[AssetsDataFetcher] no account match found ->", {
                mapKey,
                accMapKeys: Array.from(accMap.keys()),
              });
            }

            if (acc && Array.isArray(acc.assets)) {
              const asset = findMatchedAsset(card, acc.assets);

              // If there is still no hit, print the available symbol (no details)
              if (!asset) {
                devLog("[AssetsDataFetcher] no matching asset found ->", {
                  chain: chainKey,
                  address: addrKey,
                  expectSymbols: getBalanceSymbolCandidates(card),
                  available: acc.assets.map((x) => x?.symbol).filter(Boolean),
                });
              } else {
                devLog("[AssetsDataFetcher] asset match found ->", {
                  chain: chainKey,
                  address: addrKey,
                  cardSymbol: card?.shortName,
                  apiSymbol: asset?.symbol,
                  contractAddress: asset?.tokenContractAddress,
                  amount: asset?.amount,
                });
              }

              if (asset) {
                nextBalance = normalizeBalanceAmount(asset);
                if (extractAssetAmount(asset) === "") {
                  devWarn("[AssetsDataFetcher] matched asset but balance field is empty, using 0.0 ->", {
                    chain: chainKey,
                    address: addrKey,
                    cardSymbol: card?.shortName,
                    apiSymbol: asset?.symbol,
                    rawAsset: asset,
                  });
                }
              }
            }
          }
        }

        // Valuation = quantity * unit price (if legal currency valuation needs to be displayed)
        const price = Number(card?.priceUsd ?? 0);
        const balNum = Number(nextBalance);
        const nextEstimated =
          Number.isFinite(balNum) && Number.isFinite(price) && price > 0
            ? (balNum * price).toFixed(2)
            : "0.0";
        const nextTypedBalanceFields = getTypedBalanceFieldsForCard(card, accounts);

        if (
          card.balance !== nextBalance ||
          card.EstimatedValue !== nextEstimated ||
          (nextTypedBalanceFields &&
            Object.entries(nextTypedBalanceFields).some(
              ([key, value]) =>
                JSON.stringify(card?.[key] ?? null) !== JSON.stringify(value),
            ))
        ) {
          hasChange = true;
          return {
            ...card,
            balance: nextBalance,
            EstimatedValue: nextEstimated,
            ...(nextTypedBalanceFields || {}),
          };
        }
        return card;
      });

      if (hasChange) {
        devLog(
          "[AssetsDataFetcher] fetchWalletBalance updated ->",
          {
            requestSeq,
            source,
            verificationStatus,
            chainAddr,
          },
        );
        devLog(
          "[AssetsDataFetcher] fetchWalletBalance updated -> count:",
          updatedCards.length,
        );
        AsyncStorage.setItem("cryptoCards", JSON.stringify(updatedCards))
          .then(() => {
            devLog("[AssetsDataFetcher] persisted to AsyncStorage: cryptoCards");
          })
          .catch((e) => {
            devWarn("[AssetsDataFetcher] failed to persist cryptoCards:", e);
          });
        setCryptoCards((prevCards) => {
          const prevList = Array.isArray(prevCards) ? prevCards : [];
          if (prevList.length === updatedCards.length) {
            return updatedCards;
          }

          const updatedMap = new Map(
            updatedCards.map((card) => [getCardMergeKey(card), card]),
          );

          return prevList.map((card) => updatedMap.get(getCardMergeKey(card)) || card);
        });
      } else if (RUNTIME_DEV) {
        // Keep minimal debugging context and avoid outputting the entire card JSON
        devLog(
          "[AssetsDataFetcher] fetchWalletBalance unchanged -> keeping current cryptoCards, count:",
          cards.length,
        );
      }
    })();

    const wrappedPromise = run.finally(() => {
      if (inflightBalancePromise === wrappedPromise) {
        inflightBalancePromise = null;
      }
    });
    inflightBalancePromise = wrappedPromise;
    return inflightBalancePromise;
  } catch (error) {
    devLog("Error fetching wallet balance:", error);
  }
};
