/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { RUNTIME_DEV } from "./utils/runtimeFlags";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
// BLE packet reassembly: buffer partial notifications until \r\n (always active)
// Must load BEFORE dev_ble so that logging wraps the reassembled output.
require("./utils/bleReassemble");

if (RUNTIME_DEV) {
  require("./utils/dev_ble");
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

SplashScreen.preventAutoHideAsync();
