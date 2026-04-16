/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchMergedTransactions, buildChainAddr } from "./queryTransactions";
import { getCachedTransactions, setCachedTransactions } from "./txCache";
import { RUNTIME_DEV } from "./runtimeFlags";
import {
  areAddressesEquivalent,
  normalizeAddressForComparison,
} from "../config/networkUtils";
import { getBchQueryAddressesFromCard, isBchCard } from "./bchAddress";
import { getBtcQueryAddressesFromCard, isBtcCard } from "./btcAddress";

const getCardQueryAddresses = (card) => {
  if (isBchCard(card)) return getBchQueryAddressesFromCard(card);
  if (isBtcCard(card)) return getBtcQueryAddressesFromCard(card);
  const address = String(card?.address || "").trim();
  return address ? [address] : [];
};

const cardContainsAddress = (card, address) =>
  getCardQueryAddresses(card).some((entry) =>
    areAddressesEquivalent(card?.queryChainName, entry, address),
  );

const devLog = (...args) => {
  if (RUNTIME_DEV) console.log(...args);
};

const devWarn = (...args) => {
  if (RUNTIME_DEV) console.warn(...args);
};

/**
  * Transaction history data structure description:
  * Each transaction record is an object containing the following main fields:
  * - amount: transaction amount, string or number
  * - state: transaction status, string or number, indicating success or failure, etc.
  * - transactionTime: transaction timestamp, numeric type, indicating the time when the transaction occurred
  * - symbol: trading currency symbol, string
  * - address: transaction-related address, string
  * - fromAddress: sender address, string
  * - to: recipient address, string
  * - txid: transaction hash, string
  * - txFee: transaction fee, string or number
  * - height: block height, number
  * - chainKey: the unique identifier of the chain to which the transaction belongs, a string in the format of "chain name: address"
  * Other fields may be different depending on the interface return, but the original fields are retained.
 *
  * fetchAllActivityLog and fetchNextActivityLogPage function description:
  * - fetchAllActivityLog: Used to query the transaction history of the first page of all currencies, send a request to the server to obtain the first page data, filter it and store it persistently, and update the status.
  * - fetchNextActivityLogPage: Used to query the next page of transaction history of all currencies in pages, send a request to the server to obtain the next page of data, merge and filter it for persistent storage, and update the status.
 *
  * Both functions make requests to the server. The difference is that fetchAllActivityLog queries the first page data, and fetchNextActivityLogPage queries subsequent paging data.
 *
  * When the function is executed, a log will be printed on the terminal to facilitate developers to understand the currently performed operations.
 *
  * @param {Object[]} addressSourceCards - runtime currency array (requires address)
  * @param {Function} setActivityLog - setState of transaction history
  * @param {Function} setActivityLogPages - setState to set the paging state
  * @param {Object} accountAPI - API object, requires queryTransaction field
 */
export const fetchAllActivityLog = async ({
  addressSourceCards,
  setActivityLog,
  setActivityLogPages,
  accountAPI,
}) => {
  if (addressSourceCards && addressSourceCards.length > 0) {
    devLog("fetchAllActivityLog: start fetching first page of transaction history");
    const uniqueCryptos = addressSourceCards.filter(
      (crypto, index, self) =>
        crypto.address &&
        crypto.address.trim() !== "" &&
        index ===
          self.findIndex(
            (c) =>
              String(c.queryChainName || "").trim().toLowerCase() ===
                String(crypto.queryChainName || "").trim().toLowerCase() &&
              normalizeAddressForComparison(c.queryChainName, c.address) ===
                normalizeAddressForComparison(
                  crypto.queryChainName,
                  crypto.address,
                )
          )
    );

    // Merge request: Construct multi-chain chainAddr in one query
    const entries = uniqueCryptos.flatMap((c) => {
      const chain = String(c.queryChainName || "").trim();
      const addresses = getCardQueryAddresses(c);
      return addresses
        .filter((address) => String(address || "").trim() !== "")
        .map((address) => ({ chain, address }));
    });
    const chainAddrMerged = buildChainAddr(entries);

    try {
      try {
        devLog(
          "[ActivityLog][fetchAll] POST",
          accountAPI?.queryTransaction,
          JSON.stringify({ chainAddr: chainAddrMerged, page: 1 })
        );
      } catch {}

      // Read cache (preferred for fallback use)
      const cached = await getCachedTransactions(chainAddrMerged, 1);

      // Network request (overwrite cache if successful)
      const { ok, transactions, pageSize, hasNext } =
        await fetchMergedTransactions({
          endpoint: accountAPI.queryTransaction,
          chainAddr: chainAddrMerged,
          page: 1,
        });

      const mapWithChainKey = (list) => {
        return list.map((tx) => {
          const addr = String(tx.address || tx.toAddress || tx.fromAddress || "").trim();
          const chainSym = String(tx.symbol || tx.chain || "")
            .trim()
            .toLowerCase();

          let matched =
            uniqueCryptos.find(
              (c) =>
                cardContainsAddress(c, addr) &&
                String(c.queryChainName || "")
                  .trim()
                  .toLowerCase() === chainSym
            ) || null;

          if (!matched) {
            const candidates = uniqueCryptos.filter(
              (c) => cardContainsAddress(c, addr)
            );
            if (candidates.length === 1) matched = candidates[0];
          }
          if (!matched) {
            matched = uniqueCryptos.find(
              (c) =>
                String(c.queryChainName || "")
                  .trim()
                  .toLowerCase() === chainSym
            );
          }
          const chainKey = matched
            ? `${matched.queryChainName}:${matched.address}`
            : `${chainSym}:${addr}`;

          return { ...tx, chainKey };
        });
      };

      let merged = [];

      if (ok && Array.isArray(transactions)) {
        const processed = mapWithChainKey(transactions);

        // Count the number of each chainKey to estimate whether it is finished.
        const countByKey = processed.reduce((m, tx) => {
          m[tx.chainKey] = (m[tx.chainKey] || 0) + 1;
          return m;
        }, {});

        setActivityLogPages((prev) => {
          const upd = { ...prev };
          for (const c of uniqueCryptos) {
            const key = `${c.queryChainName}:${c.address}`;
            const cnt = countByKey[key] || 0;
            upd[key] = {
              page: 1,
              finished: hasNext ? false : cnt < (pageSize || 10),
            };
          }
          return upd;
        });

        try {
          await setCachedTransactions(chainAddrMerged, 1, processed, {
            pageSize,
            hasNext,
          });
        } catch {}
        merged = processed;
      } else if (
        cached &&
        Array.isArray(cached.items) &&
        cached.items.length > 0
      ) {
        const processed = mapWithChainKey(cached.items);
        const cachedPageSize =
          (typeof cached.pageSize === "number" && cached.pageSize > 0
            ? cached.pageSize
            : 10) || 10;
        const cachedHasNext = Boolean(cached.hasNext);

        const countByKey = processed.reduce((m, tx) => {
          m[tx.chainKey] = (m[tx.chainKey] || 0) + 1;
          return m;
        }, {});

        setActivityLogPages((prev) => {
          const upd = { ...prev };
          for (const c of uniqueCryptos) {
            const key = `${c.queryChainName}:${c.address}`;
            const cnt = countByKey[key] || 0;
            upd[key] = {
              page: 1,
              finished: cachedHasNext ? false : cnt < cachedPageSize,
            };
          }
          return upd;
        });

        merged = processed;
      } else {
        setActivityLogPages((prev) => {
          const upd = { ...prev };
          for (const c of uniqueCryptos) {
            const key = `${c.queryChainName}:${c.address}`;
            upd[key] = { page: 1, finished: true };
          }
          return upd;
        });
        merged = [];
      }

      // console.log("fetchAllActivityLog: merged original data:", merged);

      // Read local history
      let localHistory = [];
      try {
        const localStr = await AsyncStorage.getItem("ActivityLog");
        if (localStr) {
          localHistory = JSON.parse(localStr);
        }
      } catch (e) {
        devWarn("Failed to read local ActivityLog:", e);
      }

      // Merge local history and newly found data, and remove duplicates by txId or id
      const all = [...merged, ...localHistory];
      // Prioritize keeping newly found ones
      const uniqueMap = new Map();
      for (const tx of all) {
        // Compatible with txId/txid
        const key = tx.txId || tx.txid || tx.tx_id || tx.id || tx.hash;
        if (key && !uniqueMap.has(key)) {
          uniqueMap.set(key, tx);
        }
      }
      const combined = Array.from(uniqueMap.values());

      // Clean and persist
      const filtered = combined.filter(
        (item) =>
          item.amount !== null &&
          item.amount !== undefined &&
          item.amount !== "0" &&
          item.amount !== "" &&
          Number(item.amount) !== 0 &&
          !isNaN(Number(item.amount)) &&
          item.state !== 0 &&
          item.state !== "0" &&
          item.state !== null &&
          item.state !== undefined
      );
      devLog("fetchAllActivityLog: filtered data:", filtered);
      await AsyncStorage.setItem("ActivityLog", JSON.stringify(filtered));
      setActivityLog(filtered);
      devLog("fetchAllActivityLog: finished fetching first page of transaction history");
    } catch (err) {
      try {
        devWarn("fetchAllActivityLog: request failed, mark all chains as finished:", err);
      } catch {}
      setActivityLogPages((prev) => {
        const upd = { ...prev };
        for (const c of uniqueCryptos) {
          const key = `${c.queryChainName}:${c.address}`;
          upd[key] = { page: 1, finished: true };
        }
        return upd;
      });
    }
  }
};

/**
  * Get the transaction history of all currencies on the next page in paging
  * @param {Object[]} addressSourceCards - runtime currency array (requires address)
  * @param {Object} activityLogPages - paging status object
  * @param {Object[]} ActivityLog - currently loaded transaction history
  * @param {Function} setActivityLog - setState of transaction history
  * @param {Function} setActivityLogPages - setState to set the paging state
  * @param {Object} accountAPI - API object, requires queryTransaction field
  * @returns {Promise<boolean>} - whether there is new data loaded
 */
export const fetchNextActivityLogPage = async ({
  addressSourceCards,
  activityLogPages,
  ActivityLog,
  setActivityLog,
  setActivityLogPages,
  accountAPI,
}) => {
  if (!addressSourceCards || addressSourceCards.length === 0)
    return false;

  devLog("fetchNextActivityLogPage: start fetching next page of transaction history");
  let anyLoaded = false;
  const uniqueCryptos = addressSourceCards.filter(
    (crypto, index, self) =>
      crypto.address &&
      crypto.address.trim() !== "" &&
      index ===
        self.findIndex(
          (c) =>
            String(c.queryChainName || "").trim().toLowerCase() ===
              String(crypto.queryChainName || "").trim().toLowerCase() &&
            normalizeAddressForComparison(c.queryChainName, c.address) ===
              normalizeAddressForComparison(
                crypto.queryChainName,
                crypto.address,
              )
        )
  );

  // Merge request: Construct multi-chain chainAddr and check the next page at a time
  const entries = uniqueCryptos.flatMap((c) => {
    const chain = String(c.queryChainName || "").trim();
    const addresses = getCardQueryAddresses(c);
    return addresses
      .filter((address) => String(address || "").trim() !== "")
      .map((address) => ({ chain, address }));
  });
  const chainAddrMerged = buildChainAddr(entries);

  // Calculate the global current page (the maximum value of each chain page number), and whether all are completed
  const pages = uniqueCryptos.map((c) => {
    const key = `${c.queryChainName}:${c.address}`;
    return Number(activityLogPages?.[key]?.page || 1);
  });
  const finishedFlags = uniqueCryptos.map((c) => {
    const key = `${c.queryChainName}:${c.address}`;
    return Boolean(activityLogPages?.[key]?.finished);
  });
  const allFinished = finishedFlags.length > 0 && finishedFlags.every(Boolean);
  if (allFinished) return false;

  const currentPage = pages.length > 0 ? Math.max(...pages) : 1;
  const nextPage = currentPage + 1;

  let newLogs = [];

  try {
    try {
      devLog(
        "[ActivityLog][fetchNext] POST",
        accountAPI?.queryTransaction,
        JSON.stringify({ chainAddr: chainAddrMerged, page: nextPage })
      );
    } catch {}

    // Read cache (next page)
    const cached = await getCachedTransactions(chainAddrMerged, nextPage);

    // network request
    const { ok, transactions, pageSize, hasNext } =
      await fetchMergedTransactions({
        endpoint: accountAPI.queryTransaction,
        chainAddr: chainAddrMerged,
        page: nextPage,
      });

    const mapWithChainKey = (list) => {
      return list.map((tx) => {
        const addr = String(tx.address || tx.toAddress || tx.fromAddress || "").trim();
        const chainSym = String(tx.symbol || tx.chain || "")
          .trim()
          .toLowerCase();

        let matched =
          uniqueCryptos.find(
            (c) =>
              cardContainsAddress(c, addr) &&
              String(c.queryChainName || "")
                .trim()
                .toLowerCase() === chainSym
          ) || null;

        if (!matched) {
          const candidates = uniqueCryptos.filter(
            (c) => cardContainsAddress(c, addr)
          );
          if (candidates.length === 1) matched = candidates[0];
        }
        if (!matched) {
          matched = uniqueCryptos.find(
            (c) =>
              String(c.queryChainName || "")
                .trim()
                .toLowerCase() === chainSym
          );
        }
        const chainKey = matched
          ? `${matched.queryChainName}:${matched.address}`
          : `${chainSym}:${addr}`;

        return { ...tx, chainKey };
      });
    };

    if (ok && Array.isArray(transactions) && transactions.length > 0) {
      anyLoaded = true;
      const processed = mapWithChainKey(transactions);

      // Count the number of each chainKey
      const countByKey = processed.reduce((m, tx) => {
        m[tx.chainKey] = (m[tx.chainKey] || 0) + 1;
        return m;
      }, {});

      setActivityLogPages((prev) => {
        const upd = { ...prev };
        for (const c of uniqueCryptos) {
          const key = `${c.queryChainName}:${c.address}`;
          const cnt = countByKey[key] || 0;
          upd[key] = {
            page: nextPage,
            finished: hasNext ? false : cnt < (pageSize || 10),
          };
        }
        return upd;
      });

      try {
        await setCachedTransactions(chainAddrMerged, nextPage, processed, {
          pageSize,
          hasNext,
        });
      } catch {}

      newLogs = processed;
    } else if (
      cached &&
      Array.isArray(cached.items) &&
      cached.items.length > 0
    ) {
      anyLoaded = true;

      const processed = mapWithChainKey(cached.items);

      const cachedPageSize =
        (typeof cached.pageSize === "number" && cached.pageSize > 0
          ? cached.pageSize
          : 10) || 10;
      const cachedHasNext = Boolean(cached.hasNext);

      const countByKey = processed.reduce((m, tx) => {
        m[tx.chainKey] = (m[tx.chainKey] || 0) + 1;
        return m;
      }, {});

      setActivityLogPages((prev) => {
        const upd = { ...prev };
        for (const c of uniqueCryptos) {
          const key = `${c.queryChainName}:${c.address}`;
          const cnt = countByKey[key] || 0;
          upd[key] = {
            page: nextPage,
            finished: cachedHasNext ? false : cnt < cachedPageSize,
          };
        }
        return upd;
      });

      newLogs = processed;
    } else {
      setActivityLogPages((prev) => {
        const upd = { ...prev };
        for (const c of uniqueCryptos) {
          const key = `${c.queryChainName}:${c.address}`;
          upd[key] = { page: nextPage, finished: true };
        }
        return upd;
      });
    }
  } catch (err) {
    setActivityLogPages((prev) => {
      const upd = { ...prev };
      for (const c of uniqueCryptos) {
        const key = `${c.queryChainName}:${c.address}`;
        upd[key] = { page: nextPage, finished: true };
      }
      return upd;
    });
  }
  if (newLogs.length > 0) {
    // Read local history
    let localHistory = [];
    try {
      const localStr = await AsyncStorage.getItem("ActivityLog");
      if (localStr) {
        localHistory = JSON.parse(localStr);
      }
    } catch (e) {
      devWarn("Failed to read local ActivityLog:", e);
    }

    // Merge local history, current ActivityLog, and newly found data, remove duplicates by txId/txid/id, and retain new data first
    const all = [...newLogs, ...ActivityLog, ...localHistory];
    const uniqueMap = new Map();
    for (const tx of all) {
      const key = tx.txId || tx.txid || tx.tx_id || tx.id || tx.hash;
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, tx);
      }
    }
    const combined = Array.from(uniqueMap.values());

    // filter function
    const filtered = combined.filter(
      (item) =>
        item.state !== 0 &&
        item.state !== "0" &&
        item.state !== null &&
        item.state !== undefined &&
        item.amount !== null &&
        item.amount !== undefined &&
        item.amount !== "0" &&
        item.amount !== "" &&
        Number(item.amount) !== 0 &&
        !isNaN(Number(item.amount))
    );

    // Persistence to AsyncStorage
    await AsyncStorage.setItem("ActivityLog", JSON.stringify(filtered));
    setActivityLog(filtered);
    devLog("fetchNextActivityLogPage: finished fetching next page of transaction history");
  }
  return anyLoaded;
};
