/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { Buffer } from "buffer";

export const bleCmd = {
  sign: (chain, path, data, addrFormat = "") =>
    JSON.stringify({
      cmd: "sign",
      chain,
      path,
      data,
      addr_format: String(addrFormat || ""),
    }),
  verify: (chain, accountId, addrFormat = "") =>
    JSON.stringify({
      cmd: "verify",
      chain,
      addr_format: String(addrFormat || ""),
      ...(accountId ? { accountId } : {}),
    }),
  address: (chain, addrFormat = "") =>
    JSON.stringify({
      cmd: "address",
      chain,
      addr_format: String(addrFormat || ""),
    }),
  destAddr: (sender, receiver, fee, chain, accountId, addrFormat = "") =>
    JSON.stringify({
      cmd: "destAddr",
      ...(accountId ? { accountId } : {}),
      sender,
      receiver,
      fee,
      chain,
      addr_format: String(addrFormat || ""),
    }),
  pubkey: (chain, path) => JSON.stringify({ cmd: "pubkey", chain, path }),
  accountId: (id) => JSON.stringify({ cmd: "accountId", id }),
  validation: () => JSON.stringify({ cmd: "validation" }),
  pinOk: () => JSON.stringify({ cmd: "pinOk" }),
  pinFail: () => JSON.stringify({ cmd: "pinFail" }),
  bcastOk: () => JSON.stringify({ cmd: "bcastOk" }),
  bcastFail: () => JSON.stringify({ cmd: "bcastFail" }),
  screen: () => JSON.stringify({ cmd: "screen" }),
  reqNftCollect: (accountId) =>
    JSON.stringify({ cmd: "reqNftCollect", ...(accountId ? { accountId } : {}) }),
  accountName: () => JSON.stringify({ cmd: "accountName" }),
  authRequest: () => JSON.stringify({ cmd: "authRequest" }),
  authVerify: (id) => JSON.stringify({ cmd: "authVerify", id }),
  version: () => JSON.stringify({ cmd: "version" }),
  otaStart: (name, size, md5) => JSON.stringify({ cmd: "otaStart", name, size, md5 }),
  otaReboot: () => JSON.stringify({ cmd: "otaReboot" }),
  nftText: (size) => JSON.stringify({ cmd: "nftText", size }),
  nftImg: (size) => JSON.stringify({ cmd: "nftImg", size }),
};

export function parseResp(raw) {
  if (!raw) return null;
  const trimmed = raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (obj.resp || obj.cmd) return obj;
    return null;
  } catch {
    return null;
  }
}

export function frameBle(jsonStr) {
  return Buffer.from(jsonStr + "\r\n", "utf-8").toString("base64");
}

export function buildFrame(cmdFn, ...args) {
  return frameBle(cmdFn(...args));
}

export function buildAuthVerifyText(id) {
  return bleCmd.authVerify(id) + "\r\n";
}
