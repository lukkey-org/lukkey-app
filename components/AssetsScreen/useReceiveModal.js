/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { useCallback } from "react";
import { resolveAssetIcon } from "../../utils/assetIconResolver";

const useReceiveModal = ({
  setSelectedCrypto,
  setSelectedAddress,
  setSelectedCryptoIcon,
  setSelectedCardChainShortName,
  setIsVerifyingAddress,
  setAddressModalVisible,
  openExclusiveModal,
}) => {
  const prepareReceiveModal = useCallback(
    (crypto) => {
      if (!crypto) return;
      setSelectedCrypto(crypto);
      setSelectedAddress(String(crypto?.address || "").trim());
      setSelectedCryptoIcon(resolveAssetIcon(crypto));
      setSelectedCardChainShortName(crypto.queryChainShortName || "");
      setIsVerifyingAddress(false);
      if (typeof openExclusiveModal === "function") {
        openExclusiveModal(() => setAddressModalVisible(true));
      } else {
        setAddressModalVisible(true);
      }
    },
    [
      setSelectedCrypto,
      setSelectedAddress,
      setSelectedCryptoIcon,
      setSelectedCardChainShortName,
      setIsVerifyingAddress,
      setAddressModalVisible,
      openExclusiveModal,
    ],
  );

  const handleQRCodePress = useCallback(
    (crypto) => {
      prepareReceiveModal(crypto);
    },
    [prepareReceiveModal],
  );

  const handleReceivePress = useCallback(
    (crypto) => {
      prepareReceiveModal(crypto);
    },
    [prepareReceiveModal],
  );

  return {
    handleQRCodePress,
    handleReceivePress,
  };
};

export default useReceiveModal;
