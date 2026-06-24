/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */

export const PUBLIC_BETA_HARDWARE_VERSION = "0.5";

const normalizeDeviceVersion = (version) => String(version || "").trim();

export const isPublicBetaHardwareVersion = (version) =>
  normalizeDeviceVersion(version).startsWith(PUBLIC_BETA_HARDWARE_VERSION);
