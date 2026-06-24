/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
export function byteStuffEncode(data) {
  let escapedLen = data.length;
  for (let i = 0; i < data.length; i += 1) {
    if (data[i] === 0x7d || data[i] === 0x0d || data[i] === 0x0a) {
      escapedLen += 1;
    }
  }

  const out = new Uint8Array(escapedLen);
  let w = 0;
  for (let i = 0; i < data.length; i += 1) {
    const b = data[i];
    if (b === 0x7d) {
      out[w++] = 0x7d;
      out[w++] = 0x00;
    } else if (b === 0x0d) {
      out[w++] = 0x7d;
      out[w++] = 0x01;
    } else if (b === 0x0a) {
      out[w++] = 0x7d;
      out[w++] = 0x02;
    } else {
      out[w++] = b;
    }
  }
  return out;
}

export function byteStuffDecode(data) {
  let decodedLen = 0;
  for (let i = 0; i < data.length; i += 1) {
    if (data[i] !== 0x7d) {
      decodedLen += 1;
      continue;
    }
    if (i + 1 >= data.length) throw new Error("Isolated 0x7D");
    const esc = data[i + 1];
    if (esc === 0x00 || esc === 0x01 || esc === 0x02) {
      decodedLen += 1;
    } else {
      throw new Error("Invalid escape sequence");
    }
    i += 1;
  }

  const out = new Uint8Array(decodedLen);
  let w = 0;
  for (let i = 0; i < data.length; i += 1) {
    if (data[i] !== 0x7d) {
      out[w++] = data[i];
      continue;
    }
    const esc = data[(i += 1)];
    if (esc === 0x00) out[w++] = 0x7d;
    else if (esc === 0x01) out[w++] = 0x0d;
    else if (esc === 0x02) out[w++] = 0x0a;
    else throw new Error("Invalid escape sequence");
  }
  return out;
}
