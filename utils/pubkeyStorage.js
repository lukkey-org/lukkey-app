/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { deleteSecureItems, getSecureItem, setSecureItem } from "./secureStorage";

export const PUBKEY_CHAINS = [
  "bitcoin_legacy",
  "bitcoin_nested_segwit",
  "bitcoin_native_segwit",
  "bitcoin_taproot",
  "bitcoin_cash",
  "litecoin_legacy",
  "litecoin_nested_segwit",
  "litecoin_native_segwit",
  "litecoin",
  "cosmos",
  "ripple",
  "celestia",
  // "juno", // Hidden for now
  "osmosis",
  "aptos",
];

export const normalizePubkeyChain = (chain) =>
  String(chain || "").trim().toLowerCase();

export const getPubkeyStorageId = (chain, path = "") => {
  const normalizedChain = normalizePubkeyChain(chain);
  const normalizedPath = String(path || "").trim();
  if (!normalizedChain) return "";

  if (normalizedChain === "bitcoin") {
    switch (normalizedPath) {
      case "m/44'/0'/0'/0/0":
        return "bitcoin_legacy";
      case "m/49'/0'/0'/0/0":
        return "bitcoin_nested_segwit";
      case "m/84'/0'/0'/0/0":
        return "bitcoin_native_segwit";
      case "m/86'/0'/0'/0/0":
        return "bitcoin_taproot";
      default:
        return normalizedChain;
    }
  }

  if (normalizedChain === "litecoin") {
    switch (normalizedPath) {
      case "m/44'/2'/0'/0/0":
        return "litecoin_legacy";
      case "m/49'/2'/0'/0/0":
        return "litecoin_nested_segwit";
      case "m/84'/2'/0'/0/0":
        return "litecoin_native_segwit";
      default:
        return normalizedChain;
    }
  }

  return normalizedChain;
};

export const getPubkeyStorageKey = (chain) =>
  `pubkey_${normalizePubkeyChain(chain)}`;

export const getPubkeyPathStorageKey = (chain) =>
  `pubkeyPath_${normalizePubkeyChain(chain)}`;

export async function getStoredPubkey(chain, path = "") {
  const storageId = getPubkeyStorageId(chain, path);
  if (!storageId) return "";
  const legacyKeys =
    storageId === "litecoin_nested_segwit"
      ? [getPubkeyStorageKey("litecoin")]
      : [];
  return (
    (await getSecureItem(getPubkeyStorageKey(storageId), [
      getPubkeyStorageKey(storageId),
      ...legacyKeys,
    ])) ?? ""
  );
}

export async function setStoredPubkey(chain, publicKey, path = "") {
  const storageId = getPubkeyStorageId(chain, path);
  if (!storageId) return;
  await setSecureItem(getPubkeyStorageKey(storageId), publicKey, [
    getPubkeyStorageKey(storageId),
  ]);
  if (path) {
    await setSecureItem(getPubkeyPathStorageKey(storageId), path, [
      getPubkeyPathStorageKey(storageId),
    ]);
  } else {
    await setSecureItem(getPubkeyPathStorageKey(storageId), "", [
      getPubkeyPathStorageKey(storageId),
    ]);
  }
}

export async function deleteAllStoredPubkeys(chains = PUBKEY_CHAINS) {
  const entries = [];
  for (const chain of chains) {
    const normalizedChain = normalizePubkeyChain(chain);
    if (!normalizedChain) continue;
    entries.push(getPubkeyStorageKey(normalizedChain));
    entries.push(getPubkeyPathStorageKey(normalizedChain));
  }
  await deleteSecureItems(entries);
}
