/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { getPubkeyStorageId } from "./pubkeyStorage";
import { RUNTIME_DEV } from "./runtimeFlags";

const BASE_PUBKEY_SYNC_REQUESTS = [
  { chain: "bitcoin", path: "m/44'/0'/0'/0/0" },
  { chain: "bitcoin", path: "m/49'/0'/0'/0/0" },
  { chain: "bitcoin", path: "m/84'/0'/0'/0/0" },
  { chain: "bitcoin", path: "m/86'/0'/0'/0/0" },
  { chain: "bitcoin_cash", path: "m/44'/145'/0'/0/0" },
  { chain: "litecoin", path: "m/44'/2'/0'/0/0" },
  { chain: "litecoin", path: "m/49'/2'/0'/0/0" },
  { chain: "litecoin", path: "m/84'/2'/0'/0/0" },
  { chain: "cosmos", path: "m/44'/118'/0'/0/0" },
  { chain: "ripple", path: "m/44'/144'/0'/0/0" },
  { chain: "celestia", path: "m/44'/118'/0'/0/0" },
  { chain: "osmosis", path: "m/44'/118'/0'/0/0" },
  { chain: "aptos", path: "m/44'/637'/0'/0'/0'" },
];

const DEV_PUBKEY_SYNC_REQUESTS = [
  { chain: "juno", path: "m/44'/118'/0'/0/0" },
];

export const getPubkeySyncRequests = (runtimeDev = RUNTIME_DEV) => {
  const requests = [...BASE_PUBKEY_SYNC_REQUESTS];
  if (runtimeDev) {
    requests.splice(11, 0, ...DEV_PUBKEY_SYNC_REQUESTS);
  }
  return requests;
};

export const getExpectedPubkeySyncKeys = (runtimeDev = RUNTIME_DEV) =>
  getPubkeySyncRequests(runtimeDev)
    .map((request) => getPubkeyStorageId(request.chain, request.path))
    .filter(Boolean);
