/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  cardHeaderGroup: {
    ...StyleSheet.absoluteFillObject,
  },
  cardIconGroup: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 60,
    height: 60,
  },
  cardIconPrimary: {
    top: 0,
    left: 0,
  },
  cardIconChain: {
    top: 26,
    left: 28,
  },
  cardBalanceGroup: {
    position: "absolute",
    top: 16,
    right: 16,
    maxWidth: "48%",
    height: 46,
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  cardTitleGroup: {
    position: "absolute",
    top: 13,
    left: 71,
    right: "47%",
  },
  cardTitleGroupWithAddressType: {
    right: 16,
  },
  cardTitleStack: {
    height: 46,
    justifyContent: "space-between",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  cardTitleText: {
    flexShrink: 1,
    minWidth: 0,
  },
  cardChainPill: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    maxWidth: "100%",
    backgroundColor: "#CFAB9540",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cardChainText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "bold",
  },
  cardChainRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  cardAddressTypeSelect: {
    flexShrink: 1,
    marginLeft: 8,
    zIndex: 30,
  },
  cardAddressTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: 152,
    backgroundColor: "#CFAB9540",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cardAddressTypeButtonText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "bold",
  },
  cardAddressTypeIcon: {
    marginLeft: 4,
  },
  cardAddressTypeMenu: {
    position: "absolute",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  cardAddressTypeMenuItem: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardAddressTypeMenuRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardAddressTypeMenuLabelCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  cardAddressTypeMenuBalanceCol: {
    alignItems: "flex-end",
    minWidth: 86,
  },
  cardAddressTypeMenuBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  cardAddressTypeMenuText: {
    fontSize: 16,
    lineHeight: 20,
  },
  cardAddressTypeMenuPreview: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 16,
  },
  cardAddressTypeMenuBalanceText: {
    fontSize: 15,
    lineHeight: 19,
    textAlign: "right",
  },
  cardAddressTypeMenuBalanceIcon: {
    width: 14,
    height: 14,
    marginLeft: 5,
    borderRadius: 7,
    resizeMode: "contain",
  },
  cardAddressTypeMenuFiatText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 15,
    textAlign: "right",
  },
  cardAddressTypeMenuDivider: {
    height: 1,
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  cardAddressTypeMenuTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  cardAddressTypeMenuTotalLabel: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
    fontSize: 13,
    lineHeight: 17,
  },
  cardModalBalanceToggle: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: "58%",
    minHeight: 112,
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  cardModalBalanceLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
  },
  cardBalanceInline: {
    position: "relative",
    top: 0,
    right: 0,
    left: undefined,
    bottom: undefined,
  },
  priceChangeInline: {
    position: "relative",
    top: 0,
    right: 0,
    left: undefined,
    bottom: undefined,
    alignSelf: "flex-end",
  },
});

export default styles;
