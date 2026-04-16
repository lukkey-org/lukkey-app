/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// config/mappingRegistry.js

const evmRaw =
  "arbitrum,aurora,avalanche,binance,ethereum,ethereum_classic,fantom,gnosis,cronos,iotex,linea,okb,optimism,polygon,zksync,ronin,celo";
const btcRaw = "bitcoin,bitcoin_cash,litecoin";
const tronRaw = "tron";
const solRaw = "solana";
const suiRaw = "sui";
const xrpRaw = "ripple";
const aptosRaw = "aptos";
const cosmosRaw = "cosmos,celestia,juno,osmosis";
const dogeRaw = "dogecoin";
// const cosmosRaw = "cosmos,celestia,cryptoorg,juno,osmosis";

function decodeList(raw) {
  return raw.split(",").map((s) => s.trim());
}

export const families = {
  evm: decodeList(evmRaw),
  btc: decodeList(btcRaw),
  dogecoin: decodeList(dogeRaw),
  tron: decodeList(tronRaw),
  aptos: decodeList(aptosRaw),
  cosmos: decodeList(cosmosRaw),
  sol: decodeList(solRaw),
  sui: decodeList(suiRaw),
  xrp: decodeList(xrpRaw),
};
