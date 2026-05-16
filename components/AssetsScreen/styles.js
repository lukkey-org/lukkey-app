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
    maxWidth: "100%",
  },
  cardChainText: {
    flexShrink: 1,
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
