/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
export function hexStringToUint32Array(hexString) {
  return new Uint32Array([
    parseInt(hexString.slice(0, 8), 16),
    parseInt(hexString.slice(8, 16), 16),
  ]);
}

export function uint32ArrayToHexString(uint32Array) {
  return (
    uint32Array[0].toString(16).toUpperCase().padStart(8, "0") +
    uint32Array[1].toString(16).toUpperCase().padStart(8, "0")
  );
}
