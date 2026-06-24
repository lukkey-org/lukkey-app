/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// utils/queryTransactions.js
import { buildChainAddrEntry } from "../config/networkUtils";

function isDisabledEndpoint(endpoint) {
  const value = String(endpoint || "").trim();
  return !value || value.includes(".example.invalid");
}

/**
  * Public: Determine whether the return is successful (compatible with code and msg)
 * @param {any} data
 * @returns {boolean}
 */
export function isCodeOk(data) {
  const codeRaw = data?.code;
  const msg = String(data?.msg || "").toLowerCase();
  return (
    codeRaw === 0 ||
    codeRaw === "0" ||
    codeRaw === 200 ||
    codeRaw === "200" ||
    msg === "success"
  );
}

/**
  * Public: Extract transaction lists from various containers
  * The new interface gives priority to data.items, and is secondly compatible with other old structures.
 * @param {any} data
 * @returns {Array<any>}
 */
export function extractTransactions(data) {
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.transactions)) return data.transactions;
  if (Array.isArray(data?.data?.transactions)) return data.data.transactions;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data)) return data;
  return [];
}

/**
  * Public: Normalized timestamp to milliseconds
  * - Numbers less than 1e12 are considered seconds, multiplied by 1000
  * - Parsable strings using Date.parse
  * - In other cases, fallback is Date.now()
 * @param {number|string|undefined|null} timeLike
 * @returns {number} ms
 */
export function normalizeTimestampMs(timeLike) {
  let txMs = Number(timeLike);
  if (!Number.isFinite(txMs)) {
    const parsed = Date.parse(String(timeLike || ""));
    return Number.isFinite(parsed) ? parsed : Date.now();
  }
  if (txMs < 1e12) return txMs * 1000; // seconds -> milliseconds
  return txMs;
}

/**
  * Public: Normalize single transaction record fields
 * - fromAddress/toAddress/txid/txFee/address/symbol/transactionTime/state
 * @param {any} tx
 * @returns {any} normalized
 */
export function normalizeTransaction(tx) {
  const fromAddress =
    tx.fromAddress || tx.from_address || tx.from || tx.sender || "";

  const toAddress =
    tx.toAddress || tx.to_address || tx.to || tx.recipient || "";

  const txid = tx.txid || tx.txId || tx.tx_id || tx.hash;
  const txFee = tx.txFee || tx.tx_fee || tx.fee;

  const timeLike =
    tx.transactionTime ?? tx.transaction_time ?? tx.time ?? tx.timestamp;

  const transactionTime = normalizeTimestampMs(timeLike);

  const address = tx.address || toAddress || fromAddress;
  const symbol = tx.symbol || tx.chain || "";

  const state = tx.state;

  return {
    ...tx,
    fromAddress,
    toAddress,
    txid,
    txFee,
    transactionTime,
    address,
    symbol,
    state,
  };
}

/**
  * Public: Construct chainAddr string
  * - Input can be "chain:address" string array, or {chain,address} object array
  * - Automatically remove duplicates, remove spaces and case specifications: chain/address are all trim()ed
 * @param {Array<string|{chain:string,address:string}>} entries
 * @returns {string} "chain:addr,chain:addr,..."
 */
export function buildChainAddr(entries) {
  const deduped = new Map();
  const pushChainAddr = (chainRaw, addressRaw) => {
    const entry = buildChainAddrEntry(chainRaw, addressRaw);
    if (!entry) return;
    const key = entry.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, entry);
  };

  for (const it of Array.isArray(entries) ? entries : []) {
    if (!it) continue;
    if (typeof it === "string") {
      const s = String(it).trim();
      if (!s) continue;
      const segments = s.split(",").map((part) => part.trim()).filter(Boolean);
      for (const segment of segments) {
        const idx = segment.indexOf(":");
        if (idx <= 0) continue;
        const chain = segment.slice(0, idx).trim();
        const address = segment.slice(idx + 1).trim();
        pushChainAddr(chain, address);
      }
      continue;
    }
    pushChainAddr(it.chain, it.address);
  }
  return Array.from(deduped.values()).join(",");
}

/**
  * Unified request for merged transaction interface (single/multi-chain available)
 * @param {Object} opts
  * @param {string} opts.endpoint - request address, such as accountAPI.queryTransaction
 * @param {string} opts.chainAddr - "chain:addr,chain:addr"
  * @param {number} [opts.page=1] - page number, starting from 1
  * @param {Object} [opts.headers] - Additional request headers
 * @returns {Promise<{ok:boolean,status:number,transactions:any[],page:number,pageSize:number,hasNext:boolean,raw:any}>}
 */
export async function fetchMergedTransactions({
  endpoint,
  chainAddr,
  page = 1,
  headers = {},
}) {
  if (isDisabledEndpoint(endpoint)) {
    return {
      ok: false,
      status: -1,
      transactions: [],
      page,
      pageSize: 10,
      hasNext: false,
      raw: null,
    };
  }

  const baseHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...headers,
  };

  let res;
  let json = null;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ chainAddr, page }),
    });
  } catch (e) {
    return {
      ok: false,
      status: -1,
      transactions: [],
      page,
      pageSize: 10,
      hasNext: false,
      raw: null,
    };
  }

  // Try to parse JSON as much as possible
  try {
    const contentType = res?.headers?.get?.("content-type") || "";
    if (contentType.includes("application/json")) {
      json = await res.json();
    } else {
      // Bottom line: try parse text as JSON
      try {
        const text = await res.text();
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
  } catch {
    json = null;
  }

  const ok = res.ok && isCodeOk(json || {});
  const txsRaw = extractTransactions(json || {});
  const transactions = Array.isArray(txsRaw)
    ? txsRaw.map((tx) => normalizeTransaction(tx))
    : [];

  const pg = Number(json?.data?.page ?? json?.page ?? page) || page;
  const pageSize = Number(json?.data?.pageSize ?? json?.pageSize ?? 10) || 10;
  const hasNext = Boolean(json?.data?.hasNext ?? json?.hasNext ?? false);

  return {
    ok,
    status: res.status,
    transactions,
    page: pg,
    pageSize,
    hasNext,
    raw: json,
  };
}
