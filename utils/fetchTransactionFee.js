/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
/**
 * Get on-chain handling fees
 * @param {Object} params
 * @param {string} params.selectedQueryChainName - currently selected chain name
 * @param {Function} params.setFee - Set referral fee
 * @param {Function} params.setRapidFee - Set rapid fee
 * @param {Object} params.accountAPI - API object, requires blockchainFee field
 */
const LOG_YELLOW = "\x1b[33m";
const LOG_RESET = "\x1b[0m";
const logFeeApi = (message) => {
  console.log(`${LOG_YELLOW}${message}${LOG_RESET}`);
};
const FEE_API_TAG = "blockchain-fee";

export const fetchTransactionFee = async ({
  selectedQueryChainName,
  setFee,
  setRapidFee,
  accountAPI,
}) => {
  if (
    !accountAPI?.enabled ||
    String(accountAPI?.blockchainFee || "").includes(".example.invalid")
  ) {
    setFee?.("");
    setRapidFee?.("");
    return;
  }

  try {
    const postData = {
      chain: selectedQueryChainName,
      type: "",
    };

    logFeeApi(
      `[FEE_API][REQUEST] endpoint=${FEE_API_TAG} body=${JSON.stringify(postData)}`,
    );

    const response = await fetch(accountAPI.blockchainFee, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      console.log("❌ HTTP Error:", response.status, response.statusText);
      return;
    }

    const data = await response.json();

    logFeeApi(
      `[FEE_API][RESPONSE] endpoint=${FEE_API_TAG} code=${data?.code} msg=${data?.msg}`,
    );

    if (data && data.data) {
      let { rapidFee, recommendedFee } = data.data;

      // Unified stringification and numerical validation
      const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : NaN;
      };
      const isValid = (v) => {
        const n = toNum(v);
        return Number.isFinite(n) && n > 0;
      };

      // The two values ​​on the server side should be returned at the same time; if one side is missing, use the other side to cover it up.
      if (!isValid(recommendedFee) && isValid(rapidFee)) {
        console.log("⚠️ recommendedFee is missing or invalid, use rapidFee to find out");
        recommendedFee = rapidFee;
      }
      if (!isValid(rapidFee) && isValid(recommendedFee)) {
        console.log("⚠️ rapidFee is missing or invalid, use recommendedFee to find out");
        rapidFee = recommendedFee;
      }

      logFeeApi(
        `[FEE_API][PARSED] endpoint=${FEE_API_TAG} chain=${selectedQueryChainName} recommended=${recommendedFee} rapid=${rapidFee}`,
      );

      // Final backfill to state (string)
      setFee(String(recommendedFee ?? ""));
      console.log("✅ Fee set to:", recommendedFee);

      setRapidFee(String(rapidFee ?? ""));
      console.log("✅ Rapid fee set to:", rapidFee);
    } else {
      console.log("❌ No data.data field, skip the setting fee");
    }
  } catch (error) {
    console.log("❌ Failed to fetch processing Fee:", error);
  }
};
