/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */

import {
  PUBLIC_BETA_HARDWARE_VERSION,
  isPublicBetaHardwareVersion,
} from "./deviceVersionFlags";

export const RECEIVE_MULTI_ADDRESS_BLOCKED_HARDWARE_VERSION =
  PUBLIC_BETA_HARDWARE_VERSION;

export const isReceiveMultiAddressEnabled = ({
  hardwareVersion,
  runtimeDev = false,
  storageLoaded = true,
} = {}) => {
  if (runtimeDev) return true;
  if (!storageLoaded) return false;
  return !isPublicBetaHardwareVersion(hardwareVersion);
};
