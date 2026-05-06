/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { isBchCashAddr, isBchLegacyAddress } from "../config/networkUtils";
import { getBtcAddressType } from "./btcAddress";
import { getLtcAddressType } from "./ltcAddress";

export const resolveTransportAddrFormat = (chainName, address = "") => {
  const normalizedChain = String(chainName || "").trim().toLowerCase();
  const normalizedAddress = String(address || "").trim();

  if (normalizedChain === "bitcoin") {
    return getBtcAddressType(normalizedAddress) || "nested_segwit";
  }

  if (normalizedChain === "bitcoin_cash" || normalizedChain === "bitcoincash") {
    if (isBchLegacyAddress(normalizedAddress)) return "legacy";
    if (isBchCashAddr(normalizedAddress)) return "cashaddr";
    return "cashaddr";
  }

  if (normalizedChain === "litecoin") {
    return getLtcAddressType(normalizedAddress) || "nested_segwit";
  }

  return "";
};
