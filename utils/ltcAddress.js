/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { Buffer } from "buffer";
import CryptoJS from "crypto-js";

export const LTC_ADDRESS_TYPES = {
  LEGACY: "legacy",
  NESTED_SEGWIT: "nested_segwit",
  NATIVE_SEGWIT: "native_segwit",
};

const LTC_BALANCE_FIELD_BY_TYPE = {
  [LTC_ADDRESS_TYPES.LEGACY]: "ltcLegacyBalance",
  [LTC_ADDRESS_TYPES.NESTED_SEGWIT]: "ltcNestedSegwitBalance",
  [LTC_ADDRESS_TYPES.NATIVE_SEGWIT]: "ltcNativeSegwitBalance",
};

const LTC_CHAIN_NAMES = new Set(["ltc", "litecoin"]);
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

const normalizeAddressInput = (address) => String(address || "").trim();

const hexToBytes = (hex) => {
  const normalized = String(hex || "").trim();
  if (!normalized || normalized.length % 2 !== 0) return [];
  const out = [];
  for (let i = 0; i < normalized.length; i += 2) {
    out.push(parseInt(normalized.slice(i, i + 2), 16));
  }
  return out;
};

const bytesToHex = (bytes) =>
  Array.from(bytes || [], (value) => value.toString(16).padStart(2, "0")).join("");

const wordArrayToBytes = (wordArray) => {
  const hex = wordArray.toString(CryptoJS.enc.Hex);
  return Uint8Array.from(hexToBytes(hex));
};

const bytesToWordArray = (bytes) => CryptoJS.lib.WordArray.create(bytes);

const sha256Bytes = (bytes) => wordArrayToBytes(CryptoJS.SHA256(bytesToWordArray(bytes)));

const ripemd160Bytes = (bytes) =>
  wordArrayToBytes(CryptoJS.RIPEMD160(bytesToWordArray(bytes)));

const hash160 = (bytes) => ripemd160Bytes(sha256Bytes(bytes));

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

const isValidBase58Check = (decodedBytes) => {
  if (!decodedBytes || decodedBytes.length < 5) return false;
  const payload = decodedBytes.slice(0, -4);
  const checksum = decodedBytes.slice(-4);
  return (
    bytesToHex(checksum) ===
    bytesToHex(sha256Bytes(sha256Bytes(payload)).slice(0, 4))
  );
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

const createBech32Checksum = (hrp, data) => {
  const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ 1;
  return Array.from({ length: 6 }, (_, index) =>
    (polymod >>> (5 * (5 - index))) & 31,
  );
};

const decodeBech32 = (address) => {
  const normalized = normalizeAddressInput(address);
  if (!normalized) return null;
  if (
    normalized !== normalized.toLowerCase() &&
    normalized !== normalized.toUpperCase()
  ) {
    return null;
  }

  const lowerAddress = normalized.toLowerCase();
  const separatorIndex = lowerAddress.lastIndexOf("1");
  if (separatorIndex < 1 || separatorIndex + 7 > lowerAddress.length) return null;

  const hrp = lowerAddress.slice(0, separatorIndex);
  const dataChars = lowerAddress.slice(separatorIndex + 1);
  const data = [];
  for (const char of dataChars) {
    const value = BECH32_CHARSET.indexOf(char);
    if (value < 0) return null;
    data.push(value);
  }

  const polymod = bech32Polymod([...bech32HrpExpand(hrp), ...data]);
  if (polymod !== 1) return null;

  return {
    hrp,
    data: data.slice(0, -6),
  };
};

const decodeSegwitAddress = (address, expectedHrp) => {
  const decoded = decodeBech32(address);
  if (!decoded || decoded.hrp !== expectedHrp) return null;
  const [witnessVersion, ...programWords] = decoded.data;
  if (witnessVersion !== 0) return null;

  const program = convertBits(programWords, 5, 8, false);
  if (!program || (program.length !== 20 && program.length !== 32)) return null;

  return {
    witnessVersion,
    program,
  };
};

const encodeSegwitAddress = (hrp, witnessVersion, program) => {
  const words = convertBits(program, 8, 5, true);
  if (!words) return "";
  const data = [witnessVersion, ...words];
  const checksum = createBech32Checksum(hrp, data);
  return `${hrp}${1}${[...data, ...checksum]
    .map((value) => BECH32_CHARSET[value])
    .join("")}`;
};

const decodeExtendedPubkey = (xpub) => {
  const decoded = decodeBase58(xpub);
  if (!decoded || decoded.length !== 82) return null;
  const payload = decoded.slice(0, -4);
  const checksum = decoded.slice(-4);
  const expectedChecksum = sha256Bytes(sha256Bytes(payload)).slice(0, 4);
  if (Buffer.from(checksum).toString("hex") !== Buffer.from(expectedChecksum).toString("hex")) {
    return null;
  }
  const keyData = payload.slice(45, 78);
  if (keyData.length !== 33) return null;
  if (keyData[0] !== 0x02 && keyData[0] !== 0x03) return null;
  return keyData;
};

const addressTypeFromValue = (address) => {
  const normalized = normalizeAddressInput(address).toLowerCase();
  if (!normalized) return "";
  if (normalized.startsWith("l")) return LTC_ADDRESS_TYPES.LEGACY;
  if (normalized.startsWith("m") || normalized.startsWith("3")) {
    return LTC_ADDRESS_TYPES.NESTED_SEGWIT;
  }
  if (normalized.startsWith("ltc1q")) return LTC_ADDRESS_TYPES.NATIVE_SEGWIT;
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

export const isLtcChainName = (chainName) => {
  const normalized = String(chainName || "").trim().toLowerCase();
  return LTC_CHAIN_NAMES.has(normalized);
};

export const isLtcCard = (card) =>
  isLtcChainName(card?.queryChainName || card?.queryChainShortName);

export const normalizeLtcAddressType = (type) => {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === LTC_ADDRESS_TYPES.LEGACY) return LTC_ADDRESS_TYPES.LEGACY;
  if (normalized === LTC_ADDRESS_TYPES.NATIVE_SEGWIT) {
    return LTC_ADDRESS_TYPES.NATIVE_SEGWIT;
  }
  return LTC_ADDRESS_TYPES.NESTED_SEGWIT;
};

export const getLtcAddressType = (address) => {
  const normalized = normalizeAddressInput(address);
  if (!normalized) return "";

  const decodedBase58 = decodeBase58(normalized);
  if (
    decodedBase58 &&
    decodedBase58.length === 25 &&
    isValidBase58Check(decodedBase58)
  ) {
    const version = decodedBase58[0];
    if (version === 0x30) return LTC_ADDRESS_TYPES.LEGACY;
    if (version === 0x32 || version === 0x05) {
      return LTC_ADDRESS_TYPES.NESTED_SEGWIT;
    }
  }

  if (decodeSegwitAddress(normalized, "ltc")) {
    return LTC_ADDRESS_TYPES.NATIVE_SEGWIT;
  }
  return "";
};

export const isLtcAddress = (address) => !!getLtcAddressType(address);

export const deriveLtcAddressesFromPubkeys = (pubkeysByType = {}) => {
  const out = {
    legacy: "",
    nestedSegwit: "",
    nativeSegwit: "",
  };

  const legacyPubkey = decodeExtendedPubkey(pubkeysByType.legacy);
  if (legacyPubkey) {
    out.legacy = encodeBase58Check(
      Uint8Array.from([0x30, ...hash160(legacyPubkey)]),
    );
  }

  const nestedPubkey = decodeExtendedPubkey(pubkeysByType.nestedSegwit);
  if (nestedPubkey) {
    const redeemScript = Uint8Array.from([0x00, 0x14, ...hash160(nestedPubkey)]);
    out.nestedSegwit = encodeBase58Check(
      Uint8Array.from([0x32, ...hash160(redeemScript)]),
    );
  }

  const nativePubkey = decodeExtendedPubkey(pubkeysByType.nativeSegwit);
  if (nativePubkey) {
    out.nativeSegwit = encodeSegwitAddress("ltc", 0, hash160(nativePubkey));
  }

  return out;
};

export const resolveLtcAddressByType = (
  targetType,
  address,
  legacyAddr = "",
  nestedSegwitAddr = "",
  nativeSegwitAddr = "",
) => {
  const nextType = normalizeLtcAddressType(targetType);
  const fallback = normalizeAddressInput(address);
  const normalized = {
    legacy: normalizeAddressInput(legacyAddr),
    nestedSegwit: normalizeAddressInput(nestedSegwitAddr),
    nativeSegwit: normalizeAddressInput(nativeSegwitAddr),
  };

  if (nextType === LTC_ADDRESS_TYPES.LEGACY) {
    return normalized.legacy || normalized.nestedSegwit || normalized.nativeSegwit || fallback;
  }
  if (nextType === LTC_ADDRESS_TYPES.NATIVE_SEGWIT) {
    return normalized.nativeSegwit || normalized.nestedSegwit || normalized.legacy || fallback;
  }
  return normalized.nestedSegwit || normalized.legacy || normalized.nativeSegwit || fallback;
};

export const enrichLtcAddressData = (
  card,
  preferredType = "",
  pubkeysByType = {},
) => {
  if (!card || typeof card !== "object") return card;
  if (!isLtcCard(card)) return card;

  const rawAddress = normalizeAddressInput(card?.address);
  const inferredType = addressTypeFromValue(rawAddress);
  const inferred = {
    legacy: inferredType === LTC_ADDRESS_TYPES.LEGACY ? rawAddress : "",
    nestedSegwit:
      inferredType === LTC_ADDRESS_TYPES.NESTED_SEGWIT ? rawAddress : "",
    nativeSegwit:
      inferredType === LTC_ADDRESS_TYPES.NATIVE_SEGWIT ? rawAddress : "",
  };
  const derived = deriveLtcAddressesFromPubkeys(pubkeysByType);
  const ltcLegacyAddr =
    normalizeAddressInput(card?.ltcLegacyAddr) || inferred.legacy || derived.legacy;
  const ltcNestedSegwitAddr =
    normalizeAddressInput(card?.ltcNestedSegwitAddr) ||
    inferred.nestedSegwit ||
    derived.nestedSegwit;
  const ltcNativeSegwitAddr =
    normalizeAddressInput(card?.ltcNativeSegwitAddr) ||
    inferred.nativeSegwit ||
    derived.nativeSegwit;

  const nextType = normalizeLtcAddressType(
    preferredType ||
      card?.ltcAddressType ||
      inferredType ||
      LTC_ADDRESS_TYPES.NESTED_SEGWIT,
  );
  const address = resolveLtcAddressByType(
    nextType,
    rawAddress,
    ltcLegacyAddr,
    ltcNestedSegwitAddr,
    ltcNativeSegwitAddr,
  );

  const typedBalance =
    card?.ltcAddressBalances?.[nextType] ??
    card?.[LTC_BALANCE_FIELD_BY_TYPE[nextType]];

  const nextCard = {
    ...card,
    ltcAddressType: nextType,
    ltcLegacyAddr,
    ltcNestedSegwitAddr,
    ltcNativeSegwitAddr,
    address,
  };
  if (typedBalance !== undefined && typedBalance !== null) {
    const nextBalance = String(typedBalance);
    nextCard.balance = nextBalance;
    const priceUsd = Number(card?.priceUsd ?? 0);
    const balanceNumber = Number(nextBalance);
    if (Number.isFinite(priceUsd) && priceUsd > 0 && Number.isFinite(balanceNumber)) {
      nextCard.EstimatedValue = (balanceNumber * priceUsd).toFixed(2);
    }
  }
  return nextCard;
};

export const switchLtcAddressTypeForCard = (card, nextType) =>
  enrichLtcAddressData(card, normalizeLtcAddressType(nextType));

export const getLtcAddressByTypeFromCard = (card, nextType) => {
  if (!card || !isLtcCard(card)) return normalizeAddressInput(card?.address);
  const normalized = enrichLtcAddressData(card, card?.ltcAddressType);
  return resolveLtcAddressByType(
    nextType,
    normalized?.address,
    normalized?.ltcLegacyAddr,
    normalized?.ltcNestedSegwitAddr,
    normalized?.ltcNativeSegwitAddr,
  );
};

export const getLtcQueryAddressesFromCard = (card) => {
  if (!card || !isLtcCard(card)) {
    const address = normalizeAddressInput(card?.address);
    return address ? [address] : [];
  }

  const normalized = enrichLtcAddressData(card, card?.ltcAddressType);
  return uniqAddresses([
    normalized?.address,
    normalized?.ltcLegacyAddr,
    normalized?.ltcNestedSegwitAddr,
    normalized?.ltcNativeSegwitAddr,
  ]);
};
