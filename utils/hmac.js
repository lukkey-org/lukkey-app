/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import CryptoJS from "crypto-js";
import { APP_KEY, APP_SECRET } from "../env/chainAuth";

export { APP_KEY, APP_SECRET };

function getRandomBytes(n) {
  try {
    if (global.crypto && typeof global.crypto.getRandomValues === "function") {
      const arr = new Uint8Array(n);
      global.crypto.getRandomValues(arr);
      return Array.from(arr);
    }
  } catch {}

  const out = [];
  for (let i = 0; i < n; i += 1) out.push(Math.floor(Math.random() * 256));
  return out;
}

function randomUUID() {
  const bytes = getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = (b) => b.toString(16).padStart(2, "0");
  const joined = bytes.map(hex).join("");
  return (
    joined.slice(0, 8) +
    "-" +
    joined.slice(8, 12) +
    "-" +
    joined.slice(12, 16) +
    "-" +
    joined.slice(16, 20) +
    "-" +
    joined.slice(20, 32)
  );
}

export function buildHmacHeaders(path) {
  if (!APP_KEY || !APP_SECRET) {
    return {};
  }

  const method = "POST";
  const accept = "application/json";
  const contentType = "application/json";
  const nonce = randomUUID();
  const timestamp = Date.now().toString();

  const headersString =
    "x-ca-key:" +
    APP_KEY +
    "\n" +
    "x-ca-nonce:" +
    nonce +
    "\n" +
    "x-ca-timestamp:" +
    timestamp +
    "\n";

  const stringToSign =
    method +
    "\n" +
    accept +
    "\n\n" +
    contentType +
    "\n\n" +
    headersString +
    path;

  const signature = CryptoJS.HmacSHA256(stringToSign, APP_SECRET);
  const signatureBase64 = CryptoJS.enc.Base64.stringify(signature);

  return {
    Accept: accept,
    "Content-Type": contentType,
    "x-ca-key": APP_KEY,
    "x-ca-nonce": nonce,
    "x-ca-timestamp": timestamp,
    "x-ca-signature-method": "HmacSHA256",
    "x-ca-signature-headers": "x-ca-key,x-ca-nonce,x-ca-timestamp",
    "x-ca-signature": signatureBase64,
  };
}

export function pathFromUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname || "/";
  } catch {
    if (typeof url === "string") {
      const idx = url.indexOf("://");
      if (idx > 0) {
        const p = url.slice(url.indexOf("/", idx + 3));
        return p || "/";
      }
      return url.startsWith("/") ? url : "/" + url;
    }
    return "/";
  }
}
