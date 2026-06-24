/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { families } from "../config/mappingRegistry";

const SOLANA_FALLBACK_SIGNATURE_FEE = 0.000005;
const SOLANA_FALLBACK_RENT_BUFFER = 0.001;
const SUI_FALLBACK_GAS_BUFFER = 0.004;
const TRON_FALLBACK_FEE_RESERVE = 1;

export const getNativeTransferFeeReserve = ({
  chain,
  feeAmount,
  hasFee = true,
  isXrpTransfer = false,
}) => {
  if (!hasFee) return 0;

  const normalizedChain = String(chain || "").trim().toLowerCase();
  const fee = Number(feeAmount) || 0;
  const isTronTransfer = families?.tron?.includes?.(normalizedChain);
  if (fee <= 0 && !isTronTransfer) return 0;

  if (families?.sol?.includes?.(normalizedChain)) {
    return SOLANA_FALLBACK_RENT_BUFFER + Math.max(fee * 3, SOLANA_FALLBACK_SIGNATURE_FEE);
  }

  if (families?.sui?.includes?.(normalizedChain)) {
    return Math.max(fee * 3, SUI_FALLBACK_GAS_BUFFER);
  }

  if (isXrpTransfer || families?.xrp?.includes?.(normalizedChain)) {
    return Math.max(1, fee * 12) + fee;
  }

  if (
    families?.btc?.includes?.(normalizedChain) ||
    families?.dogecoin?.includes?.(normalizedChain)
  ) {
    return fee * 5;
  }

  if (families?.evm?.includes?.(normalizedChain)) {
    return fee * 2;
  }

  if (isTronTransfer) {
    return Math.max(TRON_FALLBACK_FEE_RESERVE, fee * 3);
  }

  if (families?.aptos?.includes?.(normalizedChain)) {
    return fee * 3;
  }

  if (families?.cosmos?.includes?.(normalizedChain)) {
    return fee * 3;
  }

  return fee * 2;
};
