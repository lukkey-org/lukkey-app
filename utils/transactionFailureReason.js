/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */

export const TX_FAILURE_PENDING_UTXO =
  "This balance is already being used by a pending transaction. Wait for it to confirm, then try again.";

export const TX_FAILURE_INSUFFICIENT_TOTAL_COST =
  "Insufficient balance for transfer amount + network fee. Please add the native coin on this network and try again.";

export const isPendingUtxoConflictMessage = (message) => {
  const normalized = String(message || "").trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes("insufficient fee, rejecting replacement") ||
    normalized.includes("rejecting replacement") ||
    normalized.includes("replacement transaction underpriced") ||
    normalized.includes("txn-mempool-conflict") ||
    normalized.includes("mempool conflict") ||
    normalized.includes("bad-txns-inputs-missingorspent")
  );
};

export const isInsufficientFundsForTotalCostMessage = (message) => {
  const normalized = String(message || "").trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes("insufficient funds for gas * price + value") ||
    normalized.includes("gas * price + value") ||
    normalized.includes("insufficient balance") ||
    normalized.includes("not enough balance") ||
    normalized.includes("balance not enough") ||
    normalized.includes("余额不足")
  );
};

export const getTransactionFailureReasonKey = (message) => {
  if (isInsufficientFundsForTotalCostMessage(message)) {
    return TX_FAILURE_INSUFFICIENT_TOTAL_COST;
  }
  if (isPendingUtxoConflictMessage(message)) {
    return TX_FAILURE_PENDING_UTXO;
  }
  return "";
};
