/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
export const DEVICE_RESPONSES = {
  authId: "authId",
  valid: "VALID",
  pwdCorrectJson: "pwdCorrect",
  pwdCancelJson: "pwdCancel",
  closePincode: "closePincode",
  pwdCorrectText: "PWD_CORRECT",
  pwdCancelText: "PWD_CANCEL",
  otaFinish: "OTA_FINISH",
  otaOk: "OTA_OK",
  otaFail: "OTA_FAIL",
  imgFinish: "IMG_FINISH",
  textFinish: "TEXT_FINISH",
};

export const DEVICE_REQUESTS = {
  getOtaUnderscore: "GET_OTA_",
  getOtaSpaced: "GET OTA ",
  getImgUnderscore: "GET_IMG_",
  getImgSpaced: "GET IMG ",
  getTextUnderscore: "GET_TEXT_",
  getTextSpaced: "GET TEXT ",
  reqNftCollectText: "REQ_NFT_COLLECT",
};

export function parseIndexedDeviceRequest(
  receivedClean,
  underscorePrefix,
  spacedPrefix,
) {
  if (receivedClean.startsWith(underscorePrefix)) {
    return receivedClean.substring(underscorePrefix.length);
  }
  if (receivedClean.startsWith(spacedPrefix)) {
    return receivedClean.substring(spacedPrefix.length);
  }
  return null;
}
