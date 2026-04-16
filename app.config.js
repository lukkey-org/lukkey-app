/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// app.config.js
// ✅ Define a unified version number (shared by iOS, Android, Expo, and runtime)
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";

const sharedVersion = "0.0.7";
const isProd =
  process.env.EAS_BUILD_PROFILE === "production" ||
  process.env.NODE_ENV === "production";

const projectRoot = process.cwd();

function readOptionalFile(relPath) {
  const absPath = path.join(projectRoot, relPath);
  if (!existsSync(absPath)) return "";
  try {
    return readFileSync(absPath, "utf8");
  } catch {
    return "";
  }
}

function extractString(fileText, exportName) {
  const match = String(fileText || "").match(
    new RegExp(`export const ${exportName} = ["']([^"']+)["']`),
  );
  return match?.[1] || null;
}

function extractObjectLiteral(fileText, exportName) {
  const match = String(fileText || "").match(
    new RegExp(`export const ${exportName} = \\{([\\s\\S]*?)\\n\\};`),
  );
  if (!match) return null;
  const body = match[1];
  const result = {};
  const entryRegex = /([A-Za-z0-9_]+)\s*:\s*["']([^"']+)["']/g;
  let entry = entryRegex.exec(body);
  while (entry) {
    result[entry[1]] = entry[2];
    entry = entryRegex.exec(body);
  }
  return Object.keys(result).length > 0 ? result : null;
}

function extractUint32Array(fileText) {
  const match = String(fileText || "").match(/Uint32Array\(\[([^\]]+)\]\)/);
  if (!match) return null;
  const parts = match[1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value))
    .map((value) => value >>> 0);
  return parts.length === 4 ? parts : null;
}

function safeUrlOrigin(value) {
  try {
    return new URL(String(value || "").trim()).origin;
  } catch {
    return null;
  }
}

function safeUrlHost(value) {
  try {
    return new URL(String(value || "").trim()).host;
  } catch {
    return null;
  }
}

function loadPrivateRuntimeConfig() {
  const serviceHostsText = readOptionalFile("private/runtime/network/serviceHosts.js");
  const chainConfigText = readOptionalFile("private/runtime/network/chainConfig.js");
  const chainAuthText = readOptionalFile("private/runtime/network/chainAuth.js");
  const apiEndpointsText = readOptionalFile("private/runtime/network/apiEndpoints.js");
  const bluetoothConfigText = readOptionalFile("private/runtime/device/bluetoothConfig.js");
  const deviceAuthText = readOptionalFile("private/runtime/device/deviceAuthKey.js");

  const serviceHostsObject = extractObjectLiteral(serviceHostsText, "SERVICE_HOSTS");
  const chainHmacObject = extractObjectLiteral(chainAuthText, "CHAIN_HMAC");
  const pushApiObject = extractObjectLiteral(apiEndpointsText, "pushAPI");
  const externalLinksObject = extractObjectLiteral(apiEndpointsText, "externalLinks");
  const firmwareApiObject = extractObjectLiteral(apiEndpointsText, "firmwareAPI");
  const apiPathsObject = extractObjectLiteral(apiEndpointsText, "API_PATHS");
  const bluetoothObject = extractObjectLiteral(bluetoothConfigText, "bluetoothConfig");

  const pushOrigin =
    safeUrlOrigin(pushApiObject?.transactionsWS) ||
    null;
  const siteOrigin =
    safeUrlOrigin(externalLinksObject?.aboutPage) ||
    safeUrlOrigin(firmwareApiObject?.lvglList) ||
    null;
  const firmwareMd5Base = firmwareApiObject?.lvglMd5Base || null;

  return {
    serviceHosts: serviceHostsObject,
    marketHost: serviceHostsObject?.market || null,
    marketOrigin: serviceHostsObject?.market
      ? `https://${serviceHostsObject.market}`
      : null,
    chainHost: extractString(chainConfigText, "CHAIN_HOST"),
    chainOrigin: extractString(chainConfigText, "CHAIN_ORIGIN"),
    pushOrigin,
    pushHost: safeUrlHost(pushApiObject?.transactionsWS),
    siteOrigin,
    siteHost: safeUrlHost(externalLinksObject?.aboutPage) || safeUrlHost(firmwareApiObject?.lvglList),
    fileHost: serviceHostsObject?.file || null,
    fileOrigin: serviceHostsObject?.file
      ? `https://${serviceHostsObject.file}`
      : null,
    supportEmail: externalLinksObject?.supportEmail || null,
    privacyPolicy: externalLinksObject?.privacyPolicy || null,
    aboutPage: externalLinksObject?.aboutPage || null,
    apiPaths: apiPathsObject || null,
    firmwareListUrl: firmwareApiObject?.lvglList || null,
    firmwareListHeaderName: firmwareApiObject?.lvglListHeaderName || null,
    firmwareListToken: firmwareApiObject?.lvglListToken || null,
    firmwareMd5Base,
    firmwareMd5HeaderName: firmwareApiObject?.lvglMd5HeaderName || null,
    firmwareMd5Token: firmwareApiObject?.lvglMd5Token || null,
    appKey: extractString(chainAuthText, "APP_KEY") || chainHmacObject?.APP_KEY || null,
    appSecret:
      extractString(chainAuthText, "APP_SECRET") || chainHmacObject?.APP_SECRET || null,
    bleServiceUUID: bluetoothObject?.serviceUUID || null,
    bleWriteCharacteristicUUID: bluetoothObject?.writeCharacteristicUUID || null,
    bleNotifyCharacteristicUUID: bluetoothObject?.notifyCharacteristicUUID || null,
    deviceAuthKey: extractUint32Array(deviceAuthText),
  };
}

const privateRuntimeConfig = loadPrivateRuntimeConfig();
const runtimeConfig = Object.fromEntries(
  Object.entries(privateRuntimeConfig).filter(([, value]) => value != null),
);
const serviceHosts = {
  market:
    runtimeConfig.marketHost ||
    runtimeConfig.serviceHosts?.market ||
    process.env.EXPO_PUBLIC_MARKET_HOST ||
    process.env.MARKET_HOST ||
    "market.example.invalid",
  chain:
    runtimeConfig.chainHost ||
    runtimeConfig.serviceHosts?.chain ||
    process.env.EXPO_PUBLIC_CHAIN_HOST ||
    process.env.CHAIN_HOST ||
    "gateway.example.invalid",
  file:
    runtimeConfig.fileHost ||
    runtimeConfig.serviceHosts?.file ||
    process.env.EXPO_PUBLIC_FILE_HOST ||
    process.env.FILE_HOST ||
    "files.example.invalid",
};
const productionRuntimeValues = {
  EXPO_PUBLIC_GATEWAY_ORIGIN:
    runtimeConfig.chainOrigin || process.env.EXPO_PUBLIC_GATEWAY_ORIGIN || "",
  EXPO_PUBLIC_MARKET_ORIGIN:
    runtimeConfig.marketOrigin || process.env.EXPO_PUBLIC_MARKET_ORIGIN || "",
  EXPO_PUBLIC_PUSH_ORIGIN:
    runtimeConfig.pushOrigin || process.env.EXPO_PUBLIC_PUSH_ORIGIN || "",
  EXPO_PUBLIC_SITE_ORIGIN:
    runtimeConfig.siteOrigin || process.env.EXPO_PUBLIC_SITE_ORIGIN || "",
  EXPO_PUBLIC_FILE_ORIGIN:
    runtimeConfig.fileOrigin || process.env.EXPO_PUBLIC_FILE_ORIGIN || "",
};

const requiredProdEnvVars = [
  "EXPO_PUBLIC_GATEWAY_ORIGIN",
  "EXPO_PUBLIC_MARKET_ORIGIN",
  "EXPO_PUBLIC_PUSH_ORIGIN",
  "EXPO_PUBLIC_SITE_ORIGIN",
  "EXPO_PUBLIC_FILE_ORIGIN",
];

if (isProd) {
  const missingProdEnvVars = requiredProdEnvVars.filter(
    (name) => !String(productionRuntimeValues[name] || "").trim(),
  );
  if (missingProdEnvVars.length > 0) {
    throw new Error(
      `Missing production env vars: ${missingProdEnvVars.join(", ")}`,
    );
  }
}

export default {
  expo: {
    entryPoint: "./index.js", // Keep entry point consistent
    owner: "app-team-dev",
    name: "Lukkey",
    slug: "app-core",
    scheme: "app-core",
    version: sharedVersion, // Sync Expo main version
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash-ios.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],

    ios: {
      buildNumber: sharedVersion, // Use unified version number for iOS
      supportsTablet: false,
      bundleIdentifier: "com.secnet.keyguard",
      // Expo uses bundleIdentifier plus owner/slug to match the correct iOS app record.
      icon: "./assets/icon.png",
      runtimeVersion: {
        policy: "appVersion",
      },
      splash: {
        image: "./assets/splash-ios.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSBluetoothAlwaysUsageDescription:
          "Access to Bluetooth is required to connect to the wallet device",
        NSBluetoothPeripheralUsageDescription:
          "Access to Bluetooth is required to connect to the wallet device",
        NSMotionUsageDescription:
          "Motion data is used for device interactions.",
        UIBackgroundModes: [
          "bluetooth-central",
          "fetch",
          "remote-notification",
        ],
        NFCReaderUsageDescription:
          "Allow $(PRODUCT_NAME) to communicate with your device via NFC.",
        ...(isProd
          ? {}
          : {
              NSLocalNetworkUsageDescription:
                "Allow $(PRODUCT_NAME) to find and connect to the local development server on your network.",
              NSBonjourServices: ["_expo._tcp", "_packager._tcp"],
            }),
        NSAppTransportSecurity: {
          NSExceptionDomains: {
            [serviceHosts.market]: {
              NSIncludesSubdomains: true,
              NSExceptionAllowsInsecureHTTPLoads: false,
              NSExceptionRequiresForwardSecrecy: true,
              NSRequiresCertificateTransparency: false,
            },
            [serviceHosts.chain]: {
              NSIncludesSubdomains: true,
              NSExceptionAllowsInsecureHTTPLoads: false,
              NSExceptionRequiresForwardSecrecy: true,
              NSRequiresCertificateTransparency: false,
            },
            [serviceHosts.file]: {
              NSIncludesSubdomains: true,
              NSExceptionAllowsInsecureHTTPLoads: false,
              NSExceptionRequiresForwardSecrecy: true,
              NSRequiresCertificateTransparency: false,
            },
          },
        },
      },
    },

    android: {
      runtimeVersion: sharedVersion,

      splash: {
        image: "./assets/splash-android.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },

      permissions: [
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.BLUETOOTH_ADMIN",
      ],
      blockedPermissions: ["android.permission.READ_MEDIA_IMAGES"],
      versionCode: parseInt(sharedVersion.replace(/\D/g, "")) || 1,
      package: "com.secnet.keyguard",
      // Android uses the package name plus owner/slug to associate it to the correct Play Store entry.
    },

    web: {
      favicon: "./assets/branding/favicon.png",
    },
    //Key points
    plugins: [
      "expo-secure-store",
      "expo-localization",
      [
        "expo-notifications",
        {
          mode: "production",
          icon: "./assets/branding/notification-icon.png",
          color: "#ffffff",
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            newArchEnabled: true,
            permissions: {
              "android.permission.BLUETOOTH_SCAN": {
                flags: ["neverForLocation"],
              },
              "android.permission.BLUETOOTH_CONNECT": {},
              "android.permission.BLUETOOTH_ADVERTISE": {},
            },
          },
          ios: {
            newArchEnabled: true, // ← New Architecture
            useFrameworks: "static", // static frameworks already updated
            entitlements: {
              "com.apple.developer.networking.multicast": true,
            },
          },
        },
      ],
    ],

    extra: {
      appVersion: sharedVersion, // Available for runtime reads
      runtimeConfig,
      eas: {
        projectId: "bba0cd9d-8bca-4531-97c3-b93d93b395b3",
      },
    },
  },
};
