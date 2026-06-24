/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { buildHmacHeaders, pathFromUrl } from "./hmac";
import { CHAIN_HOST } from "../env/chainConfig";

function headersToObject(h) {
  const out = {};
  if (!h) return out;

  if (typeof h.forEach === "function" && typeof h.append === "function") {
    try {
      h.forEach((v, k) => {
        out[k] = v;
      });
      return out;
    } catch {}
  }

  if (Array.isArray(h)) {
    for (const pair of h) {
      if (!pair) continue;
      if (Array.isArray(pair) && pair.length >= 2) {
        out[String(pair[0])] = String(pair[1]);
      }
    }
    return out;
  }

  if (typeof h === "object") {
    return { ...h };
  }

  return out;
}

function isTargetHost(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.host === CHAIN_HOST;
  } catch {
    return typeof urlStr === "string" && urlStr.includes(CHAIN_HOST);
  }
}

function ensurePost(method) {
  return String(method || "GET").toUpperCase() === "POST";
}

const originalFetch = global.fetch;

if (typeof originalFetch === "function" && !global.__FETCH_HMAC_PATCHED__) {
  global.fetch = async (input, initArg) => {
    try {
      let urlStr = "";
      let method = "GET";
      let headers;
      let body;

      if (typeof input === "string") {
        urlStr = input;
      } else if (input && typeof input === "object") {
        urlStr = input.url || "";
        method = input.method || method;
        headers = input.headers || headers;
        try {
          if (initArg?.body !== undefined) {
            body = initArg.body;
          } else if (input.body !== undefined) {
            body = input.body;
          }
        } catch {}
      }

      if (initArg?.method) method = initArg.method;
      if (initArg?.headers) headers = initArg.headers;

      const shouldSign =
        isTargetHost(urlStr) && ensurePost(method || (input && input.method));

      if (!shouldSign) {
        return originalFetch(input, initArg);
      }

      const hmacHeaders = buildHmacHeaders(pathFromUrl(urlStr));
      if (!hmacHeaders["x-ca-key"] || !hmacHeaders["x-ca-signature"]) {
        return originalFetch(input, initArg);
      }

      const existing = headersToObject(headers);
      const finalInit = {
        ...(initArg || {}),
        method: "POST",
        headers: {
          ...existing,
          ...hmacHeaders,
        },
      };

      if (body !== undefined && finalInit.body === undefined) {
        finalInit.body = body;
      }

      return originalFetch(typeof input === "string" ? urlStr : urlStr, finalInit);
    } catch {
      return originalFetch(input, initArg);
    }
  };

  global.__FETCH_HMAC_PATCHED__ = true;
}
