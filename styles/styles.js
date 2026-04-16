/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { StyleSheet, Dimensions, Platform } from "react-native";
import {
  FONT_SIZE_12,
  FONT_SIZE_15,
  FONT_SIZE_16,
  FONT_SIZE_20,
  FONT_SIZE_22,
  FONT_SIZE_28,
  FONT_SIZE_34,
  RADIUS_8,
  RADIUS_10,
  RADIUS_12,
  RADIUS_16,
  RADIUS_20,
  RADIUS_30,
} from "./constants";

import {
  buttonBase,
  modalPanelBase,
  textCenterMuted,
  containerBase,
  cardBase,
  iconBase,
  borderButtonBase,
  modalHeaderBase,
  cardShadow,
  noImageContainer,
  noImageLogo,
  noImageText,
} from "./baseStyles";

const centerAll = { justifyContent: "center", alignItems: "center" };
const rowCenter = { flexDirection: "row", alignItems: "center" };
const rowBetween = { ...rowCenter, justifyContent: "space-between" };
const flex1Center = { flex: 1, ...centerAll };
const listItemBase = {
  width: "100%",
  padding: 10,
  ...rowBetween,
  borderRadius: RADIUS_10,
};
const colShrink = { flexDirection: "column", flexShrink: 1 };
const rowMb4 = { ...rowCenter, marginBottom: 4 };
const rowMb8 = { ...rowCenter, marginBottom: 8 };
const makeText = (color, size, weight, extra = {}) => ({
  color,
  fontSize: size,
  ...(weight ? { fontWeight: weight } : {}),
  ...extra,
});

const createThemeTokens = (isDarkMode) => {
  const primitives = createSharedPrimitives(isDarkMode);
  return {
    text: isDarkMode ? "#fff" : "#21201E",
    mainBg: isDarkMode ? "#21201E" : "#fff",
    modalBg: primitives.modalBg,
    inputBg: isDarkMode ? primitives.inputBg : "#ddd",
    searchBg: isDarkMode ? "#121212" : "#E3E3E8",
    mutedText: primitives.mutedTextDark,
    overlay: "rgba(108, 108, 244, 0.1)",
    historyItemText: "#000",
    roundBtnBg: "#4B4642",
    lightTheme: "#CCB68C", // Fixed value, keep as-is
    historyItemBorder: "#ccc",
    subtitleText: "#e0e0e0",
    white: primitives.white,

    accentPrimary: primitives.brandPrimary,
    accentFixed: "#CCB68C",
  };
};

const createSharedHelpers = (tokens) => {
  const panel = (opts = {}) => ({
    ...modalPanelBase,
    backgroundColor: tokens.modalBg,
    ...opts,
  });
  const panelBg = (bg, opts = {}) => ({
    ...modalPanelBase,
    backgroundColor: bg,
    ...opts,
  });
  const mkBtn = (bg, extra = {}) => ({
    ...buttonBase,
    backgroundColor: bg,
    ...extra,
  });
  const mkBorderBtn = (color, extra = {}) => ({
    ...buttonBase,
    borderWidth: 1,
    borderColor: color,
    ...extra,
  });
  const makeFilledButton = mkBtn;
  const makeOutlineButton = mkBorderBtn;
  const createPanel = panel;
  const createPanelWithBg = panelBg;

  return {
    panel,
    panelBg,
    mkBtn,
    mkBorderBtn,
    makeFilledButton,
    makeOutlineButton,
    createPanel,
    createPanelWithBg,
  };
};

const createFieldStyles = (tokens) => {
  const roundedInput = {
    backgroundColor: tokens.inputBg,
    padding: 10,
    borderRadius: RADIUS_10,
    height: 60,
    ...centerAll,
  };
  const searchBg = tokens.searchBg;

  return {
    searchIcon: {
      marginLeft: 8,
      marginRight: 6,
      color: tokens.mutedText,
    },
    searchContainer: {
      ...rowCenter,
      borderRadius: RADIUS_10,
      alignSelf: "stretch",
      backgroundColor: searchBg,
      marginBottom: 16,
      height: 36,
      paddingHorizontal: 8,
    },
    searchContainerLarge: {
      ...rowCenter,
      borderRadius: RADIUS_10,
      alignSelf: "stretch",
      backgroundColor: searchBg,
      marginBottom: 16,
      height: 40,
      paddingHorizontal: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: RADIUS_10,
      color: tokens.text,
      fontSize: 15,
    },
    inputBase: roundedInput,
    inputAmount: { ...roundedInput, marginVertical: 8 },
    inputMt20: { ...roundedInput, marginTop: 20 },
    inputMt30: { ...roundedInput, marginTop: 30 },
    passwordInput: {
      backgroundColor: tokens.inputBg,
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: RADIUS_10,
      height: 50,
      width: "100%",
      color: tokens.text,
    },
  };
};

const createSharedPrimitives = (isDarkMode) => ({
  white: "#fff",
  textBase: isDarkMode ? "#fff" : "#000",
  modalBg: isDarkMode ? "#4B4642" : "#fff",
  inputBg: isDarkMode ? "#21201E" : "#e0e0e0",
  brandPrimary: isDarkMode ? "#CCB68C" : "#CFAB95",
  brandBtnBg: isDarkMode ? "#CCB68C" : "#E5E1E9",
  borderLight: isDarkMode ? "#7F7F84" : "#ccc",
  mutedTextDark: isDarkMode ? "#ccc" : "#7F7F84",
});

const memoizeByArg = (fn) => {
  const cache = new Map();
  return (isDarkMode) => {
    const key = isDarkMode ? 1 : 0;
    if (cache.has(key)) return cache.get(key);
    const value = fn(isDarkMode);
    cache.set(key, value);
    return value;
  };
};

const createThemeStyles = (isDarkMode) => {
  const c = createThemeTokens(isDarkMode);
  const tokens = c;
  const { panel, mkBtn, mkBorderBtn, makeFilledButton, makeOutlineButton } =
    createSharedHelpers(c);
  const fields = createFieldStyles(c);
  const fieldStyles = fields;
  const text16Bold = {
    color: c.text,
    fontSize: FONT_SIZE_16,
    fontWeight: "bold",
  };

  return StyleSheet.create({
    settingsText: { marginLeft: 10, fontSize: FONT_SIZE_16, color: c.text },
    titleText: makeText(c.text, FONT_SIZE_28, "bold", { marginBottom: 20 }),
    container: {
      flex: 1,
      backgroundColor: c.inputBg,
      ...centerAll,
      padding: 20,
    },
    headerStyle: { backgroundColor: c.mainBg },
    headerRight: { backgroundColor: c.inputBg },
    addIconButton: { backgroundColor: c.mainBg },
    addIcnBtnCom: {
      marginRight: 16,
      borderRadius: RADIUS_16,
      width: 28,
      height: 28,
      ...centerAll,
    },
    dropdown: {
      position: "absolute",
      right: 20,
      top: 100,
      backgroundColor: c.modalBg,
      borderRadius: RADIUS_8,
      padding: 10,
      zIndex: 1,
    },
    dropdownButton: { padding: 10 },
    droBtnTxt: { color: c.text, fontSize: FONT_SIZE_16 },
    scrollView: { width: "100%" },
    contentContainer: { flexGrow: 1 },
    settingsItem: {
      ...rowCenter,
      justifyContent: "flex-start",
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: "#363639",
    },
    safeArea: { flex: 1, backgroundColor: c.inputBg },
    card: {
      width: 300,
      height: 170,
      borderRadius: RADIUS_20,
      overflow: "hidden",
      ...centerAll,
      backgroundColor: c.modalBg,
      marginBottom: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
    },
    text: text16Bold,
    textBold16: text16Bold,
    roundButton: {
      backgroundColor: c.roundBtnBg,
      borderRadius: RADIUS_30,
      paddingVertical: 10,
      paddingHorizontal: 20,
      width: "100%",
      height: 60,
      ...centerAll,
      marginBottom: 20,
    },
    subButtonText: { color: c.subtitleText, fontSize: FONT_SIZE_12 },
    centeredView: flex1Center,
    modalView: panel({ height: 500 }),
    subtitleText: makeText(c.subtitleText, FONT_SIZE_16, null, {
      textAlign: "center",
      marginBottom: 320,
    }),
    langMdlTtl: makeText(c.white, FONT_SIZE_20, "bold", { marginBottom: 30 }),
    lockCodeMdlTxt: makeText(c.white, FONT_SIZE_16, null, {
      textAlign: "left",
      marginBottom: 10,
    }),
    languageList: { maxHeight: 320, width: 280 },
    langCnclBtn: mkBtn(c.lightTheme, {
      width: "90%",
      borderRadius: RADIUS_30,
      height: 60,
      ...centerAll,
      position: "absolute",
      bottom: 30,
    }),
    historyContainer: {
      marginTop: 20,
      padding: 20,
      backgroundColor: c.inputBg,
      ...centerAll,
      borderRadius: RADIUS_10,
      height: 360,
    },
    white: makeText(c.white, FONT_SIZE_16, null, { textAlign: "center" }),

    historyItem: {
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.historyItemBorder,
    },
    historyItemText: { fontSize: FONT_SIZE_16, color: c.historyItemText },
    modalText: { color: c.white, textAlign: "center", marginBottom: 120 },
    optionButton: mkBtn(c.lightTheme, { marginBottom: 10 }),
    optionButtonText: { color: c.white },
    input: { ...fields.inputMt30, marginBottom: 60 },
    submitButton: mkBtn(c.lightTheme, { marginBottom: 0 }),
    cancelButton: mkBtn(c.lightTheme, { position: "absolute", bottom: 60 }),
    submitButtonText: { color: c.white },
    cancelButtonText: { color: c.mutedText },
  });
};

const stylesFactory = memoizeByArg(createThemeStyles);
export const lightTheme = stylesFactory(false);
export const darkTheme = stylesFactory(true);
export default stylesFactory;
export const makeSharedHelpers = createSharedHelpers;
export { createThemeTokens };
export { createFieldStyles };
export { createSharedPrimitives };
export const makeSharedPrimitives = createSharedPrimitives;

// Shared blocks used across multiple screen style factories
const createCommonStyles = (c, { panel }) => ({
  cancelButtonText: makeText(
    c.text === "#fff" || c.text === "#FFFFFF"
      ? c.mutedText
      : "#4B4642" ||
          c.mutedText,
    FONT_SIZE_16,
  ),
  bluetoothImg: { width: 220, height: 220, marginBottom: 30 },
  btModalTitle: makeText(c.text, FONT_SIZE_20, "bold", { marginBottom: 10 }),
  btModalView: panel({ height: 500, justifyContent: "space-between" }),
  BluetoothBtnText: { color: c.white, fontSize: FONT_SIZE_16 },
  centeredView: flex1Center,
  deviceItemCtr: {
    ...rowCenter,
    justifyContent: "center",
    marginTop: 20,
  },
  disconnectButton: {
    marginLeft: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#CCB68C",
    borderRadius: 5,
  },
  disconnectText: { color: c.white, fontWeight: "bold" },
  searchIcon: { paddingLeft: 10, color: c.text },
  buttonTextWhite: { color: c.white, fontSize: FONT_SIZE_16 },
  addressButtonTextWhite: { color: c.white, fontSize: FONT_SIZE_16 },
  textButtonWhite16: { color: c.white, fontSize: FONT_SIZE_16 },
  bluetoothButtonText: { color: c.white, fontSize: FONT_SIZE_16 },
  errorText: { color: "#FF5252", fontSize: FONT_SIZE_15 },
  modalTitle16: { color: c.text, fontSize: FONT_SIZE_16, fontWeight: "bold" },
  modalTitle20: { color: c.text, fontSize: FONT_SIZE_20, fontWeight: "bold" },
  securityCodeModalTitle: makeText(c.text, FONT_SIZE_20, "bold", {
    marginBottom: 15,
  }),
  chainIconDefault24: {
    width: 24,
    height: 24,
    marginRight: 8,
    borderRadius: RADIUS_12,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  chainIconSelected24: {
    width: 24,
    height: 24,
    marginRight: 8,
    borderRadius: RADIUS_12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  addressTextMuted15: {
    color: c.mutedText,
    flexWrap: "nowrap",
    fontSize: FONT_SIZE_15,
  },
  chainTagText15: { fontSize: FONT_SIZE_15, color: c.text },
  dropdownButtonText16: { color: c.text, fontSize: FONT_SIZE_16 },
  dropdownButtonText15: { color: c.text, fontSize: FONT_SIZE_15 },
  textCenter16: { color: c.text, fontSize: FONT_SIZE_16, textAlign: "center" },
  logInfoHeader: { justifyContent: "space-between", alignItems: "flex-end" },
  panelSB: panel({ justifyContent: "space-between" }),
  panelH500SB: panel({ height: 500, justifyContent: "space-between" }),
  panelH600SB: panel({ height: 600, justifyContent: "space-between" }),
  panelH360SB: panel({ height: 360, justifyContent: "space-between" }),
  panelH420: panel({ height: 420 }),
  panelH420SB: panel({ height: 420, justifyContent: "space-between" }),
  panelH340SB: panel({
    height: 340,
    justifyContent: "space-between",
  }),
  dropdownListPanel: {
    width: "100%",
    maxHeight: 300,
    backgroundColor: c.inputBg,
    borderRadius: RADIUS_10,
    padding: 10,
    zIndex: 999,
    overflow: "hidden",
  },

  dropdownCardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
export const makeCommonStyles = createCommonStyles;
// Screen Lock: legacy static styles (non-themed)
export const screenLockStyles = StyleSheet.create({
  container: { ...flex1Center, padding: 20 },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  subTitle: {
    fontSize: FONT_SIZE_16,
    marginTop: 10,
  },
  input: {
    width: "100%",
    height: 50,
    borderRadius: RADIUS_8,
    paddingHorizontal: 15,
    paddingRight: 50,
    marginBottom: 20,
    fontSize: 18,
  },
  passwordInputWr: {
    ...rowCenter,
    width: "100%",
    position: "relative",
    borderRadius: 16,
  },
  eyeIcon: {
    position: "absolute",
    right: 15,
    top: 25,
    transform: [{ translateY: -12 }],
    ...centerAll,
  },
  button: { width: "100%", height: 50, ...centerAll, borderRadius: 25 },
  lostPwdContainer: {
    marginTop: 30,
    alignItems: "center",
  },
  lostPasswordText: {
    fontSize: FONT_SIZE_16,
  },
  modalBackground: flex1Center,
  modalView: {
    backgroundColor: "#fff",
    borderRadius: 36,
    padding: 20,
    alignItems: "center",
    width: "80%",
  },
  white: {
    fontSize: FONT_SIZE_20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  modalText: {
    fontSize: FONT_SIZE_16,
    textAlign: "center",
    marginBottom: 20,
  },
  closeButton: {
    width: "100%",
    height: 60,
    ...centerAll,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: FONT_SIZE_20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
});
// Screen Lock: theme-aware styles
const createScreenLockStyles = (isDarkMode) => {
  const s = createSharedPrimitives(isDarkMode);
  const brand = s.brandPrimary;
  const containerBg = isDarkMode ? "#21201E" : "#fff";
  const titleColor = isDarkMode ? "#F2F2F7" : "#333";
  const subTitleColor = isDarkMode ? "#ccc" : "#999";
  const inputBg = isDarkMode ? "#121212" : "#f1f1f1";
  const inputText = isDarkMode ? "#fff" : "#000";
  const placeholder = "#999";
  const buttonBg = brand;
  const modalBg = isDarkMode ? "#21201E" : "#fff";
  const lostPasswordColor = isDarkMode ? "#CCB68C" : "#CFAB95";

  return StyleSheet.create({
    lostPasswordText: { color: lostPasswordColor },
    container: { backgroundColor: containerBg },
    title: { color: titleColor },
    subTitle: { color: subTitleColor },

    input: {
      color: inputText,
      backgroundColor: inputBg,
    },
    placeholder: { color: placeholder },

    button: { backgroundColor: buttonBg },
    buttonText: makeText("#fff", 18, "bold", { textAlign: "center" }),

    modalView: { backgroundColor: modalBg },
    modalTitle: makeText(titleColor, FONT_SIZE_20, "bold", {
      textAlign: "center",
      marginBottom: 10,
    }),
    modalText: { color: subTitleColor },
    closeButton: { backgroundColor: buttonBg },
    white: { color: titleColor },
    buttonTextWhite: { color: "#fff", fontSize: FONT_SIZE_16 },
  });
};
export const ScreenLockStylesRoot = memoizeByArg(createScreenLockStyles);

// Activity Screen: theme tokens + styles
const createActivityTokens = (isDarkMode) => {
  const s = createSharedPrimitives(isDarkMode);
  return {
    text: s.textBase,
    white: s.white,
    bg: isDarkMode ? "#121212" : "#F2F2F7",
    btnColor: s.brandPrimary,
    buttonBg: s.brandBtnBg,
    historyContainerBg: isDarkMode ? "#22201F" : "#FFFFFF",
    historyItemBorder: isDarkMode ? "#ccc" : "#999",
    inputBg: s.inputBg,
    searchBg: isDarkMode ? "#121212" : "#E3E3E8",
    modalBg: s.modalBg,
    secondBtnText: isDarkMode ? "#ddd" : "#e0e0e0",
    secondText: s.mutedTextDark,
    selectedChainTagBg: isDarkMode ? s.brandPrimary : "#ccc",
    selChnTagTxt: isDarkMode ? "#000" : "#fff",

    textColor: s.textBase,
    screenBg: isDarkMode ? "#121212" : "#F2F2F7",
    primaryButtonColor: s.brandPrimary,
    primaryButtonBg: s.brandBtnBg,
    mutedText: s.mutedTextDark,
    secondaryButtonText: isDarkMode ? "#ddd" : "#e0e0e0",
    historyContainerBackground: isDarkMode ? "#22201F90" : "#FFFFFF80",
    historyItemBorderColor: isDarkMode ? "#ccc" : "#999",
    selectedChainTagBackground: isDarkMode ? s.brandPrimary : "#ccc",
    selectedChainTagForeground: isDarkMode ? "#000" : "#fff",
  };
};
export const makeActivityTokens = createActivityTokens;

const createActivityScreenStyles = (isDarkMode) => {
  const c = createActivityTokens(isDarkMode);
  const { panel, mkBtn, mkBorderBtn, createPanel } = createSharedHelpers(c);
  const common = createCommonStyles(c, { panel });
  const fields = createFieldStyles(c);
  return StyleSheet.create({
    chainTagText: common.chainTagText15,
    convertTokenIcon: {
      width: 30,
      height: 30,
      borderRadius: RADIUS_10,
      marginRight: 8,
    },
    convertTokenSm: { ...common.chainIconSelected24 },
    convertTokenTo: {
      width: 14,
      height: 14,
      backgroundColor: "#CFAB9540",
      marginRight: 8,
      resizeMode: "contain",
      borderRadius: RADIUS_10,
    },
    convertTokenToLg: {
      width: 30,
      height: 30,
      borderRadius: 15,
      marginRight: 10,
    },
    convertScrollRow: {
      height: 34,
      paddingHorizontal: 10,
    },
    convertTagBtn: {
      ...rowCenter,
      paddingVertical: 5,
      paddingHorizontal: 10,
      marginRight: 8,
      borderRadius: 6,
    },
    convertTagDark: {
      backgroundColor: "#4B4642",
    },
    convertTagLight: {
      backgroundColor: "#e0e0e0",
    },
    convertTagDkSel: {
      backgroundColor: "#E5E1E9",
    },
    convertTagLtSel: {
      backgroundColor: "#E5E1E9",
    },
    convertToAllDark: {
      backgroundColor: "#6B5F5B",
    },
    convertToAllLt: {
      backgroundColor: "#DADADA",
    },
    convertToAllDkUn: {
      backgroundColor: "#4B4642",
    },
    convertToAllLtUn: {
      backgroundColor: "#F0F0F0",
    },
    convertTagDis: {
      opacity: 0.4,
    },
    convertTextInput: {
      fontSize: 26,
      fontWeight: "bold",
      textAlign: "left",
    },
    convertSubtitle: {
      textAlign: "left",
      width: "100%",
      marginLeft: 12,
    },
    convertModalTtl: {
      marginBottom: 6,
    },
    convertBtnSwap: {
      marginBottom: 30,
      alignItems: "flex-end",
      width: "100%",
    },

    convertBtnLeft: {
      flex: 1,
      marginLeft: 10,
      borderRadius: 15,
    },
    convertRateText: makeText(c.text, 14, null, {
      textAlign: "center",
      width: "100%",
    }),
    convertFlex1: { flex: 1 },
    convertSection: { zIndex: 20, marginBottom: 30 },
    convertAlign: { alignItems: "flex-start", width: "100%" },
    convertSection2: { zIndex: 10, marginBottom: 20 },
    convertMb6: { marginBottom: 6 },
    convertMt20: { marginTop: 20 },
    convertBtnRow: {
      marginTop: 20,
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    searchIcon: fields.searchIcon,
    searchInput: fields.searchInput,
    searchContainer: fields.searchContainer,
    fromDropdown: {
      position: "absolute",
      top: 100,
      ...common.dropdownListPanel,
    },
    toDropdown: {
      position: "absolute",
      top: 70,
      ...common.dropdownListPanel,
    },
    chainTag: { paddingVertical: 10, paddingHorizontal: 15 },
    selectedChainTag: { backgroundColor: c.selectedChainTagBg },
    title: { color: c.text },
    selChnTagTxt: { color: c.selChnTagTxt },
    container: { flex: 1, alignItems: "center" },
    modalContainer: {
      flex: 1,
      ...centerAll,
      backgroundColor: "rgba(0, 0, 0, 0.8)",
    },
    swapSection: {
      width: 300,
      padding: 20,
      backgroundColor: "#1c1c1e",
      borderRadius: RADIUS_10,
      marginVertical: 10,
    },
    swapInpCtr: {
      width: "100%",
      ...rowBetween,
      borderWidth: 1,
      borderColor: c.btnColor,
      borderRadius: RADIUS_10,
      padding: 10,
    },
    swapInput: {
      width: "100%",
      minHeight: 40,
      maxHeight: 80,
      paddingHorizontal: 10,
      color: c.text,
      textAlignVertical: "top",
    },
    tokenSelect: {
      alignSelf: "stretch",
      flexShrink: 1,
      ...rowBetween,
    },
    tokenSelectText: { color: c.white, marginRight: 5 },
    swapButton: {
      backgroundColor: c.btnColor,
      padding: 6,
      borderRadius: 50,
      marginTop: -10,
      alignSelf: "flex-end",
    },
    amountInput: fields.inputAmount,
    amountModalView: panel({ justifyContent: "center", flex: 0 }),
    amountSubtitle: makeText(c.secondText, FONT_SIZE_15, null, {
      marginBottom: 20,
    }),
    addressText: common.addressTextMuted15,
    balMdlSub: makeText(c.text, FONT_SIZE_15, null, {
      marginTop: 6,
      marginBottom: 16,
    }),
    assetMdlSub: makeText(c.text, FONT_SIZE_16, null, { marginTop: 6 }),
    balanceLabel: { marginTop: 6, color: c.text, fontSize: FONT_SIZE_12 },
    AssetsValue: { color: c.text, fontSize: FONT_SIZE_12 },
    balanceSubtitle: makeText(c.secondText, FONT_SIZE_15, null, {
      marginBottom: 6,
    }),
    bgContainer: {
      flex: 1,
      backgroundColor: c.bg,
      alignItems: "center",

      paddingBottom: 20,
    },
    blurBackground: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: RADIUS_10,
    },
    blurView: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: RADIUS_10,
    },
    bluetoothImg: common.bluetoothImg,
    btModalTitle: common.btModalTitle,
    btModalView: common.btModalView,
    BluetoothBtnText: common.BluetoothBtnText,
    buttonText: makeText(c.white, FONT_SIZE_16, "bold", { marginBottom: 2 }),
    cancelButton: mkBorderBtn(c.btnColor),
    cancelBtnLooking: mkBorderBtn(c.btnColor, { marginTop: 20 }),
    cancelBtnRecv: mkBorderBtn(c.btnColor, { marginTop: 20 }),
    cancelButtonText: common.cancelButtonText,
    cancelAddrBtn: mkBorderBtn(c.btnColor),
    cancelAddressBtn: mkBorderBtn(c.btnColor, {
      flex: 1,
      borderRadius: RADIUS_16,
    }),
    cardContainer: {
      backgroundColor: c.modalBg,
      borderRadius: RADIUS_20,
      padding: 30,
      alignItems: "center",
      width: "90%",
    },
    centeredView: common.centeredView,
    confirmModalView: common.panelSB,
    deviceItemCtr: common.deviceItemCtr,
    disconnectButton: common.disconnectButton,
    disconnectText: common.disconnectText,
    historyContainer: {
      ...centerAll,
      borderRadius: RADIUS_20,
      width: "100%",
      flex: 1,
    },
    historyItem: { padding: 10, marginBottom: 10 },
    historyItemText: makeText(c.text, FONT_SIZE_16, null, { marginBottom: 10 }),
    historyTitle: makeText(c.text, FONT_SIZE_16, "bold"),
    input: fields.inputMt20,
    inputModelView: panel({ height: 400 }),
    mainButtonText: {
      color: c.text,
      fontSize: FONT_SIZE_15,
      fontWeight: "bold",
      marginVertical: 10,
    },
    mainSubBtnTxt: makeText(c.historyItemBorder, FONT_SIZE_12, null, {
      textAlign: "center",
    }),
    recvModalTitle: common.modalTitle16,
    modalSubtitle: makeText(c.secondText, FONT_SIZE_15, null, {
      textAlign: "center",
    }),
    modalText: { color: c.secondText, textAlign: "center" },
    modalTitle: common.modalTitle16,
    errorModalView: panel({ justifyContent: "center", alignItems: "center" }),
    errModalCloseBtn: mkBorderBtn(c.btnColor, {
      width: "100%",
      borderRadius: 16,
    }),
    modalView: common.panelH500SB,
    ConvertModalView: common.panelSB,
    swapModalView: common.panelH500SB,
    noHistoryText: makeText(c.secondText, FONT_SIZE_16, null, {
      textAlign: "center",
    }),
    swapCnfmBtn: mkBtn(c.btnColor, {
      width: 280,
      borderRadius: RADIUS_30,
    }),
    optionButton: mkBtn(c.btnColor, { borderRadius: 15, marginBottom: 16 }),
    optionButtonText: { color: c.white },
    passwordInput: fields.passwordInput,
    pendingModalView: common.panelSB,
    secCodeTitle: common.securityCodeModalTitle,
    secCodeModalViewActivity: {
      position: "absolute",
      top: 100,
      ...common.panelH360SB,
    },
    receiveModalView: common.panelH600SB,
    roundButton: {
      borderWidth: 1,
      borderColor: c.btnColor,
      backgroundColor: c.historyContainerBg,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: RADIUS_20,
      ...centerAll,
    },
    scanModalSub: { color: c.secondText, fontSize: FONT_SIZE_15 },
    subButtonText: { color: c.secondBtnText, fontSize: FONT_SIZE_12 },
    submitButton: mkBtn(c.btnColor, { borderRadius: 15 }),
    submitButtonText: common.buttonTextWhite,
    subtitleText: {
      fontSize: FONT_SIZE_15,
      color: c.secondText,
      textAlign: "center",
      flexWrap: "wrap",
    },
    txModalTitle: makeText(c.text, FONT_SIZE_16, null, {
      textAlign: "center",
      marginBottom: 20,
      lineHeight: 30,
    }),
    transactionText: makeText(c.secondText, FONT_SIZE_16, null, {
      marginBottom: 10,
    }),
    verifyAddrBtn: mkBtn(c.btnColor, {
      borderRadius: RADIUS_30,
      marginBottom: 16,
    }),
    verifyAddressBtn: mkBtn(c.btnColor, {
      flex: 1,
      borderRadius: RADIUS_16,
      marginBottom: 16,
    }),
    chainSelectRow: {
      ...rowBetween,
      width: "100%",
    },
    chainIconDefault: common.chainIconDefault24,
    chainButton: {
      ...rowCenter,
      justifyContent: "flex-end",
      alignSelf: "flex-end",
      flexShrink: 1,
      flexWrap: "wrap",
      marginLeft: 8,
    },
    chainButtonWrap: {
      width: "100%",
      alignSelf: "center",
      alignItems: "flex-end",
    },
    chainIconSel: common.chainIconSelected24,
    flatList: {
      flex: 1,
      width: "100%",
      borderRadius: RADIUS_10,
      marginTop: 10,
      alignSelf: "flex-end",
    },
    logoInfo: { flex: 1, alignItems: "flex-end" },
    logInfoHeader: common.logInfoHeader,
    errorText: common.errorText,
    addrBtnText: common.addressButtonTextWhite,
    buttonTextWhite: common.buttonTextWhite,
    addrBtnText16: common.addressButtonTextWhite,
    btnTextWhite16: common.buttonTextWhite,
  });
};
export const ActivityScreenStylesRoot = memoizeByArg(
  createActivityScreenStyles,
);

// Secure Device Screen: theme tokens + styles
const createSecureDeviceTokens = (isDarkMode) => {
  const s = createSharedPrimitives(isDarkMode);
  return {
    text: s.textBase,
    white: s.white,
    bg: isDarkMode ? "#121212" : "#F2F2F7",
    modalBg: s.modalBg,
    currencyModalBg: isDarkMode ? "#4B4642" : "#f7f7f7",
    buttonBg: s.brandPrimary,
    btnBorder: s.brandPrimary,
    border: isDarkMode ? "#363639" : "#EEEEEF",
    inputBg: s.inputBg,
    searchBg: isDarkMode ? "#121212" : "#E3E3E8",
    secondText: s.mutedTextDark,

    textColor: s.textBase,
    screenBg: isDarkMode ? "#121212" : "#F2F2F7",
    buttonBgPrimary: s.brandPrimary,
    buttonBorderColor: s.brandPrimary,
    borderColor: isDarkMode ? "#363639" : "#ccc",
    mutedText: s.mutedTextDark,
  };
};
export const makeSecureDeviceTokens = createSecureDeviceTokens;

const createSecureDeviceScreenStyles = (isDarkMode) => {
  const c = createSecureDeviceTokens(isDarkMode);

  const { panel, panelBg, mkBtn, mkBorderBtn, createPanel } =
    createSharedHelpers(c);
  const common = createCommonStyles(c, { panel });
  const fields = createFieldStyles(c);
  const btnFilled = mkBtn(c.buttonBg);
  const btnFilledMb15 = mkBtn(c.buttonBg, { marginBottom: 15 });
  const btnBorderPrimary = mkBorderBtn(c.buttonBg);
  const btnBorderAlt = mkBorderBtn(c.btnBorder);

  return StyleSheet.create({
    addrBookFlex: { flex: 1 },
    addrBookMb20: { marginBottom: 20 },
    addrBookRel8: { position: "relative", marginBottom: 8 },
    addrBookMl10: { marginLeft: 10 },
    addrBookMb10: { marginBottom: 10 },
    addrBookW100: { width: "100%" },
    addrBookErrTxt: { color: "red" },
    addrBookMaxH200: { maxHeight: 200, borderRadius: RADIUS_10 },
    addrBookIcon24: { ...common.chainIconSelected24, marginRight: 10 },
    addrBookItem: listItemBase,
    addrBookCol: colShrink,
    addrBookRow: rowMb4,
    addrBookNetTxt: {
      fontSize: FONT_SIZE_16,
    },
    addrBookNetImg: { ...common.chainIconSelected24, marginHorizontal: 5 },
    addrBookNetName: {
      fontSize: 14,
    },
    addrBookNameRow: rowMb8,
    addrBookNameTxt: {
      fontSize: FONT_SIZE_16,
    },
    addrBookNameVal: {
      fontSize: 14,
      flexShrink: 1,
    },
    addrBookAddrTxt: {
      fontSize: FONT_SIZE_16,
      flexShrink: 1,
    },
    addrBookAddrVal: {
      fontSize: 14,
    },

    // Aliases with clearer names (non-breaking, duplicate definitions)
    flex1: { flex: 1 },
    mb20: { marginBottom: 20 },
    relativeMb8: { position: "relative", marginBottom: 8 },
    ml10: { marginLeft: 10 },
    mb10: { marginBottom: 10 },
    wFull: { width: "100%" },
    textDanger: { color: "red" },
    maxH200Rounded10: { maxHeight: 200, borderRadius: RADIUS_10 },
    icnRou24Mr10: { ...common.chainIconSelected24, marginRight: 10 },
    listIteTouch: listItemBase,
    listCol: colShrink,
    listRow: rowMb4,
    networkText16: {
      fontSize: FONT_SIZE_16,
    },
    networkIcon24Mr5: { ...common.chainIconSelected24, marginRight: 5 },
    networkName14: {
      fontSize: 14,
    },
    nameRow: rowMb8,
    nameText16: {
      fontSize: FONT_SIZE_16,
    },
    nameValue14: {
      fontSize: 14,
    },
    addrTxt16Shr: {
      fontSize: FONT_SIZE_16,
      flexShrink: 1,
    },
    addressValue14: {
      fontSize: 14,
    },

    // More descriptive aliases for Address Book (non-breaking duplicates)
    addrBkListIte: listItemBase,
    addrBkListCol: colShrink,
    addrBkListRow: rowMb4,
    abNetIcon24: { ...common.chainIconSelected24, marginRight: 5 },
    abNetText16: { fontSize: FONT_SIZE_16 },
    abNetName14: { fontSize: 14 },
    addrBkNameRow: rowMb8,
    abNameText16: { fontSize: FONT_SIZE_16 },
    abNameVal14: { fontSize: 14 },
    abAddrText16: { fontSize: FONT_SIZE_16, flexShrink: 1 },
    abAddrVal14: { fontSize: 14 },
    addressInput: {
      backgroundColor: c.inputBg,
      padding: 15,
      paddingTop: 15,
      borderRadius: RADIUS_10,
      height: 90,
      width: "100%",
      color: c.text,
    },
    addressModalView: panel({
      justifyContent: "space-between",
      padding: 20,
      borderRadius: 36,
    }),
    bluetoothImg: common.bluetoothImg,
    btModalTitle: common.btModalTitle,
    btModalView: common.btModalView,
    BluetoothBtnText: common.BluetoothBtnText,
    buttonContainer: {
      flexDirection: "column",
      alignItems: "center",
      width: "100%",
    },
    addrBkCtr: {
      ...rowCenter,
      width: "100%",
      gap: 10,
    },
    buttonText: { color: c.text, fontSize: FONT_SIZE_16 },
    cancelButton: btnBorderAlt,
    cancelBtnLooking: mkBorderBtn(c.buttonBg, { marginTop: 20 }),
    cancelButtonText: common.cancelButtonText,
    centeredView: common.centeredView,
    changeLockModal: panel({ justifyContent: "space-between" }),
    closeButton: btnBorderPrimary,
    backButton: mkBorderBtn(c.buttonBg, { flex: 1, borderRadius: 15 }),
    container: {
      flex: 1,
      backgroundColor: c.bg,
      ...centerAll,
      paddingTop: 10,
    },
    contentContainer: { flexGrow: 1 },
    currMdlView: panelBg(c.currencyModalBg, { height: 420 }),
    deviceIcon: { paddingRight: 4 },
    deviceItemCtr: common.deviceItemCtr,
    deviceNameRow: {
      ...rowCenter,
      flexShrink: 1,
      flexGrow: 1,
      marginLeft: 0,
    },
    signalBars: {
      flexDirection: "row",
      alignItems: "flex-end",
      height: 14,
      marginLeft: 6,
    },
    disLockMdlView: {
      ...panel(),
    },
    disconnectButton: common.disconnectButton,
    disconnectText: common.disconnectText,
    discMdlView: common.panelSB,
    discSub: makeText(c.secondText, FONT_SIZE_15, null, {
      textAlign: "center",
      marginTop: 20,
    }),
    dropdown: {
      position: "absolute",
      right: 20,
      top: 2,
      backgroundColor: c.modalBg,
      borderRadius: 5,
      paddingVertical: 8,
      paddingHorizontal: 16,
      zIndex: 101,
      ...common.dropdownCardShadow,
    },
    droBtnTxt: common.dropdownButtonText15,
    enLockMdlView: {
      position: "absolute",
      top: 60,
      ...panel({ justifyContent: "space-between", maxHeight: 480 }),
    },
    errorText: { ...common.errorText, marginBottom: 10, width: 280 },
    eyeIcon: {
      position: "absolute",
      right: 15,
      top: 12,
      ...centerAll,
    },
    Icon: { marginRight: 6 },
    focusedInput: { borderColor: c.buttonBg, borderWidth: 2 },
    focusedSearchBox: { borderColor: c.buttonBg, borderWidth: 2 },
    langCnclBtn: mkBorderBtn(c.buttonBg, {
      width: "90%",
      position: "absolute",
      bottom: 30,
      marginTop: 20,
    }),
    languageList: { maxHeight: 290, width: 280 },
    langMdlTxt: { ...common.textCenter16, marginBottom: 10 },
    currMdlTxt: common.textCenter16,
    langMdlTtl: makeText(c.text, FONT_SIZE_20, "bold", { marginBottom: 30 }),
    langMdlView: common.panelH420,
    listContainer: { flexDirection: "row", alignItems: "center", flex: 1 },
    modalTitle: { ...common.modalTitle16 },
    modalSubtitle: makeText(c.secondText, FONT_SIZE_15, null, {
      textAlign: "center",
    }),
    modalView: panel(),
    passwordInput: { ...fields.passwordInput, marginBottom: 10 },
    passwordInputWr: {
      ...rowCenter,
      width: "100%",
      position: "relative",
    },
    lockCodeMdlTxt: makeText(c.text, FONT_SIZE_16, null, {
      textAlign: "left",
      marginBottom: 10,
    }),
    lockCodeMdlTtl: makeText(c.text, FONT_SIZE_20, "bold", { marginBottom: 8 }),
    secCodeTitle: common.securityCodeModalTitle,
    secCodeModalViewSecureDevice: {
      position: "absolute",
      top: 100,
      ...common.panelSB,
    },
    roundButton: {
      backgroundColor: c.buttonBg,
      borderRadius: RADIUS_30,
      paddingVertical: 10,
      paddingHorizontal: 20,
      width: "100%",
      height: 60,
      ...centerAll,
      marginBottom: 20,
    },
    scanModalSub: makeText(c.secondText, FONT_SIZE_15, null, {
      textAlign: "center",
    }),
    searchContainer: fields.searchContainerLarge,
    searchIcon: fields.searchIcon,
    searchInput: fields.searchInput,
    setLocCodMdlView: panel({ justifyContent: "space-between" }),
    settingsItem: {
      ...rowCenter,
      justifyContent: "flex-start",
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },

    // Group card style (iOS settings style)
    groupCard: {
      marginHorizontal: 16,
      marginVertical: 10,
      borderRadius: RADIUS_12,
      overflow: "hidden",
      backgroundColor: c.modalBg,
      borderWidth: 0,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    groupRow: {
      ...rowCenter,
      minHeight: 48,
      paddingHorizontal: 16,
    },
    groupDivider: {
      height: 1,
      backgroundColor: c.border,
      marginLeft: 56,
    },
    groupIconWrap: {
      width: 30,
      height: 30,
      ...centerAll,
      marginRight: 10,
    },
    groupRightText: makeText(c.secondText, FONT_SIZE_15),
    groupDangerText: {
      color: "#FF5252",
    },
    scrollView: { width: "100%" },
    submitButton: btnFilledMb15,
    statMdlCloBtn: btnFilled,
    confirmButton: btnFilled,
    optionButton: mkBtn(c.buttonBg, { borderRadius: 16, marginBottom: 10 }),
    optionButtonText: common.buttonTextWhite,
    saveButton: mkBtn(c.buttonBg, { flex: 1, borderRadius: 15 }),
    submitButtonText: { color: c.text, fontSize: FONT_SIZE_16 },
    buttonTextWhite: common.buttonTextWhite,
    addrBtnText: common.addressButtonTextWhite,
    Text: { color: c.text, fontSize: FONT_SIZE_16 },
    btnTextWhite16: common.buttonTextWhite,
    addrBtnText16: common.addressButtonTextWhite,
    textPrimary16: { color: c.text, fontSize: FONT_SIZE_16 },
  });
};
export const SecureDeviceScreenStylesRoot = memoizeByArg(
  createSecureDeviceScreenStyles,
);

// Vault Screen: theme tokens + styles
const createVaultTokens = (isDarkMode) => {
  const s = createSharedPrimitives(isDarkMode);
  return {
    white: s.white,
    mutedText: isDarkMode ? s.mutedTextDark : "#999",
    bg: isDarkMode ? "#121212" : "#F2F2F7",
    modalBg: s.modalBg,
    btnBg: s.brandBtnBg,
    btnColor: s.brandPrimary,
    tagBg: "#CFAB9540",
    shadow: "#0E0D0D",
    cardBg: isDarkMode ? s.modalBg : s.brandBtnBg,
    text: s.textBase,
    currencyUnit: isDarkMode ? s.mutedTextDark : "#666",
    border: s.borderLight,
    inputBg: s.inputBg,
    searchBg: isDarkMode ? "#121212" : "#E3E3E8",
  };
};

export const makeVaultTokens = createVaultTokens;

const createVaultScreenStyles = (isDarkMode) => {
  const c = createVaultTokens(isDarkMode);
  const { panel, mkBtn, mkBorderBtn, createPanel } = createSharedHelpers(c);
  const fields = createFieldStyles(c);
  const common = createCommonStyles(c, { panel });
  const { height } = Dimensions.get("window");
  const screenWidth = Dimensions.get("window").width;
  const cardWidth = screenWidth * 0.9;
  const cardHeight = cardWidth * (206 / 326);
  const cardOverlapVisible = 76; // keep original overlap distance (206 - 130)
  const cardStackMargin = cardOverlapVisible - cardHeight;
  const addWalletCardWidth = screenWidth * 0.9;
  const addWalletCardHeight = addWalletCardWidth * (206 / 326);
  const actionRowGap = 24;
  const tabLabelFontSize = FONT_SIZE_20;
  const tabRowHeight = Math.round(tabLabelFontSize * 1.2);
  const tabContainerTop = cardHeight + actionRowGap;
  const containerHeight = height - (Platform.OS === "android" ? 280 : 380);
  const btnBg = mkBtn(c.btnBg);
  const btnBgMt20 = mkBtn(c.btnBg, { marginTop: 20 });
  const btnColor = mkBtn(c.btnColor);
  const btnColorMt20 = mkBtn(c.btnColor, { marginTop: 20 });
  const btnColorMb20 = mkBtn(c.btnColor, { marginBottom: 20 });
  const btnBorderBg = mkBorderBtn(c.btnColor);
  const btnBorderBgMt20 = mkBorderBtn(c.btnColor, { marginTop: 20 });
  const btnBorderMuted = mkBorderBtn(c.mutedText);

  return StyleSheet.create({
    // The pull-down refresh prompt level is raised to avoid being blocked by cards.
    refreshTipView: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 20,
      elevation: 20,
    },
    refreshTipText: { color: "#888" },

    chainAllIcon: common.chainIconDefault24,
    chnSelIcn: common.chainIconSelected24,
    phWra: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#aaaaaa",
      overflow: "hidden",
    },
    shimmerBar: { width: "30%", height: "100%" },
    nftModalImage: { width: "100%", aspectRatio: 1, borderRadius: RADIUS_8 },
    nftNoImgCtr: { ...noImageContainer },
    nftNoImageLogo: { ...noImageLogo },
    nftNoImageText: { ...noImageText },
    aniTabCtr: {
      flexDirection: "column",
      justifyContent: "flex-start",
      alignItems: "center",
      position: "absolute",
      zIndex: 10000,
      top: tabContainerTop,
      height: containerHeight,
    },
    linearGradient: {
      flex: 1,
      height,
      backgroundColor: c.bg,
      ...centerAll,
    },
    scrollView: { width: "100%", paddingHorizontal: 0 },
    emptyWalletPage: {
      flex: 1,
      width: "100%",
      justifyContent: "flex-start",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    emptyWltCont: {
      width: "100%",

      alignItems: "center",
    },
    getStartedHintArea: {
      flex: 1,
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    getStartedHintText: makeText(c.mutedText, 17, null, {
      textAlign: "center",
    }),
    emptyWltFtr: {
      width: "100%",
      flex: 1,
      ...centerAll,
    },
    emptyWltFtr: {
      marginTop: 0,
    },
    scrViewCont: { justifyContent: "start", alignItems: "center" },
    centeredView: { ...containerBase },
    galleryItem: { width: "50%", padding: 4 },
    galleryCard: {
      ...cardShadow,
      backgroundColor: c.modalBg,
      padding: 10,
      aspectRatio: 2 / 3,
      position: "relative",
      borderRadius: RADIUS_20,
      justifyContent: "space-between",
      alignItems: "center",
    },
    galleryImage: { width: "100%", aspectRatio: 1, borderRadius: RADIUS_8 },
    galNoImgBox: { ...noImageContainer },
    galNoImgLog: { ...noImageLogo },
    galNoImgTxt: { ...noImageText },
    galleryCardTitle: makeText(c.text, FONT_SIZE_16, "bold", { marginTop: 8 }),
    galCarB: {
      flex: 1,
      width: "100%",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    galCarBCol: { flexDirection: "column" },
    galleryEmptyBox: {
      width: "100%",
      height: containerHeight,
      ...centerAll,
      paddingHorizontal: 20,
    },
    galleryEmptyText: makeText(c.currencyUnit, FONT_SIZE_16, null, {
      textAlign: "center",
    }),
    nftCardBottom: {
      width: 40,
      height: 40,
      borderRadius: RADIUS_8,
      resizeMode: "contain",
      marginRight: 8,
    },
    cardContainer: {
      position: "relative",
      marginBottom: cardStackMargin,
      borderRadius: 26,
    },
    card: {
      ...cardBase,
      width: cardWidth,
      height: cardHeight,
      backgroundColor: c.cardBg,
    },

    assetPageCard: {
      ...cardBase,
      width: cardWidth,
      height: cardHeight,
      backgroundColor: c.cardBg,
      marginBottom: 0,
    },

    cardFirst: {
      shadowOffset: { width: 0, height: 0 },
      shadowColor: c.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 5,
    },
    cardOthers: {
      shadowOffset: { width: 0, height: -10 },
      shadowColor: c.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 30,
      elevation: 5,
    },
    addWalletImage: {
      width: addWalletCardWidth,
      height: addWalletCardHeight,
      borderRadius: RADIUS_20,
      overflow: "hidden",
      ...centerAll,
      backgroundColor: c.cardBg,
      shadowOffset: { width: 0, height: 0 },
      shadowColor: c.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    addWltImgBd: { borderRadius: RADIUS_20 },
    addWalletButton: {
      width: "100%",
      height: "100%",
      ...centerAll,
    },
    addWltBtnTxt: makeText(c.white, FONT_SIZE_20, "bold"),
    cardIcon: { ...iconBase, width: 40, height: 40 },
    chainIcon: { ...iconBase, width: 14, height: 14 },
    carIcnCtr: {
      position: "absolute",
      top: 16,
      left: 16,
      width: 40,
      height: 40,
      ...centerAll,
      borderRadius: RADIUS_20,
      backgroundColor: "#ffffff50",
      overflow: "hidden",
    },
    carChnIcnWra: {
      position: "absolute",
      top: 42,
      left: 44,
      width: 16,
      height: 16,
      borderWidth: 1,
      borderColor: "#ffffff80",
      ...centerAll,
      borderRadius: RADIUS_16,
      backgroundColor: "#ffffff80",
      overflow: "hidden",
    },
    cardActionRow: {
      width: "100%",
      paddingHorizontal: 12,
      ...rowBetween,
      position: "absolute",
      bottom: 12,
      alignSelf: "center",
    },
    expActRow: {
      width: cardWidth,
      ...rowBetween,
      alignSelf: "center",
    },
    cardActionButton: {
      flex: 1,
      height: 48,
      paddingVertical: 0,
      borderRadius: 12,
      // borderWidth: 1,
      // borderColor: isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
      backgroundColor: c.cardBg,
      ...centerAll,
    },
    carActBtnL: { marginRight: 12 },
    carActBtnTxt: makeText(
      isDarkMode ? "#fff" : "#21201E",
      FONT_SIZE_16,
      "600",
    ),
    TagChainIcon: {
      width: 14,
      height: 14,
      backgroundColor: c.tagBg,
      marginRight: 8,
      resizeMode: "contain",
      borderRadius: RADIUS_10,
    },
    cardShortName: { color: c.white, fontSize: FONT_SIZE_15 },
    balanceShortName: { color: c.white, fontSize: FONT_SIZE_15 },
    priceChangeView: {
      position: "absolute",
      display: "flex",
      flexDirection: "row",
      gap: 10,
      top: 48,
      right: 16,
      color: c.white,
      fontSize: FONT_SIZE_15,
    },
    cardBalance: {
      position: "absolute",
      top: 16,
      right: 16,
      color: c.white,
      fontSize: FONT_SIZE_16,
      fontWeight: "bold",
    },
    carBalCen: makeText(c.white, FONT_SIZE_28, "bold", { marginBottom: 8 }),
    balShortNameCtr: { color: c.white, fontSize: FONT_SIZE_15 },
    chainScrollView: { marginBottom: 10, height: 34, paddingHorizontal: 10 },
    chainTag: {
      ...rowCenter,
      paddingVertical: 5,
      paddingHorizontal: 10,
      marginRight: 8,
      borderRadius: RADIUS_8,
      backgroundColor: isDarkMode ? "#21201E" : "#F8F6FE",
    },
    selectedChainTag: { backgroundColor: c.btnBg },
    chainTagText: common.chainTagText15,
    selChnTagTxt: { color: c.text },
    chainContainer: {
      backgroundColor: c.tagBg,
      alignSelf: "flex-start",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: RADIUS_8,
    },
    chainText: { fontSize: FONT_SIZE_12, fontWeight: "bold" },
    chainCardText: { color: c.text, fontSize: FONT_SIZE_12 },
    cardName: { fontSize: FONT_SIZE_16, fontWeight: "bold" },
    // Increase the level of the total assets column to avoid being covered by cards
    totalBalanceWrap: {
      width: "90%",
      height: 80,
      marginBottom: 20,
      position: "relative",
      zIndex: 20,
      elevation: 20,
    },
    totalBalanceText: {
      fontSize: FONT_SIZE_16,
      marginVertical: 10,
      color: c.mutedText,
      textAlign: "left",
    },
    ttlBalAmo: makeText(c.text, FONT_SIZE_34, "bold", { textAlign: "left" }),
    currencyUnit: {
      marginLeft: 8,
      fontSize: FONT_SIZE_16,
      textAlign: "left",
      color: c.currencyUnit,
      fontWeight: "normal",
    },
    historyList: { width: cardWidth },
    historyItem: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.mutedText,
    },
    historyItemText: makeText(c.text, FONT_SIZE_16, null, { marginBottom: 10 }),
    noHistoryText: makeText(c.mutedText, FONT_SIZE_16, null, {
      textAlign: "center",
    }),
    historyTitle: {
      height: 40,
      textAlign: "left",
      textAlignVertical: "center",
      lineHeight: 40,
      width: cardWidth,
      fontSize: FONT_SIZE_16,
      color: c.text,
      fontWeight: "bold",
    },
    historyContainer: {
      width: "100%",
      padding: 20,
      ...centerAll,
      height: 300,
    },
    priceContainer: { width: "100%", paddingHorizontal: 20, flex: 1 },
    searchContainer: fields.searchContainer,
    searchInput: fields.searchInput,
    searchIcon: fields.searchIcon,
    Button: btnBgMt20,
    submitButton: btnBgMt20,
    verifyAddrBtn: btnBgMt20,
    verifyAddressBtn: mkBtn(c.btnColor, {
      flex: 1,
      borderRadius: RADIUS_16,
      marginBottom: 16,
    }),
    buttonPrimary: btnBgMt20,
    buttonVerifyAddr: btnBgMt20,
    alertModalButton: btnBgMt20,
    disabledButton: btnBgMt20,
    modalButton: btnColorMb20,
    saveToDeviceBtn: {
      ...btnColor,
      ...centerAll,
    },
    addModalButton: btnColorMt20,
    NFTButton: { ...btnBg, borderRadius: RADIUS_16 },
    GallerySendBtn: { ...btnBorderBg, borderRadius: RADIUS_16 },
    cancelAddrBtn: btnBorderBg,
    cancelAddressBtn: { ...borderButtonBase, borderColor: c.btnColor, flex: 1 },
    cancelBtnCrypto: {
      ...btnBorderBg,
      width: 326,
      position: "relative",
      bottom: 0,
    },
    cancelBtnCard: {
      ...btnBorderMuted,
      width: 326,
      position: "relative",
    },
    cancelButton: btnBorderBgMt20,
    cancelButtonNoMt: btnBorderBg,
    rmMdlBtn: btnBg,
    rmCnclBtn: btnBorderBgMt20,
    cancelBtnLooking: btnBorderBgMt20,
    disconnectButton: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      backgroundColor: c.btnBg,
      borderRadius: RADIUS_8,
      marginLeft: 10,
    },
    disconnectText: common.disconnectText,
    submitButtonText: common.buttonTextWhite,
    mainButtonText: common.buttonTextWhite,
    cancelButtonText: common.cancelButtonText,
    ButtonText: { color: c.text, fontSize: FONT_SIZE_16 },
    btnTextWhite16: common.buttonTextWhite,
    addrBtnText16: common.addressButtonTextWhite,
    NFTButtonText: makeText(c.text, FONT_SIZE_16, null, {
      textAlign: "center",
    }),
    confirmText: {
      ...common.buttonTextWhite,
      textAlign: "center",
      width: "100%",
    },
    disabledText: { color: "#ccc", fontSize: FONT_SIZE_16 },
    buttonColorText: common.buttonTextWhite,
    cardModalView: {
      height: "100%",
      width: "100%",
      justifyContent: "flex-end",
      alignItems: "center",
      position: "absolute",
      bottom: 0,
      zIndex: 2,
    },
    modalView: panel(),
    deleteModalView: panel(),
    phraseModalView: panel(),
    receiveModalView: common.panelH600SB,
    btModalView: common.btModalView,
    pendingModalView: common.panelH360SB,
    AddItemModalView: panel({ maxHeight: "86%" }),
    NFTmodalView: panel({
      aspectRatio: 9 / 16,
      justifyContent: "space-between",
    }),
    ContactFormModal: panel({ justifyContent: "space-between" }),
    cardModalContent: {
      width: cardWidth,
      height: cardHeight,
      ...centerAll,
      position: "relative",
    },
    modalHeader: { ...modalHeaderBase },
    modalTitle: common.modalTitle16,
    btModalTitle: common.btModalTitle,
    secCodeTitle: common.securityCodeModalTitle,
    modalSubtitle: { ...textCenterMuted(c) },
    modalSubLeft: { ...textCenterMuted(c), textAlign: "left" },

    scanModalSub: { color: c.mutedText, fontSize: FONT_SIZE_15 },

    altMdlSub: makeText(c.mutedText, FONT_SIZE_15, null, {
      width: "100%",
      marginBottom: 10,
      lineHeight: 20,
    }),
    altMdlCont: makeText(c.mutedText, FONT_SIZE_16, "bold"),
    modalIconCtr: { flexDirection: "row", alignItems: "center" },
    modalIcon: { width: 24, height: 24, marginRight: 8 },
    modalCryptoName: makeText(c.text, FONT_SIZE_16, null, {
      textAlign: "center",
    }),
    secCodeModalViewVault: {
      position: "absolute",
      top: 100,
      margin: 20,
      height: 360,
      width: "90%",
      backgroundColor: c.modalBg,
      borderRadius: RADIUS_20,
      padding: 30,
      justifyContent: "space-between",
      alignItems: "center",
    },
    passwordInput: fields.passwordInput,
    bluetoothImg: common.bluetoothImg,
    sendNftText: { ...textCenterMuted(c), marginBottom: 20, flexWrap: "wrap" },
    subtitleText: {
      ...textCenterMuted(c),
      marginBottom: 20,
      flexWrap: "wrap",
      width: 326,
    },
    addressText: common.addressTextMuted15,
    tabRow: {
      width: cardWidth,
      height: tabRowHeight,
      ...rowCenter,
      justifyContent: "flex-start",
      alignSelf: "center",
      marginTop: 16,
    },
    tabButton: {
      height: "100%",
      paddingHorizontal: 0,
      marginHorizontal: 0,
      justifyContent: "center",
      alignItems: "flex-start",
      zIndex: 11,
    },
    tabButtonLeft: { marginRight: 24 },
    activeTabButton: {},
    actTabBtnTxt: {
      fontSize: tabLabelFontSize,
      fontWeight: "bold",
      color: c.text,
      lineHeight: tabRowHeight,
      textAlignVertical: "center",
      includeFontPadding: false,
    },
    tabButtonText: {
      fontSize: 17,
      color: c.mutedText,
      lineHeight: tabRowHeight,
      textAlignVertical: "center",
      includeFontPadding: false,
    },
    deviceItemCtr: common.deviceItemCtr,
    deviceIcon: { paddingRight: 4 },
    QRImg: {
      width: 25,
      height: 25,
      resizeMode: "contain",
      position: "absolute",
      right: 0,
      top: 0,
      margin: 25,
    },
    qrImage: {
      width: 25,
      height: 25,
      resizeMode: "contain",
      position: "absolute",
      right: 0,
      top: 0,
      margin: 25,
    },
    dropdown: {
      position: "absolute",
      right: 0,
      top: 30,
      backgroundColor: c.cardBg,
      borderRadius: RADIUS_8,
      padding: 10,
      zIndex: 3,
    },
    dropdownButton: { padding: 10 },
    droBtnTxt: common.dropdownButtonText16,

    addCryptoButton: {
      width: "100%",
      padding: 6,
      backgroundColor: isDarkMode ? "#21201E" : "#F8F6FE",
      marginBottom: 6,
      borderRadius: RADIUS_16,
      display: "flex",
      alignItems: "center",
      flexDirection: "row",
    },
    icnAndTxtCtr: { flexDirection: "row", alignItems: "center" },
    addCryptoImage: {
      width: 100,
      height: 100,
      ...centerAll,
    },
    addCardIcon: { width: 30, height: 30 },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(108, 108, 244, 0.1)",
    },
    addCryptoOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderRadius: RADIUS_12,
    },
    addCrypImgTxt: {
      marginLeft: 4,
      color: c.white,
      fontWeight: "bold",
      textShadowColor: "rgba(0, 0, 0, 0.8)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 3,
    },
    addCryptoText: {
      marginRight: 4,
      color: c.mutedText,
      textAlign: "center",
    },
    BalanceView: { paddingBottom: 200 },
    modalBalLabel: makeText(c.text, FONT_SIZE_16, null, {
      textAlign: "center",
      marginTop: 40,
      marginBottom: 10,
    }),
    modalBalance: makeText(c.text, FONT_SIZE_34, null, {
      textAlign: "center",
      marginBottom: 30,
    }),
    walletInfoText: makeText("#676776", FONT_SIZE_16, null, {
      textAlign: "center",
      lineHeight: 22,
    }),
    wltInfoCtr: {
      height: "100%",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    securityTitle: makeText(c.mutedText, FONT_SIZE_22, null, {
      textAlign: "center",
      marginTop: 103,
      marginBottom: 18,
    }),
    centeredContent: {
      flex: 1,
      ...centerAll,
    },
    highlightText: { color: "#FF6347", textAlign: "left" },
    textInput: {
      width: "100%",
      height: 300,
      borderColor: c.border,
      borderWidth: 1,
      marginTop: 20,
      padding: 10,
      borderRadius: RADIUS_8,
      color: c.text,
      backgroundColor: c.inputBg,
      textAlignVertical: "top",
    },
    input: fields.inputMt20,
    addrBtnText: common.addressButtonTextWhite,
  });
};
export const VaultScreenStylesRoot = memoizeByArg(createVaultScreenStyles);
