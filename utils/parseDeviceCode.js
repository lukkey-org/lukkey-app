/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
export function parseDeviceCode(v, k) {
  let v0 = v[0] >>> 0;
  let v1 = v[1] >>> 0;
  let sum = 0xc6ef3720 >>> 0;
  const delta = 0x9e3779b9 >>> 0;
  const k0 = k[0] >>> 0;
  const k1 = k[1] >>> 0;
  const k2 = k[2] >>> 0;
  const k3 = k[3] >>> 0;

  for (let i = 0; i < 32; i += 1) {
    v1 -= (((v0 << 4) >>> 0) + k2) ^ (v0 + sum) ^ (((v0 >>> 5) >>> 0) + k3);
    v1 >>>= 0;
    v0 -= (((v1 << 4) >>> 0) + k0) ^ (v1 + sum) ^ (((v1 >>> 5) >>> 0) + k1);
    v0 >>>= 0;
    sum -= delta;
    sum >>>= 0;
  }

  v[0] = v0 >>> 0;
  v[1] = v1 >>> 0;
}
