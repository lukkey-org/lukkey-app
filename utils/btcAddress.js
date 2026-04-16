/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { Buffer } from "buffer";
import CryptoJS from "crypto-js";

export const BTC_ADDRESS_TYPES = {
  LEGACY: "legacy",
  NESTED_SEGWIT: "nested_segwit",
  NATIVE_SEGWIT: "native_segwit",
  TAPROOT: "taproot",
};

const BTC_CHAIN_NAMES = new Set(["btc", "bitcoin"]);
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_CHAR_TO_INDEX = BASE58_ALPHABET.split("").reduce((acc, char, idx) => {
  acc[char] = idx;
  return acc;
}, {});
const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_GENERATORS = [
  0x3b6a57b2,
  0x26508e6d,
  0x1ea119fa,
  0x3d4233dd,
  0x2a1462b3,
];
const SECP256K1_P = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F",
);
const SECP256K1_N = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);
const SECP256K1_G = {
  x: BigInt(
    "0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798",
  ),
  y: BigInt(
    "0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8",
  ),
};

const normalizeAddressInput = (address) => String(address || "").trim();

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

const wordArrayToBytes = (wordArray) => {
  const hex = wordArray.toString(CryptoJS.enc.Hex);
  return Uint8Array.from(hexToBytes(hex));
};

const bytesToWordArray = (bytes) => CryptoJS.lib.WordArray.create(bytes);

const sha256Bytes = (bytes) => wordArrayToBytes(CryptoJS.SHA256(bytesToWordArray(bytes)));

const ripemd160Bytes = (bytes) =>
  wordArrayToBytes(CryptoJS.RIPEMD160(bytesToWordArray(bytes)));

const hash160 = (bytes) => ripemd160Bytes(sha256Bytes(bytes));

const taggedHash = (tag, dataBytes) => {
  const tagBytes = Uint8Array.from(Buffer.from(String(tag), "utf8"));
  const tagHash = sha256Bytes(tagBytes);
  return sha256Bytes(Uint8Array.from([...tagHash, ...tagHash, ...dataBytes]));
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

const encodeBase58Check = (payload) => {
  const checksum = sha256Bytes(sha256Bytes(payload)).slice(0, 4);
  return encodeBase58(Uint8Array.from([...payload, ...checksum]));
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

const bech32Polymod = (values) => {
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) {
      if ((top >>> i) & 1) checksum ^= BECH32_GENERATORS[i];
    }
  }
  return checksum >>> 0;
};

const bech32HrpExpand = (hrp) => [
  ...Array.from(hrp).map((char) => char.charCodeAt(0) >> 5),
  0,
  ...Array.from(hrp).map((char) => char.charCodeAt(0) & 31),
];

const createBech32Checksum = (hrp, data, encoding) => {
  const constValue = encoding === "bech32m" ? 0x2bc830a3 : 1;
  const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ constValue;
  return Array.from({ length: 6 }, (_, index) =>
    (polymod >>> (5 * (5 - index))) & 31,
  );
};

const encodeSegwitAddress = (hrp, witnessVersion, program, encoding = "bech32") => {
  const words = convertBits(program, 8, 5, true);
  if (!words) return "";
  const data = [witnessVersion, ...words];
  const checksum = createBech32Checksum(hrp, data, encoding);
  return `${hrp}${1}${[...data, ...checksum]
    .map((value) => BECH32_CHARSET[value])
    .join("")}`;
};

const mod = (value, m) => {
  const result = value % m;
  return result >= 0n ? result : result + m;
};

const modPow = (base, exponent, modulus) => {
  let result = 1n;
  let factor = mod(base, modulus);
  let power = exponent;
  while (power > 0n) {
    if (power & 1n) result = mod(result * factor, modulus);
    factor = mod(factor * factor, modulus);
    power >>= 1n;
  }
  return result;
};

const modInverse = (value, modulus) => modPow(value, modulus - 2n, modulus);

const bigintToBytes = (value, length = 32) => {
  const hex = value.toString(16).padStart(length * 2, "0");
  return Uint8Array.from(hexToBytes(hex));
};

const bytesToBigint = (bytes) => BigInt(`0x${bytesToHex(bytes) || "0"}`);

const pointDouble = (point) => {
  if (!point) return null;
  const slope = mod(
    (3n * point.x * point.x) * modInverse(2n * point.y, SECP256K1_P),
    SECP256K1_P,
  );
  const x = mod(slope * slope - 2n * point.x, SECP256K1_P);
  const y = mod(slope * (point.x - x) - point.y, SECP256K1_P);
  return { x, y };
};

const pointAdd = (left, right) => {
  if (!left) return right;
  if (!right) return left;
  if (left.x === right.x) {
    if (mod(left.y + right.y, SECP256K1_P) === 0n) return null;
    return pointDouble(left);
  }
  const slope = mod(
    (right.y - left.y) * modInverse(right.x - left.x, SECP256K1_P),
    SECP256K1_P,
  );
  const x = mod(slope * slope - left.x - right.x, SECP256K1_P);
  const y = mod(slope * (left.x - x) - left.y, SECP256K1_P);
  return { x, y };
};

const scalarMultiply = (scalar, point) => {
  let n = mod(scalar, SECP256K1_N);
  let result = null;
  let addend = point;
  while (n > 0n) {
    if (n & 1n) result = pointAdd(result, addend);
    addend = pointDouble(addend);
    n >>= 1n;
  }
  return result;
};

const liftX = (x) => {
  const ySquared = mod(x * x * x + 7n, SECP256K1_P);
  let y = modPow(ySquared, (SECP256K1_P + 1n) / 4n, SECP256K1_P);
  if (mod(y * y - ySquared, SECP256K1_P) !== 0n) return null;
  if (y & 1n) y = SECP256K1_P - y;
  return { x, y };
};

const decodeCompressedPubkey = (pubkeyBytes) => {
  if (!(pubkeyBytes instanceof Uint8Array) || pubkeyBytes.length !== 33) return null;
  const prefix = pubkeyBytes[0];
  if (prefix !== 0x02 && prefix !== 0x03) return null;
  const x = bytesToBigint(pubkeyBytes.slice(1));
  let point = liftX(x);
  if (!point) return null;
  const odd = point.y & 1n;
  if ((prefix === 0x03 && odd === 0n) || (prefix === 0x02 && odd === 1n)) {
    point = { x: point.x, y: SECP256K1_P - point.y };
  }
  return point;
};

const getTaprootOutputKey = (compressedPubkey) => {
  const internalPoint = decodeCompressedPubkey(compressedPubkey);
  if (!internalPoint) return null;
  const evenPoint =
    internalPoint.y & 1n
      ? { x: internalPoint.x, y: SECP256K1_P - internalPoint.y }
      : internalPoint;
  const xOnly = bigintToBytes(evenPoint.x, 32);
  const tweak = mod(bytesToBigint(taggedHash("TapTweak", xOnly)), SECP256K1_N);
  const tweaked = pointAdd(evenPoint, scalarMultiply(tweak, SECP256K1_G));
  if (!tweaked) return null;
  return bigintToBytes(tweaked.x, 32);
};

const decodeExtendedPubkey = (xpub) => {
  const decoded = decodeBase58(xpub);
  if (!decoded || decoded.length !== 82) return null;
  const payload = decoded.slice(0, -4);
  const checksum = decoded.slice(-4);
  const expectedChecksum = sha256Bytes(sha256Bytes(payload)).slice(0, 4);
  if (bytesToHex(checksum) !== bytesToHex(expectedChecksum)) return null;
  const keyData = payload.slice(45, 78);
  if (keyData.length !== 33) return null;
  if (keyData[0] !== 0x02 && keyData[0] !== 0x03) return null;
  return keyData;
};

const addressTypeFromValue = (address) => {
  const normalized = normalizeAddressInput(address).toLowerCase();
  if (!normalized) return "";
  if (normalized.startsWith("1")) return BTC_ADDRESS_TYPES.LEGACY;
  if (normalized.startsWith("3")) return BTC_ADDRESS_TYPES.NESTED_SEGWIT;
  if (normalized.startsWith("bc1q") || normalized.startsWith("tb1q")) {
    return BTC_ADDRESS_TYPES.NATIVE_SEGWIT;
  }
  if (normalized.startsWith("bc1p") || normalized.startsWith("tb1p")) {
    return BTC_ADDRESS_TYPES.TAPROOT;
  }
  return "";
};

const uniqAddresses = (values) => {
  const out = [];
  for (const value of values) {
    const address = normalizeAddressInput(value);
    if (address && !out.includes(address)) out.push(address);
  }
  return out;
};

export const isBtcChainName = (chainName) => {
  const normalized = String(chainName || "").trim().toLowerCase();
  return BTC_CHAIN_NAMES.has(normalized);
};

export const isBtcCard = (card) =>
  isBtcChainName(card?.queryChainName || card?.queryChainShortName);

export const normalizeBtcAddressType = (type) => {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === BTC_ADDRESS_TYPES.LEGACY) return BTC_ADDRESS_TYPES.LEGACY;
  if (normalized === BTC_ADDRESS_TYPES.NATIVE_SEGWIT) {
    return BTC_ADDRESS_TYPES.NATIVE_SEGWIT;
  }
  if (normalized === BTC_ADDRESS_TYPES.TAPROOT) return BTC_ADDRESS_TYPES.TAPROOT;
  return BTC_ADDRESS_TYPES.NESTED_SEGWIT;
};

export const deriveBtcAddressesFromPubkeys = (pubkeysByType = {}) => {
  const out = {
    legacy: "",
    nestedSegwit: "",
    nativeSegwit: "",
    taproot: "",
  };

  const legacyPubkey = decodeExtendedPubkey(pubkeysByType.legacy);
  if (legacyPubkey) {
    out.legacy = encodeBase58Check(
      Uint8Array.from([0x00, ...hash160(legacyPubkey)]),
    );
  }

  const nestedPubkey = decodeExtendedPubkey(pubkeysByType.nestedSegwit);
  if (nestedPubkey) {
    const redeemScript = Uint8Array.from([0x00, 0x14, ...hash160(nestedPubkey)]);
    out.nestedSegwit = encodeBase58Check(
      Uint8Array.from([0x05, ...hash160(redeemScript)]),
    );
  }

  const nativePubkey = decodeExtendedPubkey(pubkeysByType.nativeSegwit);
  if (nativePubkey) {
    out.nativeSegwit = encodeSegwitAddress(
      "bc",
      0,
      hash160(nativePubkey),
      "bech32",
    );
  }

  const taprootPubkey = decodeExtendedPubkey(pubkeysByType.taproot);
  if (taprootPubkey) {
    const outputKey = getTaprootOutputKey(taprootPubkey);
    if (outputKey) {
      out.taproot = encodeSegwitAddress("bc", 1, outputKey, "bech32m");
    }
  }

  return out;
};

export const resolveBtcAddressByType = (
  targetType,
  address,
  legacyAddr = "",
  nestedSegwitAddr = "",
  nativeSegwitAddr = "",
  taprootAddr = "",
) => {
  const nextType = normalizeBtcAddressType(targetType);
  const fallback = normalizeAddressInput(address);
  const normalized = {
    legacy: normalizeAddressInput(legacyAddr),
    nestedSegwit: normalizeAddressInput(nestedSegwitAddr),
    nativeSegwit: normalizeAddressInput(nativeSegwitAddr),
    taproot: normalizeAddressInput(taprootAddr),
  };

  if (nextType === BTC_ADDRESS_TYPES.LEGACY) {
    return (
      normalized.legacy ||
      normalized.nestedSegwit ||
      normalized.nativeSegwit ||
      normalized.taproot ||
      fallback
    );
  }
  if (nextType === BTC_ADDRESS_TYPES.NATIVE_SEGWIT) {
    return (
      normalized.nativeSegwit ||
      normalized.nestedSegwit ||
      normalized.legacy ||
      normalized.taproot ||
      fallback
    );
  }
  if (nextType === BTC_ADDRESS_TYPES.TAPROOT) {
    return (
      normalized.taproot ||
      normalized.nestedSegwit ||
      normalized.nativeSegwit ||
      normalized.legacy ||
      fallback
    );
  }
  return (
    normalized.nestedSegwit ||
    normalized.legacy ||
    normalized.nativeSegwit ||
    normalized.taproot ||
    fallback
  );
};

export const enrichBtcAddressData = (
  card,
  preferredType = "",
  pubkeysByType = {},
) => {
  if (!card || typeof card !== "object") return card;
  if (!isBtcCard(card)) return card;

  const rawAddress = normalizeAddressInput(card?.address);
  const inferredType = addressTypeFromValue(rawAddress);
  const inferred = {
    legacy: inferredType === BTC_ADDRESS_TYPES.LEGACY ? rawAddress : "",
    nestedSegwit:
      inferredType === BTC_ADDRESS_TYPES.NESTED_SEGWIT ? rawAddress : "",
    nativeSegwit:
      inferredType === BTC_ADDRESS_TYPES.NATIVE_SEGWIT ? rawAddress : "",
    taproot: inferredType === BTC_ADDRESS_TYPES.TAPROOT ? rawAddress : "",
  };
  const derived = deriveBtcAddressesFromPubkeys(pubkeysByType);
  const btcLegacyAddr =
    normalizeAddressInput(card?.btcLegacyAddr) || inferred.legacy || derived.legacy;
  const btcNestedSegwitAddr =
    normalizeAddressInput(card?.btcNestedSegwitAddr) ||
    inferred.nestedSegwit ||
    derived.nestedSegwit;
  const btcNativeSegwitAddr =
    normalizeAddressInput(card?.btcNativeSegwitAddr) ||
    inferred.nativeSegwit ||
    derived.nativeSegwit;
  const btcTaprootAddr =
    normalizeAddressInput(card?.btcTaprootAddr) || inferred.taproot || derived.taproot;

  const nextType = normalizeBtcAddressType(
    preferredType ||
      card?.btcAddressType ||
      inferredType ||
      BTC_ADDRESS_TYPES.NESTED_SEGWIT,
  );
  const address = resolveBtcAddressByType(
    nextType,
    rawAddress,
    btcLegacyAddr,
    btcNestedSegwitAddr,
    btcNativeSegwitAddr,
    btcTaprootAddr,
  );

  return {
    ...card,
    btcAddressType: nextType,
    btcLegacyAddr,
    btcNestedSegwitAddr,
    btcNativeSegwitAddr,
    btcTaprootAddr,
    address,
  };
};

export const switchBtcAddressTypeForCard = (card, nextType) =>
  enrichBtcAddressData(card, normalizeBtcAddressType(nextType));

export const getBtcAddressByTypeFromCard = (card, nextType) => {
  if (!card || !isBtcCard(card)) return normalizeAddressInput(card?.address);
  const normalized = enrichBtcAddressData(card, card?.btcAddressType);
  return resolveBtcAddressByType(
    nextType,
    normalized?.address,
    normalized?.btcLegacyAddr,
    normalized?.btcNestedSegwitAddr,
    normalized?.btcNativeSegwitAddr,
    normalized?.btcTaprootAddr,
  );
};

export const getBtcQueryAddressesFromCard = (card) => {
  if (!card || !isBtcCard(card)) {
    const address = normalizeAddressInput(card?.address);
    return address ? [address] : [];
  }

  const normalized = enrichBtcAddressData(card, card?.btcAddressType);
  return uniqAddresses([
    normalized?.address,
    normalized?.btcLegacyAddr,
    normalized?.btcNestedSegwitAddr,
    normalized?.btcNativeSegwitAddr,
    normalized?.btcTaprootAddr,
  ]);
};
