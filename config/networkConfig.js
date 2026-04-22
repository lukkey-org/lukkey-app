/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// config/networkConfig.js

const fallbackNetworkImage = require("./../assets/branding/LukkeyLogo.webp");

const networkImages = {
  Arbitrum: require("./../assets/icon/ARBIcon.webp"),
  Aurora: require("./../assets/icon/AURORAIcon.webp"),
  Avalanche: require("./../assets/icon/AVAXIcon.webp"),
  Bitcoin: require("./../assets/icon/BTCIcon.webp"),
  "Bitcoin Cash": require("./../assets/icon/BCHIcon.webp"),
  "Binance Smart Chain": require("./../assets/icon/BNBIcon.webp"),
  Celo: require("./../assets/icon/CELOIcon.webp"),
  Ethereum: require("./../assets/icon/ETHIcon.webp"),
  "Ethereum Classic": require("./../assets/icon/ETCIcon.webp"),
  Fantom: require("./../assets/icon/FTMIcon.webp"),
  "Huobi ECO Chain": require("./../assets/icon/HTIcon.webp"),
  "IoTeX Network Mainnet": require("./../assets/icon/IOTXIcon.webp"),
  Litecoin: require("./../assets/icon/LTCIcon.webp"),
  // "OKX Chain": require("./../assets/icon/OKTIcon.webp"), // Disabled.
  Optimism: require("./../assets/icon/OPIcon.webp"),
  Polygon: require("./../assets/icon/PolygonIcon.webp"),
  Ripple: require("./../assets/icon/XRPIcon.webp"),
  Solana: require("./../assets/icon/SOLIcon.webp"),
  Tron: require("./../assets/icon/TRXIcon.webp"),
  "zkSync Era Mainnet": require("./../assets/icon/ZKSIcon.webp"),
  Cosmos: require("./../assets/icon/ATOMIcon.webp"),
  Celestia: require("./../assets/icon/TIAIcon.webp"),
  Cronos: require("./../assets/icon/CROIcon.webp"),
  Juno: require("./../assets/icon/JUNOIcon.webp"),
  Osmosis: require("./../assets/icon/OSMOIcon.webp"),
  Gnosis: require("./../assets/icon/GNOIcon.webp"),
  Linea: require("./../assets/icon/LINEAIcon.webp"),
  Ronin: require("./../assets/icon/RONIcon.webp"),
  Aptos: require("./../assets/icon/APTIcon.webp"),
  SUI: require("./../assets/icon/SUIIcon.webp"),
};

const networkAliases = {
  bnb: "Binance Smart Chain",
  bsc: "Binance Smart Chain",
};

const networks = [
  "Arbitrum",
  "Aurora",
  "Avalanche",
  "Bitcoin",
  "Bitcoin Cash",
  "Binance Smart Chain",
  "Celo",
  "Ethereum",
  "Ethereum Classic",
  "Fantom",
  "Huobi ECO Chain",
  "IoTeX Network Mainnet",
  "Litecoin",
  // "OKX Chain", // Disabled.
  "Optimism",
  "Polygon",
  "Ripple",
  "Solana",
  "Tron",
  "zkSync Era Mainnet",
  "Cosmos",
  "Celestia",
  "Cronos",
  "Juno",
  "Osmosis",
  "Gnosis",
  "Linea",
  "Ronin",
  "Aptos",
  "SUI",
].sort();

const getNetworkImage = (networkName) => {
  const normalizedName = String(networkName || "").trim();
  if (networkImages[normalizedName]) {
    return networkImages[normalizedName];
  }
  const aliasMatch = networkAliases[normalizedName.toLowerCase()];
  if (aliasMatch && networkImages[aliasMatch]) {
    return networkImages[aliasMatch];
  }
  return fallbackNetworkImage;
};

export { fallbackNetworkImage, getNetworkImage, networkImages, networks };
