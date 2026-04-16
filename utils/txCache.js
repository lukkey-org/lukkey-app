/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// utils/txCache.js
// Local cache of transaction history: used to reduce the frequency and cost of on-chain queries

import AsyncStorage from "@react-native-async-storage/async-storage";

/**
  * Generate cache key
  * Format: TX_CACHE_v1:<encode(chainAddr)>:page=<page>
 */
function cacheKey(chainAddr, page) {
  const enc = encodeURIComponent(String(chainAddr || "").trim());
  const p = Number(page) || 1;
  return `TX_CACHE_v1:${enc}:page=${p}`;
}

/**
  * write cache
  * @param {string} chainAddr is in the form of "chain:addr,chain:addr"
  * @param {number} page page number, starting from 1
  * @param {Array<any>} items Normalized transaction array (recommended to be the result of normalizeTransaction)
  * @param {Object} meta additional metadata (optional): { pageSize?: number, hasNext?: boolean }
 */
export async function setCachedTransactions(chainAddr, page, items, meta = {}) {
  try {
    const key = cacheKey(chainAddr, page);
    const payload = {
      items: Array.isArray(items) ? items : [],
      pageSize:
        typeof meta.pageSize === "number" && meta.pageSize > 0
          ? meta.pageSize
          : undefined,
      hasNext: typeof meta.hasNext === "boolean" ? meta.hasNext : undefined,
      savedAt: Date.now(),
      version: 1,
      chainAddr: String(chainAddr || ""),
      page: Number(page) || 1,
    };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    // Ignore cache failure
  }
}

/**
  * read cache
 * @param {string} chainAddr
 * @param {number} page
  * @param {number} maxAgeMs Maximum cache duration allowed (milliseconds), default 5 minutes
 * @returns {Promise<{items:any[], pageSize?:number, hasNext?:boolean, savedAt:number} | null>}
 */
export async function getCachedTransactions(
  chainAddr,
  page,
  maxAgeMs = 5 * 60 * 1000
) {
  try {
    const key = cacheKey(chainAddr, page);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const data = JSON.parse(raw);
    const savedAt = Number(data?.savedAt || 0);
    const age = Date.now() - savedAt;

    if (Number.isFinite(maxAgeMs) && maxAgeMs >= 0) {
      if (!Number.isFinite(savedAt) || savedAt <= 0) return null;
      if (age > maxAgeMs) return null; // Expired
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    return {
      items,
      pageSize:
        typeof data?.pageSize === "number" && data.pageSize > 0
          ? data.pageSize
          : undefined,
      hasNext: typeof data?.hasNext === "boolean" ? data.hasNext : undefined,
      savedAt,
    };
  } catch (e) {
    return null;
  }
}

/**
  * Clear cache for an address/page (optional tool)
 * @param {string} chainAddr
 * @param {number} page
 */
export async function clearCachedTransactions(chainAddr, page) {
  try {
    const key = cacheKey(chainAddr, page);
    await AsyncStorage.removeItem(key);
  } catch {}
}

/**
  * Force reads from cache of any age (ignoring expiration)
 * @param {string} chainAddr
 * @param {number} page
 */
export async function getCachedTransactionsAllowStale(chainAddr, page) {
  return getCachedTransactions(chainAddr, page, Infinity);
}
