/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { galleryAPI } from "../env/apiEndpoints";
import { RUNTIME_DEV } from "./runtimeFlags";

const normalizeNFTDetail = (payload) => {
  if (!payload || typeof payload !== "object") return payload;
  const { mint: rawMintAddress, tokenId, ...rest } = payload;
  return {
    ...rest,
    mint: tokenId ?? rawMintAddress ?? "",
    mintAddress: rawMintAddress ?? "",
  };
};

/**
  * Query NFT details
 * @param {string} chain
 * @param {string} tokenContractAddress
 * @param {string} tokenId
 * @returns {Promise<Object|null>}
 */
export const queryNFTDetail = async (chain, tokenContractAddress, tokenId) => {
  if (!galleryAPI.enabled) {
    return null;
  }

  const detailRequestBody = {
    chain,
    tokenContractAddress,
    tokenId,
    type: "okb",
  };

  // Request parameter printing
  if (RUNTIME_DEV) {
    try {
      console.log(
        "[NFT] Request queryNFTDetail ->",
        galleryAPI.queryNFTDetails,
        detailRequestBody
      );
    } catch {}
  }

  try {
    const res = await fetch(galleryAPI.queryNFTDetails, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(detailRequestBody),
    });

    // Collect response meta information
    const status = res.status;
    const contentType =
      (res.headers && res.headers.get && res.headers.get("Content-Type")) || "";

    const text = await res.text();

    // Non-JSON or empty responses print the original text fragment directly.
    if (!text || contentType.includes("text/html")) {
      console.log("[NFT] queryNFTDetail non-JSON or empty response", {
        status,
        contentType,
        textPreview: String(text).slice(0, 500),
      });
      return null;
    }

    // Safely parse JSON and print original text on failure
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.log(
        "[NFT] queryNFTDetail JSON parse failed:",
        e?.message || e,
        "| status:",
        status,
        "| content-type:",
        contentType,
        "| raw (first 500 chars):",
        String(text).slice(0, 500)
      );
      return null;
    }

    if (RUNTIME_DEV) {
      try {
        console.log(
          "[NFT] Response status:",
          status,
          "ok:",
          res.ok,
          "code:",
          json?.code
        );
      } catch {}
    }

    // Compatible code is a string or number
    const okCode = json?.code === "0" || json?.code === 0;

    if (okCode) {
      // If data is an array, return the first item; if it is an object, return the object
      if (Array.isArray(json.data) && json.data.length > 0) {
        return normalizeNFTDetail(json.data[0]);
      }
      if (json.data && typeof json.data === "object") {
        return normalizeNFTDetail(json.data);
      }
    }

    return json;
  } catch (error) {
    console.log("Error querying NFT details", error);
    return null;
  }
};
