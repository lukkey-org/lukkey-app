/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
/**
  * Handle address verification logic (generic)
 * @param {Object} params
  * @param {string} params.queryChainShortName - chain short name
  * @param {Object=} params.device - optional, parsed device object
  * @param {Array} params.verifiedDevices - Array of verified device IDs
  * @param {Array} params.devices - Array of device objects
  * @ param {Function} params.setAddressModalVisible - Control address Modal display
  * @param {Function} params.setBleVisible - Control Bluetooth Modal display
  * @param {Function} params.displayDeviceAddress - display device address function
  * @param {Function} params.setIsVerifyingAddress - Set verification status
  * @param {Function} params.setAddressVerificationMessage - Set verification message
  * @param {Function} params.t - international translation function
 */
import { ensureDeviceReady } from "./ensureDeviceReady";

let _verifyAddressPrepareInFlight = false;

export async function handleVerifyAddress({
  queryChainShortName,
  bchAddressType,
  btcAddressType,
  ltcAddressType,
  device,
  verifiedDevices,
  devices,
  setAddressModalVisible,
  setBleVisible,
  displayDeviceAddress,
  setIsPreparingVerifyAddress,
  setIsVerifyingAddress,
  setAddressVerificationMessage,
  t,
  setVerificationStatus,
  setCheckStatusModalVisible,
  openExclusiveModal,
  openBleModal,
  bleManagerRef,
}) {
  const resolvedOpenBleModal =
    typeof openBleModal === "function"
      ? openBleModal
      : typeof openExclusiveModal === "function"
        ? () => openExclusiveModal(() => setBleVisible(true))
        : undefined;

  if (_verifyAddressPrepareInFlight) {
    console.log("[VERIFY_ADDR] skipped:prepare-in-flight", {
      ts: Date.now(),
      queryChainShortName,
    });
    return;
  }
  _verifyAddressPrepareInFlight = true;
  try {
    setIsPreparingVerifyAddress?.(true);
  } catch {}

  try {
    console.log("[VERIFY_ADDR] handleVerifyAddress:start", {
      ts: Date.now(),
      queryChainShortName,
      deviceId: device?.id || null,
      devicesLength: Array.isArray(devices) ? devices.length : -1,
      verifiedDevices: Array.isArray(verifiedDevices) ? verifiedDevices : [],
      bchAddressType,
      btcAddressType,
      ltcAddressType,
    });

    let readyResult = await ensureDeviceReady({
      device,
      devices,
      verifiedDevices,
      setBleVisible,
      openBleModal: resolvedOpenBleModal,
      bleManagerRef,
    });

    console.log("[VERIFY_ADDR] ensureDeviceReady:first", {
      ts: Date.now(),
      ok: !!readyResult?.ok,
      reason: readyResult?.reason || null,
      readyDeviceId: readyResult?.device?.id || null,
    });

    if (!readyResult?.ok) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 450));
      } catch {}
      console.log("[VERIFY_ADDR] ensureDeviceReady:retrying", {
        ts: Date.now(),
      });
      readyResult = await ensureDeviceReady({
        device,
        devices,
        verifiedDevices,
        setBleVisible,
        openBleModal: resolvedOpenBleModal,
        bleManagerRef,
      });
      console.log("[VERIFY_ADDR] ensureDeviceReady:second", {
        ts: Date.now(),
        ok: !!readyResult?.ok,
        reason: readyResult?.reason || null,
        readyDeviceId: readyResult?.device?.id || null,
      });
    }

    const { ok, device: readyDevice } = readyResult || {};

    if (!ok || !readyDevice) {
      console.log("[VERIFY_ADDR] abort:not-ready", {
        ts: Date.now(),
        reason: readyResult?.reason || null,
      });
      try {
        setIsVerifyingAddress?.(false);
      } catch {}
      try {
        setAddressVerificationMessage?.("");
      } catch {}
      try {
        setAddressModalVisible(false);
      } catch {}
      return;
    }

    console.log("[VERIFY_ADDR] displayDeviceAddress:start", {
      ts: Date.now(),
      readyDeviceId: readyDevice?.id || null,
      queryChainShortName,
    });

    await displayDeviceAddress(
      readyDevice,
      queryChainShortName,
      bchAddressType,
      btcAddressType,
      ltcAddressType,
      setIsVerifyingAddress,
      setAddressVerificationMessage,
      t,
      setVerificationStatus,
      setCheckStatusModalVisible,
      setAddressModalVisible,
      typeof openExclusiveModal === "function"
        ? () => openExclusiveModal(() => setCheckStatusModalVisible?.(true))
        : null
    );
  } finally {
    try {
      setIsPreparingVerifyAddress?.(false);
    } catch {}
    _verifyAddressPrepareInFlight = false;
  }
}

/**
  * Vault-specific handleVerifyAddress, parameter name is compatible with selectedCardChainShortName
 * @param {Object} params
  * @param {string} params.selectedCardChainShortName - chain short name
  * The remaining parameters are the same as handleVerifyAddress
 */
export function handleVerifyAddressForVault(params) {
  return handleVerifyAddress({
    ...params,
    queryChainShortName: params.selectedCardChainShortName,
  });
}
