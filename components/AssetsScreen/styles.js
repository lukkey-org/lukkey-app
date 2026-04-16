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
    height: 46,
    justifyContent: "space-between",
    alignItems: "flex-end",
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
