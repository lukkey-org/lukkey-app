/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import CryptoJS from "crypto-js";
import { isBtcAddress } from "../utils/btcAddress";
import { isLtcAddress } from "../utils/ltcAddress";

// Bitcoin, Ethereum, Binance Smart Chain, Polygon, Fantom, Arbitrum, Avalanche, Huobi ECO Chain, OKX Chain, Optimism, Gnosis Chain, zkSync Era Mainnet, Linea, Mantle, Ethereum Classic, EthereumPoW, Base, Boba Network, Celo, Tron, Solana, Ripple, SUI, Aptos,Secret Network, Kasp, Kusama, Astar, Litecoin,Manta Atlantic, Manta Pacific Mainnet, Mixin Virtual Machine，Monero (XMR), Near (NEAR), Nervos (CKB), Neurai (XNA), Nexa (NEXA), OctaSpace (OCTA), Cosmos (ATOM)/Cronos (CRO)/Crypto.org (CRO)/DIS CHAIN (DIS)/Juno (JUNO), Dogecoin (DOGE), Dynex (DNX), Fetch.ai (FET), Filecoin (FIL)/Filecoin FEVM (FIL), IoTeX Network Mainnet (IOTX), Joystream (JOY), Conflux (CFX)/Conflux eSpace (CFX), Algorand (ALGO), Akash (AKT), Aurora (AURORA), Bitcoin Cash (BCH), Blast (BLAST), Celestia (TIA)
const BCH_PREFIXES = ["bitcoincash:", "bitcoin_cash:"];
const BCH_CASHADDR_BODY_RE = /^[qp][qpzry9x8gf2tvdw0s3jn54khce6mua7l]{41}$/i;
const BCH_CASHADDR_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BCH_CASHADDR_CHAR_TO_VALUE = BCH_CASHADDR_CHARSET
  .split("")
  .reduce((acc, char, idx) => {
    acc[char] = idx;
    return acc;
  }, {});
const BCH_CASHADDR_POLYMOD_GENERATORS = [
  0x98f2bc8e61n,
  0x79b76d99e2n,
  0xf33e5fb3c4n,
  0xae2eabe2a8n,
  0x1e4f43e470n,
];
const BCH_LEGACY_TO_CASH_VERSION = {
  0x00: 0x00, // P2PKH -> type=0, size=0
  0x05: 0x08, // P2SH -> type=1, size=0
};
const BCH_CASH_TO_LEGACY_VERSION = Object.entries(BCH_LEGACY_TO_CASH_VERSION).reduce(
  (acc, [legacyVersion, cashVersion]) => {
    acc[cashVersion] = Number(legacyVersion);
    return acc;
  },
  {},
);
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_CHAR_TO_INDEX = BASE58_ALPHABET.split("").reduce((acc, char, idx) => {
  acc[char] = idx;
  return acc;
}, {});
const BCH_CHAIN_NAMES = new Set([
  "bch",
  "bitcoin_cash",
  "bitcoincash",
  "bitcoin cash",
]);
export const BCH_ADDRESS_TYPES = {
  CASHADDR: "cashaddr",
  LEGACY: "legacy",
};

const bytesToHex = (bytes) =>
  Array.from(bytes || [], (value) => value.toString(16).padStart(2, "0")).join("");

const hexToBytes = (hex) => {
  const normalized = String(hex || "").trim();
  if (!normalized || normalized.length % 2 !== 0) return [];
  const out = [];
  for (let i = 0; i < normalized.length; i += 2) {
    out.push(parseInt(normalized.slice(i, i + 2), 16));
  }
  return out;
};

const decodeBase58 = (input) => {
  const normalized = normalizeAddressInput(input);
  if (!normalized) return null;

  const bytes = [0];

  for (const char of normalized) {
    const value = BASE58_CHAR_TO_INDEX[char];
    if (value == null) return null;

    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] *= 58;
    }
    bytes[0] += value;

    let carry = 0;
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] += carry;
      carry = bytes[i] >> 8;
      bytes[i] &= 0xff;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (let i = 0; i < normalized.length && normalized[i] === "1"; i += 1) {
    bytes.push(0);
  }

  return Uint8Array.from(bytes.reverse());
};

const encodeBase58 = (bytesInput) => {
  const bytes = Array.from(bytesInput || []);
  if (bytes.length === 0) return "";

  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      const value = digits[i] * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  for (let i = 0; i < bytes.length && bytes[i] === 0; i += 1) {
    digits.push(0);
  }

  return digits.reverse().map((digit) => BASE58_ALPHABET[digit]).join("");
};

const isValidBase58Check = (decodedBytes) => {
  if (!decodedBytes || decodedBytes.length < 5) return false;

  const payload = decodedBytes.slice(0, -4);
  const checksum = decodedBytes.slice(-4);
  const payloadWordArray = CryptoJS.lib.WordArray.create(payload);
  const expectedChecksumHex = CryptoJS.SHA256(CryptoJS.SHA256(payloadWordArray))
    .toString(CryptoJS.enc.Hex)
    .slice(0, 8)
    .toLowerCase();

  return bytesToHex(checksum).toLowerCase() === expectedChecksumHex;
};

const convertBits = (data, fromBits, toBits, pad = true) => {
  let accumulator = 0;
  let bitCount = 0;
  const result = [];
  const maxValue = (1 << toBits) - 1;

  for (const value of data) {
    if (value < 0 || value >> fromBits) return null;
    accumulator = (accumulator << fromBits) | value;
    bitCount += fromBits;

    while (bitCount >= toBits) {
      bitCount -= toBits;
      result.push((accumulator >> bitCount) & maxValue);
    }
  }

  if (pad) {
    if (bitCount > 0) {
      result.push((accumulator << (toBits - bitCount)) & maxValue);
    }
    return result;
  }

  if (bitCount >= fromBits) return null;
  if (((accumulator << (toBits - bitCount)) & maxValue) !== 0) return null;
  return result;
};

const cashaddrExpandPrefix = (prefix) => [
  ...Array.from(prefix).map((char) => char.charCodeAt(0) & 0x1f),
  0,
];

const cashaddrPolymod = (values) => {
  let checksum = 1n;

  for (const value of values) {
    const high = checksum >> 35n;
    checksum = ((checksum & 0x07ffffffffn) << 5n) ^ BigInt(value);

    for (let i = 0; i < 5; i += 1) {
      if (((high >> BigInt(i)) & 1n) === 1n) {
        checksum ^= BCH_CASHADDR_POLYMOD_GENERATORS[i];
      }
    }
  }

  return checksum ^ 1n;
};

const cashaddrCreateChecksum = (prefix, payloadWords) => {
  const values = [...cashaddrExpandPrefix(prefix), ...payloadWords, ...new Array(8).fill(0)];
  const polymod = cashaddrPolymod(values);

  return Array.from({ length: 8 }, (_, index) =>
    Number((polymod >> BigInt(5 * (7 - index))) & 31n),
  );
};

const encodeCashaddr = (prefix, payloadWords) => {
  const checksumWords = cashaddrCreateChecksum(prefix, payloadWords);
  const combined = [...payloadWords, ...checksumWords];
  const encoded = combined.map((word) => BCH_CASHADDR_CHARSET[word]).join("");
  return `${prefix}:${encoded}`;
};

const cashaddrVerifyChecksum = (prefix, payloadAndChecksumWords) => {
  const values = [...cashaddrExpandPrefix(prefix), ...payloadAndChecksumWords];
  return cashaddrPolymod(values) === 0n;
};

const parseBchCashaddr = (address) => {
  const normalizedAddress = normalizeAddressInput(address);
  if (!normalizedAddress) return null;
  if (
    normalizedAddress !== normalizedAddress.toLowerCase() &&
    normalizedAddress !== normalizedAddress.toUpperCase()
  ) {
    return null; // mixed case is invalid
  }

  const lowerAddress = normalizedAddress.toLowerCase();
  const parts = lowerAddress.includes(":")
    ? lowerAddress.split(":")
    : ["bitcoincash", lowerAddress];
  if (parts.length !== 2) return null;

  const [prefix, body] = parts;
  if (!prefix || !body || body.length < 8) return null;

  const words = [];
  for (const char of body) {
    const value = BCH_CASHADDR_CHAR_TO_VALUE[char];
    if (value == null) return null;
    words.push(value);
  }
  if (!cashaddrVerifyChecksum(prefix, words)) return null;

  return {
    prefix,
    payloadWords: words.slice(0, -8),
  };
};

export const normalizeAddressInput = (address) => String(address || "").trim();

export const isBchChainName = (chainName) => {
  const normalized = String(chainName || "")
    .trim()
    .toLowerCase();
  return BCH_CHAIN_NAMES.has(normalized);
};

export const normalizeBchAddressType = (type) => {
  const normalized = String(type || "")
    .trim()
    .toLowerCase();
  return normalized === BCH_ADDRESS_TYPES.LEGACY
    ? BCH_ADDRESS_TYPES.LEGACY
    : BCH_ADDRESS_TYPES.CASHADDR;
};

export const stripBchPrefix = (address) => {
  const normalizedAddress = normalizeAddressInput(address);
  const lowerAddress = normalizedAddress.toLowerCase();
  const matchedPrefix = BCH_PREFIXES.find((prefix) =>
    lowerAddress.startsWith(prefix),
  );

  if (!matchedPrefix) {
    return normalizedAddress;
  }

  return normalizedAddress.slice(matchedPrefix.length);
};

export const isBchCashAddr = (address) => {
  const normalizedAddress = normalizeAddressInput(address);
  if (!normalizedAddress) return false;
  return BCH_CASHADDR_BODY_RE.test(stripBchPrefix(normalizedAddress));
};

export const isBchLegacyAddress = (address) => {
  const normalizedAddress = normalizeAddressInput(address);
  if (!normalizedAddress || normalizedAddress.includes(":")) return false;
  const decoded = decodeBase58(normalizedAddress);
  if (!decoded || decoded.length !== 25 || !isValidBase58Check(decoded)) return false;
  const payload = decoded.slice(0, -4);
  const legacyVersion = payload?.[0];
  return Object.prototype.hasOwnProperty.call(BCH_LEGACY_TO_CASH_VERSION, legacyVersion);
};

export const normalizeAddressForChain = (chainName, address) => {
  const normalizedAddress = normalizeAddressInput(address);
  const normalizedChain = String(chainName || "").trim().toLowerCase();

  if (
    isBchChainName(normalizedChain) ||
    isBchCashAddr(normalizedAddress)
  ) {
    return stripBchPrefix(normalizedAddress);
  }

  return normalizedAddress;
};

export const canonicalizeAddressForTransport = (chainName, address) => {
  const normalizedAddress = normalizeAddressInput(address);
  const normalizedChain = String(chainName || "").trim().toLowerCase();

  if (
    isBchChainName(normalizedChain) ||
    isBchCashAddr(normalizedAddress)
  ) {
    const body = stripBchPrefix(normalizedAddress);
    return body ? `bitcoincash:${body}` : normalizedAddress;
  }

  return normalizedAddress;
};

export const buildChainAddrEntry = (chainName, address) => {
  const chain = String(chainName || "")
    .trim()
    .toLowerCase();
  const normalizedAddress = normalizeAddressInput(address);
  if (!chain || !normalizedAddress) return "";

  if (isBchChainName(chain) && isBchCashAddr(normalizedAddress)) {
    return `bitcoincash:${stripBchPrefix(normalizedAddress)}`;
  }

  return `${chain}:${normalizedAddress}`;
};

export const convertBchLegacyToCashAddr = (address) => {
  const normalizedAddress = normalizeAddressInput(address);
  if (!normalizedAddress || normalizedAddress.includes(":")) return "";

  const decoded = decodeBase58(normalizedAddress);
  if (!decoded || decoded.length !== 25 || !isValidBase58Check(decoded)) return "";

  const payload = decoded.slice(0, -4);
  const legacyVersion = payload[0];
  const cashVersion = BCH_LEGACY_TO_CASH_VERSION[legacyVersion];
  if (cashVersion == null) return "";

  const hash160 = Array.from(payload.slice(1));
  if (hash160.length !== 20) return "";

  const payloadWords = convertBits([cashVersion, ...hash160], 8, 5, true);
  if (!payloadWords) return "";

  return encodeCashaddr("bitcoincash", payloadWords);
};

export const convertBchCashAddrToLegacy = (address) => {
  const parsed = parseBchCashaddr(address);
  if (!parsed || !Array.isArray(parsed.payloadWords) || parsed.payloadWords.length === 0) {
    return "";
  }

  const payloadBytes = convertBits(parsed.payloadWords, 5, 8, false);
  if (!payloadBytes || payloadBytes.length !== 21) return "";

  const cashVersion = payloadBytes[0];
  const legacyVersion = BCH_CASH_TO_LEGACY_VERSION[cashVersion];
  if (legacyVersion == null) return "";

  const payload = Uint8Array.from([legacyVersion, ...payloadBytes.slice(1)]);
  const payloadWordArray = CryptoJS.lib.WordArray.create(payload);
  const checksumHex = CryptoJS.SHA256(CryptoJS.SHA256(payloadWordArray))
    .toString(CryptoJS.enc.Hex)
    .slice(0, 8);
  const checksumBytes = hexToBytes(checksumHex);
  const fullBytes = Uint8Array.from([...payload, ...checksumBytes]);
  return encodeBase58(fullBytes);
};

export const deriveBchAddressFormats = (address) => {
  const normalizedAddress = normalizeAddressInput(address);
  if (!normalizedAddress) {
    return { cashaddr: "", legacy: "" };
  }

  if (isBchCashAddr(normalizedAddress)) {
    const body = stripBchPrefix(normalizedAddress);
    const cashaddr = body || "";
    const legacy = convertBchCashAddrToLegacy(cashaddr);
    return { cashaddr, legacy };
  }

  if (isBchLegacyAddress(normalizedAddress)) {
    const legacy = normalizedAddress;
    const cashaddr = stripBchPrefix(convertBchLegacyToCashAddr(legacy));
    return { cashaddr, legacy };
  }

  return { cashaddr: "", legacy: "" };
};

export const resolveBchAddressByType = (
  targetType,
  address,
  cashAddrHint = "",
  legacyHint = "",
) => {
  const nextType = normalizeBchAddressType(targetType);
  const fromAddress = deriveBchAddressFormats(address);
  const fromCashHint = deriveBchAddressFormats(cashAddrHint);
  const fromLegacyHint = deriveBchAddressFormats(legacyHint);
  const cashaddr =
    fromAddress.cashaddr ||
    fromCashHint.cashaddr ||
    fromLegacyHint.cashaddr ||
    (isBchCashAddr(cashAddrHint) ? stripBchPrefix(cashAddrHint) : "");
  const legacy =
    fromAddress.legacy ||
    fromCashHint.legacy ||
    fromLegacyHint.legacy ||
    normalizeAddressInput(legacyHint);

  if (nextType === BCH_ADDRESS_TYPES.LEGACY) {
    return legacy || cashaddr || normalizeAddressInput(address);
  }
  return cashaddr || legacy || normalizeAddressInput(address);
};

export const normalizeAddressForComparison = (chainName, address) => {
  const normalizedAddress = normalizeAddressInput(address);
  if (!normalizedAddress) return "";

  const isBchContext = isBchChainName(chainName) || isBchCashAddr(normalizedAddress);
  if (isBchContext) {
    const { cashaddr, legacy } = deriveBchAddressFormats(normalizedAddress);
    if (cashaddr) {
      return `bch:${stripBchPrefix(cashaddr).toLowerCase()}`;
    }
    if (legacy) {
      return `bch:legacy:${legacy.toLowerCase()}`;
    }
    return `bch:${stripBchPrefix(normalizedAddress).toLowerCase()}`;
  }

  if (normalizedAddress.startsWith("0x") || normalizedAddress.startsWith("0X")) {
    return normalizedAddress.toLowerCase();
  }
  return normalizedAddress.toLowerCase();
};

export const areAddressesEquivalent = (chainName, leftAddress, rightAddress) => {
  const left = normalizeAddressForComparison(chainName, leftAddress);
  const right = normalizeAddressForComparison(chainName, rightAddress);
  if (!left || !right) return false;
  return left === right;
};

export const detectNetwork = (address, preferredChain = "") => {
  const normalizedAddress = normalizeAddressInput(address);
  const preferred = String(preferredChain || "")
    .trim()
    .toLowerCase();

  if (
    isBchChainName(preferred) &&
    (isBchCashAddr(normalizedAddress) || isBchLegacyAddress(normalizedAddress))
  ) {
    return "Bitcoin Cash (BCH)";
  }

  if (
    (preferred === "ltc" || preferred === "litecoin") &&
    isLtcAddress(normalizedAddress)
  ) {
    return "Litecoin (LTC)";
  }

  // Bitcoin
  if (isBtcAddress(normalizedAddress)) {
    return "Bitcoin (BTC)";
  }

  // Ethereum, Binance Smart Chain, Polygon, Fantom, Arbitrum, Avalanche, Huobi ECO Chain, Optimism, Gnosis Chain, zkSync Era Mainnet, Linea, Mantle, Ethereum Classic, EthereumPoW, Base, Boba Network, Celo
  else if (/^0x[a-fA-F0-9]{40}$/.test(normalizedAddress)) {
    return "Ethereum (ETH)/Binance (BNB)/Polygon (POL)/Fantom (FTM)/Arbitrum (ARB)/Avalanche (AVAX)/Huobi ECO Chain (HECO)/Optimism (OP)/Gnosis Chain (xDAI)/zkSync Era Mainnet (zkSync)/Linea (Linea)/Mantle (Mantle)/Ethereum Classic (ETC)/EthereumPoW (ETHW)/Base (BASE)/Boba Network (BOBA)/Celo (CELO)";
  }

  // Tron
  else if (/^T[A-Za-z1-9]{33}$/.test(normalizedAddress)) {
    return "Tron (TRX)";
  }

  // Bitcoin Cash
  else if (
    isBchCashAddr(normalizedAddress) ||
    isBchLegacyAddress(normalizedAddress)
  ) {
    return "Bitcoin Cash (BCH)";
  }

  // Ripple
  else if (/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(normalizedAddress)) {
    return "Ripple (XRP)";
  }

  // SUI, Aptos
  else if (/^0x[0-9a-fA-F]{64}$/.test(normalizedAddress)) {
    return "SUI (SUI)/Aptos (APT)";
  }

  // Secret Network
  else if (/^secret1[0-9a-z]{38}$/.test(normalizedAddress)) {
    return "Secret Network (SCRT)";
  }

  // Kaspa
  else if (/^kaspa:[a-zA-Z0-9]{50}$/.test(normalizedAddress)) {
    return "Kaspa (KAS)";
  }

  // Kusama, Astar
  else if (/^[C-FH-NP-TV-Z1-9]{47,48}$/.test(normalizedAddress)) {
    return "Kusama (KSM)/Astar (ASTR)";
  }

  // Litecoin
  else if (isLtcAddress(normalizedAddress)) {
    return "Litecoin (LTC)";
  }

  // Solana
  // Must be checked after Litecoin because many Base58 strings overlap, and
  // legacy/mainnet LTC addresses like "M..." would otherwise be misclassified.
  else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(normalizedAddress)) {
    return "Solana (SOL)";
  }

  // Manta Atlantic, Manta Pacific Mainnet
  else if (/^[a-zA-Z0-9]{47,48}$/.test(normalizedAddress)) {
    return "Manta Atlantic (Manta)/Manta Pacific Mainnet (Manta)";
  }

  // Mixin Virtual Machine
  else if (/^MV[a-zA-Z0-9]{42}$/.test(normalizedAddress)) {
    return "Mixin Virtual Machine (MVM)";
  }

  // Monero
  else if (/^[48][0-9AB][a-zA-Z0-9]{93}$/.test(normalizedAddress)) {
    return "Monero (XMR)";
  }

  // Near
  else if (/^[a-z0-9._-]{5,32}\.near$/.test(normalizedAddress)) {
    return "Near (NEAR)";
  }

  // Nervos
  else if (/^ckb1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{42}$/.test(normalizedAddress)) {
    return "Nervos (CKB)";
  }

  // Neurai
  else if (/^N[A-Za-z0-9]{33}$/.test(normalizedAddress)) {
    return "Neurai (XNA)";
  }

  // Nexa
  else if (/^nexa:[a-zA-Z0-9]{42}$/.test(normalizedAddress)) {
    return "Nexa (NEXA)";
  }

  // OctaSpace
  else if (/^os[a-zA-Z0-9]{42}$/.test(normalizedAddress)) {
    return "OctaSpace (OCTA)";
  }

  // Cosmos, Cronos, Crypto.org, DIS CHAIN, Juno
  else if (
    /^(cosmos1|cro1|dis1|juno1)[a-zA-Z0-9]{38}$/.test(normalizedAddress)
  ) {
    return "Cosmos (ATOM)/Cronos (CRO)/Crypto.org (CRO)/DIS CHAIN (DIS)/Juno (JUNO)";
  }

  // Dogecoin
  else if (
    /^D{1}[5-9A-HJ-NP-U]{1}[1-9A-HJ-NP-Za-km-z]{32}$/.test(normalizedAddress)
  ) {
    return "Dogecoin (DOGE)";
  }

  // Dynex
  else if (/^dynex:[a-zA-Z0-9]{42}$/.test(normalizedAddress)) {
    return "Dynex (DNX)";
  }

  // Fetch.ai
  else if (/^fetch1[a-zA-Z0-9]{38}$/.test(normalizedAddress)) {
    return "Fetch.ai (FET)";
  }

  // Filecoin, Filecoin FEVM
  else if (/^f[a-zA-Z0-9]{41}$/.test(normalizedAddress)) {
    return "Filecoin (FIL)/Filecoin FEVM (FIL)";
  }

  // IoTeX Network Mainnet
  else if (/^io1[a-zA-Z0-9]{38}$/.test(normalizedAddress)) {
    return "IoTeX Network Mainnet (IOTX)";
  }

  // Joystream
  else if (/^5[a-zA-Z0-9]{47}$/.test(normalizedAddress)) {
    return "Joystream (JOY)";
  }

  // Conflux, Conflux eSpace
  else if (/^cfx[a-zA-Z0-9]{42}$/.test(normalizedAddress)) {
    return "Conflux (CFX)/Conflux eSpace (CFX)";
  }

  // Algorand
  else if (/^algo1[a-zA-Z0-9]{58}$/.test(normalizedAddress)) {
    return "Algorand (ALGO)";
  }

  // Akash
  else if (/^akash1[a-zA-Z0-9]{38}$/.test(normalizedAddress)) {
    return "Akash (AKT)";
  }

  // Aurora
  else if (/^aurora[a-zA-Z0-9]{38}$/.test(normalizedAddress)) {
    return "Aurora (AURORA)";
  }

  // Blast
  else if (/^blast[a-zA-Z0-9]{38}$/.test(normalizedAddress)) {
    return "Blast (BLAST)";
  }

  // Celestia
  else if (/^celestia1[a-zA-Z0-9]{38}$/.test(normalizedAddress)) {
    return "Celestia (TIA)";
  }

  // Lightning Network
  else if (/^lnbc[a-zA-Z0-9]{30,80}$/.test(normalizedAddress)) {
    return "Lightning Network (LN)";
  } // Invalid address
  else if (
    /[^a-zA-Z0-9]/.test(normalizedAddress) ||
    normalizedAddress.length < 26 ||
    normalizedAddress.length > 90
  ) {
    return "Invalid address";
  }

  // Unknown Network
  else {
    return "Unknown Network";
  }
};
