/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// ModalsContainer.js
import React from "react";
import ReceiveAddressModal from "../modal/ReceiveAddressModal";
import ConfirmActionModal from "../modal/ConfirmActionModal";
import BluetoothModal from "../modal/BluetoothModal";
import SecurityCodeModal from "../modal/SecurityCodeModal";
import CheckStatusModal from "../modal/CheckStatusModal";
import { resolveAssetIcon } from "../../utils/assetIconResolver";

// New introduction
import ChainSelectorModal from "../modal/ChainSelectorModal";

const ModalsContainer = ({
  selectedCardChainShortName,
  addressModalVisible,
  setAddressModalVisible,
  selectedCryptoIcon,
  selectedCrypto,
  selectedAddress,
  bchAddressType,
  bchCashAddr,
  bchLegacyAddr,
  bchAddressBalances,
  bchCashaddrBalance,
  bchLegacyBalance,
  onSwitchBchAddressType,
  btcAddressType,
  btcLegacyAddr,
  btcNestedSegwitAddr,
  btcNativeSegwitAddr,
  btcTaprootAddr,
  btcAddressBalances,
  btcLegacyBalance,
  btcNestedSegwitBalance,
  btcNativeSegwitBalance,
  btcTaprootBalance,
  getConvertedBalance,
  currencyUnit,
  onSwitchBtcAddressType,
  ltcAddressType,
  ltcLegacyAddr,
  ltcNestedSegwitAddr,
  ltcNativeSegwitAddr,
  ltcAddressBalances,
  ltcLegacyBalance,
  ltcNestedSegwitBalance,
  ltcNativeSegwitBalance,
  onSwitchLtcAddressType,
  hasVerifyAddressAttempted,
  isPreparingVerifyAddress,
  isVerifyingAddress,
  addressVerificationMessage,
  handleVerifyAddress,
  VaultScreenStyle,
  t,
  isDarkMode,
  handleWalletTest,
  handleContinue,
  processMessages,
  showLetsGoButton,
  handleLetsGo,
  isChainSelectionModalVisible,
  setChainSelectionModalVisible,
  selectedChain,
  handleSelectChain,
  cryptoCards,
  //
  deleteConfirmVisible,
  setDeleteConfirmVisible,
  handleDeleteCard,
  deleteConfirmMessage,
  navigation,
  bleVisible,
  devices,
  isScanning,
  setIsScanning,
  iconColor,
  blueToothColor,
  handleDevicePress,
  onCancelBluetooth,
  setBleVisible,
  selectedDevice,
  setSelectedDevice,
  verifiedDevices,
  handleDisconnectDevice,
  SecurityCodeModalVisible,
  pinCode,
  setPinCode,
  pinErrorMessage,
  setPinErrorMessage,
  handlePinSubmit,
  setSecurityCodeModalVisible,
  verificationStatus,
  setVerificationStatus,
  createPendingModalVisible,
  importingModalVisible,
  setCreatePendingModalVisible,
  setImportingModalVisible,
  stopMonitoringVerificationCode,
  blueToothStatus,
  onRefreshBluetooth,
  bleModalMode,
  onRecoveredVerifiedDevice,
  monitorVerificationCode,
  CheckStatusModalVisible,
  setCheckStatusModalVisible,
  missingChains,
  receivedAddresses,
  receivedPubKeys,
  prefixToShortName,
  checkStatusProgress,
  onRetryPairing,
  onCancelPinModal,
  onSendPinFail,
  txHash,
}) => {
  const resolvedCryptoName =
    typeof selectedCrypto === "string"
      ? selectedCrypto
      : selectedCrypto?.shortName || selectedCrypto?.name || "";
  const resolvedCryptoIcon =
    selectedCryptoIcon ||
    (selectedCrypto && typeof selectedCrypto === "object"
      ? resolveAssetIcon(selectedCrypto)
      : null);
  const resolvedAddress =
    String(selectedAddress || "").trim() ||
    (selectedCrypto && typeof selectedCrypto === "object"
      ? String(selectedCrypto.address || "").trim()
      : "");
  const showVerificationStatus =
    CheckStatusModalVisible && verificationStatus !== null;
  const showPendingStatus =
    !showVerificationStatus &&
    (createPendingModalVisible || importingModalVisible);
  const activeStatus = showVerificationStatus
    ? verificationStatus
    : showPendingStatus
      ? "waiting"
      : null;

  return (
    <>
      {/* Modal window showing selected cryptocurrency address */}
      <ReceiveAddressModal
        visible={addressModalVisible}
        onClose={() => setAddressModalVisible(false)}
        styleObj={VaultScreenStyle}
        cryptoIcon={resolvedCryptoIcon}
        cryptoName={resolvedCryptoName}
        address={resolvedAddress}
        bchAddressType={bchAddressType}
        bchCashAddr={bchCashAddr}
        bchLegacyAddr={bchLegacyAddr}
        bchAddressBalances={bchAddressBalances}
        bchCashaddrBalance={bchCashaddrBalance}
        bchLegacyBalance={bchLegacyBalance}
        onSwitchBchAddressType={onSwitchBchAddressType}
        btcAddressType={btcAddressType}
        btcLegacyAddr={btcLegacyAddr}
        btcNestedSegwitAddr={btcNestedSegwitAddr}
        btcNativeSegwitAddr={btcNativeSegwitAddr}
        btcTaprootAddr={btcTaprootAddr}
        btcAddressBalances={btcAddressBalances}
        btcLegacyBalance={btcLegacyBalance}
        btcNestedSegwitBalance={btcNestedSegwitBalance}
        btcNativeSegwitBalance={btcNativeSegwitBalance}
        btcTaprootBalance={btcTaprootBalance}
        getConvertedBalance={getConvertedBalance}
        currencyUnit={currencyUnit}
        onSwitchBtcAddressType={onSwitchBtcAddressType}
        ltcAddressType={ltcAddressType}
        ltcLegacyAddr={ltcLegacyAddr}
        ltcNestedSegwitAddr={ltcNestedSegwitAddr}
        ltcNativeSegwitAddr={ltcNativeSegwitAddr}
        ltcAddressBalances={ltcAddressBalances}
        ltcLegacyBalance={ltcLegacyBalance}
        ltcNestedSegwitBalance={ltcNestedSegwitBalance}
        ltcNativeSegwitBalance={ltcNativeSegwitBalance}
        onSwitchLtcAddressType={onSwitchLtcAddressType}
        hasVerifyAddressAttempted={hasVerifyAddressAttempted}
        isPreparingVerifyAddress={isPreparingVerifyAddress}
        isVerifying={isVerifyingAddress}
        verifyMsg={addressVerificationMessage}
        handleVerify={handleVerifyAddress}
        isDarkMode={isDarkMode}
        queryChainShortName={selectedCardChainShortName}
      />
      <ConfirmActionModal
        visible={deleteConfirmVisible}
        onCancel={() => {
          setDeleteConfirmVisible(false);
          navigation.setParams({ showDeleteConfirmModal: false });
        }}
        onConfirm={handleDeleteCard}
        styles={VaultScreenStyle}
        title={t("Remove Asset Card")}
        message={deleteConfirmMessage || t("This asset card will be removed")}
        cancelText={t("Cancel")}
        confirmText={t("Remove")}
        containerStyle={VaultScreenStyle.deleteModalView}
        cancelButtonStyle={[
          VaultScreenStyle.cancelButton,
          { flex: 1, marginRight: 4, borderRadius: 15 },
        ]}
        confirmButtonStyle={[
          VaultScreenStyle.addModalButton,
          { flex: 1, marginLeft: 4, borderRadius: 15 },
        ]}
        cancelTextStyle={VaultScreenStyle.cancelButtonText}
        confirmTextStyle={VaultScreenStyle.confirmText}
        iconSource={require("../../assets/animations/Delete.webp")}
        iconStyle={{ width: 200, height: 200 }}
        disableBackdropClose
      />
      {/* Bluetooth Modal */}
      <BluetoothModal
        visible={bleVisible}
        devices={devices}
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        iconColor={blueToothColor}
        handleDevicePress={handleDevicePress}
        onCancel={() => {
          if (typeof onCancelBluetooth === "function") {
            onCancelBluetooth();
          } else {
            setBleVisible(false);
            setSelectedDevice(null);
          }
        }}
        verifiedDevices={verifiedDevices}
        SecureDeviceScreenStyle={VaultScreenStyle}
        t={t}
        onDisconnectPress={handleDisconnectDevice}
        blueToothStatus={blueToothStatus}
        onRefreshPress={onRefreshBluetooth}
        workflowRecoveryMode={bleModalMode === "workflow"}
        onRecoveredVerifiedDevice={onRecoveredVerifiedDevice}
      />
      {/* PIN code input Modal */}
      <SecurityCodeModal
        visible={SecurityCodeModalVisible} // Controlling the visibility of the PIN modal
        pinCode={pinCode} // Bind PIN input status
        setPinCode={setPinCode} // State function to set PIN
        pinErrorMessage={pinErrorMessage}
        setPinErrorMessage={setPinErrorMessage}
        onSubmit={handlePinSubmit} // Logic after PIN submission
        onCancel={onCancelPinModal}
        onSendPinFail={onSendPinFail}
        styles={VaultScreenStyle}
        isDarkMode={isDarkMode}
        t={t}
        status={verificationStatus}
        selectedDevice={selectedDevice}
        onCancelConnection={async (device) => {
          try {
            // Unsubscribe and listen first, then disconnect
            try {
              monitorVerificationCode?.cancel?.();
            } catch {}
            try {
              stopMonitoringVerificationCode();
            } catch {}

            // Check if the device is connected
            const isConnected = await device.isConnected();
            if (isConnected) {
              // Cancel device connection
              await device.cancelConnection();
              console.log(`Equipment${device.id}Connection canceled`);
            }
          } catch (error) {
            console.log("Error while canceling device connection:", error);
            throw error;
          }
        }}
        onRetryPairing={onRetryPairing}
      />
      {/* Verification results Modal */}
      <CheckStatusModal
        visible={showVerificationStatus || showPendingStatus}
        status={activeStatus}
        missingChains={missingChains}
        onClose={() => {
          if (showPendingStatus) {
            if (createPendingModalVisible) {
              setCreatePendingModalVisible(false);
            } else if (importingModalVisible) {
              setImportingModalVisible(false);
            }
            stopMonitoringVerificationCode();
            return;
          }
          setCheckStatusModalVisible(false);
        }}
        progress={
          activeStatus === "waiting" && prefixToShortName
            ? (Object.keys(receivedAddresses || {}).length +
                Object.keys(receivedPubKeys || {}).filter((k) =>
                  [
                    "cosmos",
                    "ripple",
                    "celestia",
                    // "juno", // Hidden for now
                    "osmosis",
                    "aptos",
                  ].includes(k),
                ).length) /
              (Object.keys(prefixToShortName).length + 5)
            : activeStatus === "nftSaving"
              ? checkStatusProgress
              : undefined
        }
        styles={VaultScreenStyle}
        t={t}
        txHash={txHash}
        allowClose={showPendingStatus}
      />

      {/* Select the Modal of the chain */}
      <ChainSelectorModal
        isVisible={isChainSelectionModalVisible}
        onClose={() => setChainSelectionModalVisible(false)}
        selectedChain={selectedChain}
        handleSelectChain={handleSelectChain}
        cards={cryptoCards}
        isDarkMode={isDarkMode}
        t={t}
        mode="assets"
      />
    </>
  );
};

export default ModalsContainer;
