#!/usr/bin/env node
/*
 * Offline helper for signing a Litecoin Native SegWit/P2WPKH presign payload
 * returned by /api/sign/encode_btc. It can optionally broadcast through a
 * public Litecoin node when --broadcast is passed.
 *
 * Safety:
 * - Default mode signs only and prints diagnostics; it does not broadcast.
 * - The derived P2WPKH address must match --from.
 * - The final signed transaction is checked so every input has empty scriptSig.
 */

const crypto = require("crypto");

const SIGHASH_ALL = 0x01;
const SECP256K1_P = BigInt(
  "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f",
);
const SECP256K1_N = BigInt(
  "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
);
const SECP256K1_G = {
  x: BigInt(
    "0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  ),
  y: BigInt(
    "0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",
  ),
};
const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_MAP = Object.fromEntries([...BECH32].map((char, index) => [char, index]));
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_MAP = Object.fromEntries([...BASE58].map((char, index) => [char, index]));

const DEFAULT_FROM_ADDRESS = "ltc1qav3rem5u9yhhpgr0l9q8mmkejxp6ffx56ftkp9";
const DEFAULT_PATH = "m/84'/2'/0'/0/0";
const DEFAULT_PRESIGN_PAYLOAD = {
  hex: "0100000002343eeac7c60fc990eac1ec883cd511c79bbd04fbe4f7157e94089111f85b6e1e0000000000ffffffff13e9fe76d76911d2a6012d0fea447bde4eec4a2609a6adee3937cb48dc55ad260000000000ffffffff027aaf49000000000017a9148953aaf02088add8abd5df7b92b197e6ef82c35287cfa1190000000000160014eb223cee9c292f70a06ff9407deed99183a4a4d400000000",
  value: [4832780, 1757160],
  inputScriptType: "p2wpkh",
  changeScriptType: "p2wpkh",
  receiveScriptType: "p2sh-p2wpkh",
  signMode: "segwit_v0",
};
const DEFAULT_BROADCAST_URL = "https://litecoinspace.org/api/tx";

function usage() {
  console.log(`Usage:
  LTC_WIF=<sender_wif> node scripts/sign-ltc-native-p2wpkh-broadcast-test.js
  LTC_MNEMONIC="<words>" node scripts/sign-ltc-native-p2wpkh-broadcast-test.js
  LTC_MNEMONIC="<words>" node scripts/sign-ltc-native-p2wpkh-broadcast-test.js --broadcast
  node scripts/sign-ltc-native-p2wpkh-broadcast-test.js --wif <sender_wif> --from ${DEFAULT_FROM_ADDRESS}
  node scripts/sign-ltc-native-p2wpkh-broadcast-test.js --mnemonic "<words>" --path "${DEFAULT_PATH}"
  node scripts/sign-ltc-native-p2wpkh-broadcast-test.js --wif <sender_wif> --payload '{"hex":"...","value":[...]}'

Notes:
  - This signs Native SegWit/P2WPKH inputs only.
  - It uses the server presign hex exactly as returned by encode_btc.
  - Broadcast only happens when --broadcast is provided.`);
}

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : "";
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest();
}

function hash256(buf) {
  return sha256(sha256(buf));
}

function hash160(buf) {
  return crypto.createHash("ripemd160").update(sha256(buf)).digest();
}

function hmacSha256(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function hmacSha512(key, data) {
  return crypto.createHmac("sha512", key).update(data).digest();
}

function mod(value, modulo = SECP256K1_P) {
  const result = value % modulo;
  return result >= 0n ? result : result + modulo;
}

function inverse(value, modulo = SECP256K1_P) {
  let oldR = modulo;
  let r = mod(value, modulo);
  let oldS = 0n;
  let s = 1n;
  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }
  if (oldR !== 1n) throw new Error("Value has no modular inverse");
  return mod(oldS, modulo);
}

function pointDouble(point) {
  if (!point) return null;
  const slope = mod((3n * point.x * point.x) * inverse(2n * point.y));
  const x = mod(slope * slope - 2n * point.x);
  return { x, y: mod(slope * (point.x - x) - point.y) };
}

function ecPointAdd(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.x === b.x) {
    if (mod(a.y + b.y) === 0n) return null;
    return pointDouble(a);
  }
  const slope = mod((b.y - a.y) * inverse(b.x - a.x));
  const x = mod(slope * slope - a.x - b.x);
  return { x, y: mod(slope * (a.x - x) - a.y) };
}

function scalarMultiply(scalar, point = SECP256K1_G) {
  let n = scalar;
  let result = null;
  let addend = point;
  while (n > 0n) {
    if (n & 1n) result = ecPointAdd(result, addend);
    addend = pointDouble(addend);
    n >>= 1n;
  }
  return result;
}

function bigIntTo32(value) {
  return Buffer.from(value.toString(16).padStart(64, "0"), "hex");
}

function publicKeyFromPrivate(privateKey, compressed = true) {
  try {
    const ecdh = crypto.createECDH("secp256k1");
    ecdh.setPrivateKey(privateKey);
    return ecdh.getPublicKey(null, compressed ? "compressed" : "uncompressed");
  } catch {}

  const scalar = BigInt(`0x${privateKey.toString("hex")}`);
  if (scalar <= 0n || scalar >= SECP256K1_N) {
    throw new Error("Private key is outside secp256k1 range");
  }
  const point = scalarMultiply(scalar);
  const x = bigIntTo32(point.x);
  const y = bigIntTo32(point.y);
  if (!compressed) return Buffer.concat([Buffer.from([0x04]), x, y]);
  return Buffer.concat([Buffer.from([point.y & 1n ? 0x03 : 0x02]), x]);
}

function base58Decode(input) {
  let num = 0n;
  for (const char of input) {
    const value = BASE58_MAP[char];
    if (value == null) throw new Error(`Invalid base58 character: ${char}`);
    num = num * 58n + BigInt(value);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let bytes = hex ? Buffer.from(hex, "hex") : Buffer.alloc(0);
  for (const char of input) {
    if (char !== "1") break;
    bytes = Buffer.concat([Buffer.from([0]), bytes]);
  }
  return bytes;
}

function base58CheckDecode(input) {
  const bytes = base58Decode(input);
  if (bytes.length < 5) throw new Error("Base58Check payload is too short");
  const payload = bytes.subarray(0, -4);
  const checksum = bytes.subarray(-4);
  if (!hash256(payload).subarray(0, 4).equals(checksum)) {
    throw new Error("Base58Check checksum mismatch");
  }
  return payload;
}

function decodeWif(wif) {
  const payload = base58CheckDecode(wif);
  if (payload[0] !== 0xb0) throw new Error("Only Litecoin mainnet WIF is supported");
  if (payload.length === 34 && payload[33] === 0x01) {
    return { privateKey: payload.subarray(1, 33), compressed: true };
  }
  if (payload.length === 33) {
    return { privateKey: payload.subarray(1, 33), compressed: false };
  }
  throw new Error("Invalid WIF length");
}

function mnemonicToSeed(mnemonic, passphrase = "") {
  return crypto.pbkdf2Sync(
    Buffer.from(String(mnemonic || "").normalize("NFKD"), "utf8"),
    Buffer.from(`mnemonic${String(passphrase || "").normalize("NFKD")}`, "utf8"),
    2048,
    64,
    "sha512",
  );
}

function deriveMasterNode(seed) {
  const digest = hmacSha512(Buffer.from("Bitcoin seed", "utf8"), seed);
  return {
    privateKey: digest.subarray(0, 32),
    chainCode: digest.subarray(32),
  };
}

function deriveChildNode(node, index) {
  const hardened = index >= 0x80000000;
  const data = hardened
    ? Buffer.concat([Buffer.from([0]), node.privateKey, uint32be(index)])
    : Buffer.concat([publicKeyFromPrivate(node.privateKey, true), uint32be(index)]);
  const digest = hmacSha512(node.chainCode, data);
  const tweak = BigInt(`0x${digest.subarray(0, 32).toString("hex")}`);
  const parent = BigInt(`0x${node.privateKey.toString("hex")}`);
  const child = mod(tweak + parent, SECP256K1_N);
  if (tweak >= SECP256K1_N || child === 0n) {
    throw new Error("Invalid BIP32 child key");
  }
  return { privateKey: bigIntTo32(child), chainCode: digest.subarray(32) };
}

function parseDerivationPath(path) {
  const parts = String(path || "").trim().split("/");
  if (parts[0] !== "m") throw new Error("Derivation path must start with m");
  return parts.slice(1).map((part) => {
    const hardened = part.endsWith("'") || part.endsWith("h") || part.endsWith("H");
    const number = Number(hardened ? part.slice(0, -1) : part);
    if (!Number.isInteger(number) || number < 0 || number >= 0x80000000) {
      throw new Error(`Invalid derivation path segment: ${part}`);
    }
    return hardened ? number + 0x80000000 : number;
  });
}

function derivePrivateKeyFromMnemonic(mnemonic, path, passphrase = "") {
  let node = deriveMasterNode(mnemonicToSeed(mnemonic, passphrase));
  for (const index of parseDerivationPath(path)) {
    node = deriveChildNode(node, index);
  }
  return node.privateKey;
}

function uint32be(value) {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value >>> 0, 0);
  return out;
}

function uint32le(value) {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value >>> 0, 0);
  return out;
}

function uint64le(value) {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value), 0);
  return out;
}

function readVarInt(buf, cursor) {
  const first = buf[cursor.offset++];
  if (first < 0xfd) return first;
  if (first === 0xfd) {
    const value = buf.readUInt16LE(cursor.offset);
    cursor.offset += 2;
    return value;
  }
  if (first === 0xfe) {
    const value = buf.readUInt32LE(cursor.offset);
    cursor.offset += 4;
    return value;
  }
  const value = Number(buf.readBigUInt64LE(cursor.offset));
  cursor.offset += 8;
  return value;
}

function writeVarInt(value) {
  if (value < 0xfd) return Buffer.from([value]);
  if (value <= 0xffff) {
    const out = Buffer.alloc(3);
    out[0] = 0xfd;
    out.writeUInt16LE(value, 1);
    return out;
  }
  if (value <= 0xffffffff) {
    const out = Buffer.alloc(5);
    out[0] = 0xfe;
    out.writeUInt32LE(value, 1);
    return out;
  }
  const out = Buffer.alloc(9);
  out[0] = 0xff;
  out.writeBigUInt64LE(BigInt(value), 1);
  return out;
}

function bech32Polymod(values) {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) {
      if ((top >> i) & 1) chk ^= generators[i];
    }
  }
  return chk >>> 0;
}

function bech32HrpExpand(hrp) {
  const out = [];
  for (const char of hrp) out.push(char.charCodeAt(0) >> 5);
  out.push(0);
  for (const char of hrp) out.push(char.charCodeAt(0) & 31);
  return out;
}

function bech32CreateChecksum(hrp, words, encodingConst) {
  const values = [...bech32HrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ encodingConst;
  const checksum = [];
  for (let i = 0; i < 6; i += 1) {
    checksum.push((polymod >> (5 * (5 - i))) & 31);
  }
  return checksum;
}

function bech32Encode(hrp, words, encodingConst = 1) {
  return `${hrp}1${[...words, ...bech32CreateChecksum(hrp, words, encodingConst)]
    .map((word) => BECH32[word])
    .join("")}`;
}

function bech32Decode(address) {
  const lower = String(address || "").trim().toLowerCase();
  const sep = lower.lastIndexOf("1");
  if (sep <= 0) throw new Error("Invalid bech32 address");
  const hrp = lower.slice(0, sep);
  const words = [...lower.slice(sep + 1)].map((char) => {
    const value = BECH32_MAP[char];
    if (value == null) throw new Error(`Invalid bech32 character: ${char}`);
    return value;
  });
  if (words.length < 6) throw new Error("Invalid bech32 checksum length");
  const data = words.slice(0, -6);
  const check = bech32Polymod([...bech32HrpExpand(hrp), ...words]);
  if (check !== 1 && check !== 0x2bc830a3) {
    throw new Error("Invalid bech32 checksum");
  }
  return { hrp, data, encoding: check === 1 ? "bech32" : "bech32m" };
}

function convertBits(data, fromBits, toBits, pad = true) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    if (value < 0 || value >> fromBits) throw new Error("Invalid convertBits value");
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) ret.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    throw new Error("Invalid unpadded convertBits data");
  }
  return ret;
}

function p2wpkhAddress(pubkey) {
  return bech32Encode("ltc", [0, ...convertBits([...hash160(pubkey)], 8, 5, true)], 1);
}

function witnessProgramFromP2wpkhAddress(address) {
  const decoded = bech32Decode(address);
  if (decoded.hrp !== "ltc") throw new Error("Only Litecoin mainnet ltc1 addresses are supported");
  const version = decoded.data[0];
  const program = Buffer.from(convertBits(decoded.data.slice(1), 5, 8, false));
  if (version !== 0 || program.length !== 20 || decoded.encoding !== "bech32") {
    throw new Error("Expected a Native SegWit P2WPKH address");
  }
  return program;
}

function p2wpkhScriptPubKeyFromAddress(address) {
  return Buffer.concat([Buffer.from([0x00, 0x14]), witnessProgramFromP2wpkhAddress(address)]);
}

function p2wpkhScriptCodeFromPubkey(pubkey) {
  return Buffer.concat([Buffer.from("76a914", "hex"), hash160(pubkey), Buffer.from("88ac", "hex")]);
}

function parseTx(hex) {
  const buf = Buffer.from(hex, "hex");
  const cursor = { offset: 0 };
  const version = buf.subarray(cursor.offset, cursor.offset + 4);
  cursor.offset += 4;
  const inputCount = readVarInt(buf, cursor);
  const inputs = [];
  for (let i = 0; i < inputCount; i += 1) {
    const txidLe = buf.subarray(cursor.offset, cursor.offset + 32);
    cursor.offset += 32;
    const vout = buf.subarray(cursor.offset, cursor.offset + 4);
    cursor.offset += 4;
    const scriptLen = readVarInt(buf, cursor);
    const script = buf.subarray(cursor.offset, cursor.offset + scriptLen);
    cursor.offset += scriptLen;
    const sequence = buf.subarray(cursor.offset, cursor.offset + 4);
    cursor.offset += 4;
    inputs.push({ txidLe, vout, script, sequence });
  }
  const outputCount = readVarInt(buf, cursor);
  const outputs = [];
  for (let i = 0; i < outputCount; i += 1) {
    const value = buf.subarray(cursor.offset, cursor.offset + 8);
    cursor.offset += 8;
    const scriptLen = readVarInt(buf, cursor);
    const script = buf.subarray(cursor.offset, cursor.offset + scriptLen);
    cursor.offset += scriptLen;
    outputs.push({ value, script });
  }
  const locktime = buf.subarray(cursor.offset, cursor.offset + 4);
  cursor.offset += 4;
  if (cursor.offset !== buf.length) throw new Error("Unexpected trailing tx bytes");
  return { version, inputs, outputs, locktime };
}

function serializeBaseTx(tx) {
  const parts = [tx.version, writeVarInt(tx.inputs.length)];
  tx.inputs.forEach((input) => {
    parts.push(input.txidLe, input.vout, writeVarInt(input.script.length), input.script, input.sequence);
  });
  parts.push(writeVarInt(tx.outputs.length));
  tx.outputs.forEach((output) => {
    parts.push(output.value, writeVarInt(output.script.length), output.script);
  });
  parts.push(tx.locktime);
  return Buffer.concat(parts);
}

function serializeOutpoint(input) {
  return Buffer.concat([input.txidLe, input.vout]);
}

function satsFromLe(value) {
  return Number(value.readBigUInt64LE(0));
}

function inputSummary(input, valueSats) {
  return {
    txid: Buffer.from(input.txidLe).reverse().toString("hex"),
    vout: input.vout.readUInt32LE(0),
    valueSats,
    valueLtc: valueSats / 1e8,
    scriptSigBytes: input.script.length,
  };
}

function outputSummary(output) {
  const valueSats = satsFromLe(output.value);
  return {
    valueSats,
    valueLtc: valueSats / 1e8,
    scriptPubKey: output.script.toString("hex"),
  };
}

function bip143Digest(tx, inputIndex, scriptCode, valueSats) {
  const input = tx.inputs[inputIndex];
  const hashPrevouts = hash256(Buffer.concat(tx.inputs.map(serializeOutpoint)));
  const hashSequence = hash256(Buffer.concat(tx.inputs.map((item) => item.sequence)));
  const hashOutputs = hash256(
    Buffer.concat(tx.outputs.map((output) => Buffer.concat([
      output.value,
      writeVarInt(output.script.length),
      output.script,
    ]))),
  );
  const preimage = Buffer.concat([
    tx.version,
    hashPrevouts,
    hashSequence,
    serializeOutpoint(input),
    writeVarInt(scriptCode.length),
    scriptCode,
    uint64le(valueSats),
    input.sequence,
    hashOutputs,
    tx.locktime,
    uint32le(SIGHASH_ALL),
  ]);
  return hash256(preimage);
}

function derLength(len) {
  if (len < 128) return Buffer.from([len]);
  const bytes = [];
  let value = len;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag, body) {
  return Buffer.concat([Buffer.from([tag]), derLength(body.length), body]);
}

function derIntegerToBuffer(value) {
  let out = value;
  while (out.length > 1 && out[0] === 0x00 && (out[1] & 0x80) === 0) {
    out = out.subarray(1);
  }
  return out;
}

function encodeDerInteger(unsignedBytes) {
  let value = derIntegerToBuffer(unsignedBytes);
  if (value[0] & 0x80) value = Buffer.concat([Buffer.from([0x00]), value]);
  return der(0x02, value);
}

function bits2octets(bytes) {
  return bigIntTo32(BigInt(`0x${bytes.toString("hex")}`) % SECP256K1_N);
}

function deterministicK(privateKey, digest, attempt = 0) {
  const x = privateKey;
  const h1 = bits2octets(digest);
  let v = Buffer.alloc(32, 0x01);
  let k = Buffer.alloc(32, 0x00);
  k = hmacSha256(k, Buffer.concat([v, Buffer.from([0x00]), x, h1]));
  v = hmacSha256(k, v);
  k = hmacSha256(k, Buffer.concat([v, Buffer.from([0x01]), x, h1]));
  v = hmacSha256(k, v);
  for (let i = 0; i <= attempt + 1000; i += 1) {
    v = hmacSha256(k, v);
    const candidate = BigInt(`0x${v.toString("hex")}`);
    if (i >= attempt && candidate > 0n && candidate < SECP256K1_N) return candidate;
    k = hmacSha256(k, Buffer.concat([v, Buffer.from([0x00])]));
    v = hmacSha256(k, v);
  }
  throw new Error("Failed to derive deterministic nonce");
}

function signDigest(privateKey, digest) {
  const d = BigInt(`0x${privateKey.toString("hex")}`);
  const z = BigInt(`0x${digest.toString("hex")}`);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const k = deterministicK(privateKey, digest, attempt);
    const point = scalarMultiply(k);
    const rInt = mod(point.x, SECP256K1_N);
    if (rInt === 0n) continue;
    let sInt = mod(inverse(k, SECP256K1_N) * (z + rInt * d), SECP256K1_N);
    if (sInt === 0n) continue;
    if (sInt > SECP256K1_N / 2n) sInt = SECP256K1_N - sInt;
    return der(0x30, Buffer.concat([
      encodeDerInteger(bigIntTo32(rInt)),
      encodeDerInteger(bigIntTo32(sInt)),
    ]));
  }
  throw new Error("Failed to generate ECDSA signature");
}

function serializeWitnessStack(items) {
  return Buffer.concat([
    writeVarInt(items.length),
    ...items.map((item) => Buffer.concat([writeVarInt(item.length), item])),
  ]);
}

function signP2wpkh(tx, payloadValues, privateKey, pubkey) {
  if (payloadValues.length !== tx.inputs.length) {
    throw new Error(`value count ${payloadValues.length} does not match input count ${tx.inputs.length}`);
  }
  const scriptCode = p2wpkhScriptCodeFromPubkey(pubkey);
  const signedInputs = tx.inputs.map((input) => ({ ...input, script: Buffer.alloc(0) }));
  const witnesses = tx.inputs.map((_, inputIndex) => {
    const digest = bip143Digest(tx, inputIndex, scriptCode, Number(payloadValues[inputIndex]));
    const sigWithHashType = Buffer.concat([signDigest(privateKey, digest), Buffer.from([SIGHASH_ALL])]);
    return [sigWithHashType, pubkey];
  });
  const noWitnessTx = { ...tx, inputs: signedInputs };
  return Buffer.concat([
    tx.version,
    Buffer.from([0x00, 0x01]),
    writeVarInt(noWitnessTx.inputs.length),
    ...noWitnessTx.inputs.flatMap((input) => [
      input.txidLe,
      input.vout,
      writeVarInt(input.script.length),
      input.script,
      input.sequence,
    ]),
    writeVarInt(noWitnessTx.outputs.length),
    ...noWitnessTx.outputs.flatMap((output) => [
      output.value,
      writeVarInt(output.script.length),
      output.script,
    ]),
    ...witnesses.map(serializeWitnessStack),
    tx.locktime,
  ]);
}

function inspectSignedSegwitTx(hex) {
  const buf = Buffer.from(hex, "hex");
  const cursor = { offset: 0 };
  cursor.offset += 4;
  const marker = buf[cursor.offset++];
  const flag = buf[cursor.offset++];
  if (marker !== 0x00 || flag !== 0x01) {
    throw new Error("Signed transaction is not serialized as a witness transaction");
  }
  const inputCount = readVarInt(buf, cursor);
  const scriptSigLengths = [];
  for (let i = 0; i < inputCount; i += 1) {
    cursor.offset += 32 + 4;
    const scriptLen = readVarInt(buf, cursor);
    scriptSigLengths.push(scriptLen);
    cursor.offset += scriptLen + 4;
  }
  return {
    inputCount,
    scriptSigLengths,
    scriptSigsAreEmpty: scriptSigLengths.every((length) => length === 0),
  };
}

async function broadcastHex({ url, chain, hex, address }) {
  const isPublicMempoolApi = /\/api\/tx\/?$/.test(url);
  const response = await fetch(
    url,
    isPublicMempoolApi
      ? {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: hex,
        }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chain, hex, address }),
        },
  );
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: response.status, body };
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    return;
  }

  const wif = getArg("wif") || process.env.LTC_WIF;
  const mnemonic = getArg("mnemonic") || process.env.LTC_MNEMONIC;
  if (!wif && !mnemonic) {
    usage();
    process.exitCode = 1;
    return;
  }

  const fromAddress = getArg("from") || process.env.LTC_FROM || DEFAULT_FROM_ADDRESS;
  const derivationPath = getArg("path") || process.env.LTC_DERIVATION_PATH || DEFAULT_PATH;
  const mnemonicPassphrase = getArg("passphrase") || process.env.LTC_MNEMONIC_PASSPHRASE || "";
  const payload = getArg("payload")
    ? JSON.parse(getArg("payload"))
    : DEFAULT_PRESIGN_PAYLOAD;

  let privateKey;
  let compressed = true;
  if (wif) {
    const decoded = decodeWif(wif);
    privateKey = decoded.privateKey;
    compressed = decoded.compressed;
  } else {
    privateKey = derivePrivateKeyFromMnemonic(mnemonic, derivationPath, mnemonicPassphrase);
  }
  if (!compressed) throw new Error("P2WPKH requires a compressed public key");

  const pubkey = publicKeyFromPrivate(privateKey, true);
  const derivedAddress = p2wpkhAddress(pubkey);
  if (derivedAddress !== fromAddress) {
    throw new Error(`Private key does not match sender address. derived=${derivedAddress} expected=${fromAddress}`);
  }

  const tx = parseTx(payload.hex);
  const values = Array.isArray(payload.value) ? payload.value : [];
  const outputs = tx.outputs.map(outputSummary);
  const inputTotalSats = values.reduce((sum, value) => sum + Number(value), 0);
  const outputTotalSats = outputs.reduce((sum, output) => sum + output.valueSats, 0);
  const signed = signP2wpkh(tx, values, privateKey, pubkey);
  const signedHex = signed.toString("hex");
  const witnessTxid = Buffer.from(hash256(signed)).reverse().toString("hex");
  const legacyTxid = Buffer.from(hash256(serializeBaseTx({ ...tx, inputs: tx.inputs.map((input) => ({ ...input, script: Buffer.alloc(0) })) }))).reverse().toString("hex");
  const inspection = inspectSignedSegwitTx(signedHex);
  const senderScriptPubKey = p2wpkhScriptPubKeyFromAddress(fromAddress).toString("hex");

  const result = {
    chain: "litecoin",
    fromAddress,
    derivedAddress,
    derivationPath: wif ? undefined : derivationPath,
    inputScriptType: payload.inputScriptType || "p2wpkh",
    changeScriptType: payload.changeScriptType,
    receiveScriptType: payload.receiveScriptType,
    senderScriptPubKey,
    inputCount: tx.inputs.length,
    inputs: tx.inputs.map((input, index) => inputSummary(input, Number(values[index]))),
    outputCount: tx.outputs.length,
    outputs,
    feeSats: inputTotalSats - outputTotalSats,
    feeLtc: (inputTotalSats - outputTotalSats) / 1e8,
    scriptSigLengths: inspection.scriptSigLengths,
    scriptSigsAreEmpty: inspection.scriptSigsAreEmpty,
    txid: legacyTxid,
    wtxid: witnessTxid,
    signedHex,
  };

  if (!inspection.scriptSigsAreEmpty) {
    throw new Error(`Invalid P2WPKH signature: scriptSig lengths are ${inspection.scriptSigLengths.join(",")}`);
  }

  if (hasFlag("broadcast")) {
    result.broadcast = await broadcastHex({
      url: getArg("broadcast-url") || process.env.LTC_BROADCAST_URL || DEFAULT_BROADCAST_URL,
      chain: "litecoin",
      hex: signedHex,
      address: fromAddress,
    });
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
