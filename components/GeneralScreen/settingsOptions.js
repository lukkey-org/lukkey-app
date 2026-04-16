/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// settingsOptions.js
import React from "react";
import { Vibration, Switch, Linking } from "react-native";
import {
  externalLinks,
  firmwareAPI,
} from "../../env/apiEndpoints";
import { bluetoothConfig } from "../../env/bluetoothConfig";
import { getSecureItem } from "../../utils/secureStorage";

const getSettingsOptions = ({
  t,
  navigation,
  selectedCurrency,
  setCurrencyModalVisible,
  languages,
  selectedLanguage,
  isDarkMode,
  toggleColor,
  handleDarkModeChange,
  handleScreenLockToggle,
  openLockCodeModal,
  openPatternLockModal,
  isScreenLockEnabled,
  screenLockType,
  openChangeLockCodeModal,
  openChangePatternLockModal,
  setPendingSwitchType,
  accountName,
  accountId,
  handleFirmwareUpdate,
  isDeleteWalletVisible,
  toggleDeleteWalletVisibility,
  handleDeleteWallet,
  cryptoCards,
  device,
  setModalMessage,
  setErrorModalVisible,
  setSuccessModalVisible,
  serviceUUID,
  writeCharacteristicUUID,
  verifiedDevices,
  devices,
  bleManagerRef,
  setBleVisible,
  setVerificationStatus,
  setCheckStatusModalVisible,
  setCheckStatusProgress,
  setOtaFiles,
  registerOtaStart,
  beginOtaCheck,
  isOtaCheckActive,
  openExclusiveModal,
  // 新增：用于“设备管理”分组中的“Manage Paired Devices”
  queryDeviceVersion,
  handleBluetoothPairing,
  versionHasUpdate,
  syncFirmwareUpdateInfo,
  appVersion,
  setVersionRefreshKey,
}) => {
  // Toggle handler for Screen Lock option
  const toggleScreenLock = () => {
    const newValue = !isScreenLockEnabled;
    Vibration.vibrate();
    handleScreenLockToggle(newValue);
  };
  const showCheckStatusModal = () => {
    if (typeof setCheckStatusModalVisible !== "function") return;
    if (typeof openExclusiveModal === "function") {
      openExclusiveModal(() => setCheckStatusModalVisible(true));
      return;
    }
    setCheckStatusModalVisible(true);
  };

  const displayAccountName = (accountName || "").trim();

  return {
    grouped: (() => {
      // Personal customization
      const personalization = [
        ...(cryptoCards && cryptoCards.length > 0
          ? [
              {
                title: t("Default Currency"),
                icon: "attach-money",
                onPress: () => {
                  Vibration.vibrate();
                  navigation.navigate("Currency");
                },
                extraIcon: "arrow-drop-down",
                selectedOption: selectedCurrency,
              },
            ]
          : []),
        {
          title: t("Language"),
          icon: "language",
          onPress: () => {
            Vibration.vibrate();
            navigation.navigate("Language");
          },
          extraIcon: "arrow-drop-down",
          selectedOption: (
            languages.find((lang) => lang.code === selectedLanguage) ||
            languages.find((lang) =>
              (selectedLanguage || "").startsWith(lang.code)
            ) ||
            languages.find((lang) => lang.code === "en")
          ).name,
        },
        {
          title: t("Dark Mode"),
          icon: "dark-mode",
          onPress: () => {
            Vibration.vibrate();
            handleDarkModeChange(!isDarkMode);
          },
          toggle: (
            <Switch
              trackColor={{ false: "#767577", true: toggleColor }}
              thumbColor={isDarkMode ? "#fff" : "#fff"}
              ios_backgroundColor="#E8E8EA"
              onValueChange={() => {
                Vibration.vibrate();
                handleDarkModeChange(!isDarkMode);
              }}
              value={isDarkMode}
            />
          ),
        },
        ...(cryptoCards && cryptoCards.length > 0
          ? [
              {
                title: t("Address Book"),
                icon: "portrait",
                onPress: () => {
                  Vibration.vibrate();
                  navigation.navigate("AddressBook");
                },
              },
            ]
          : []),
      ];

      // Security and privacy
      const securityPrivacy = [
        ...(cryptoCards && cryptoCards.length > 0
          ? [
              {
                title: t("Password"),
                icon: "lock-outline",
                onPress: () => {
                  Vibration.vibrate();
                  if (isScreenLockEnabled) {
                    navigation.navigate("Password", {
                      handleScreenLockToggle,
                      openLockCodeModal,
                      openPatternLockModal,
                      openChangeLockCodeModal,
                      openChangePatternLockModal,
                      setPendingSwitchType,
                    });
                    return;
                  }
                  const newValue = !isScreenLockEnabled;
                  handleScreenLockToggle(newValue);
                },
                ...(isScreenLockEnabled
                  ? {}
                  : {
                      toggle: (
                        <Switch
                          trackColor={{ false: "#767577", true: toggleColor }}
                          thumbColor={isScreenLockEnabled ? "#fff" : "#fff"}
                          ios_backgroundColor="#E8E8EA"
                          onValueChange={() => {
                            Vibration.vibrate();
                            const newValue = !isScreenLockEnabled;
                            handleScreenLockToggle(newValue);
                          }}
                          value={isScreenLockEnabled}
                        />
                      ),
                    }),
              },
            ]
          : []),
        // Change lock entry moved to Password stack screen.
        {
          title: t("Privacy"),
          icon: "gpp-good",
          onPress: () => {
            Vibration.vibrate();
            navigation.navigate("Privacy");
          },
        },
      ];

      // Device management
      const deviceManagement = [
        ...(cryptoCards && cryptoCards.length > 0
          ? [
              {
                title: t("Firmware Update"),
                icon: "downloading",
                hasUpdate: versionHasUpdate,
                onPress: () => {
                  Vibration.vibrate();
                  const otaCheckSessionId =
                    typeof beginOtaCheck === "function" ? beginOtaCheck() : null;
                  const isOtaCheckStillActive = () => {
                    if (typeof isOtaCheckActive !== "function") return true;
                    if (otaCheckSessionId == null) return true;
                    return isOtaCheckActive(otaCheckSessionId);
                  };
                  try {
                    setVerificationStatus &&
                      setVerificationStatus("firmwareUpdateInfo");
                    showCheckStatusModal();
                  } catch {}
                  // Version comparison auxiliary method and unified application list
                  const __parseVersion = (str) => {
              if (!str) return null;
              // Unified preprocessing: remove spaces and wrap quotes
              const raw = String(str).trim().replace(/^"|"$/g, "");
              // 0) Compatible server version mapping: HW1.1.0 / HW-1.1.0 / HW_1.1.0
              {
                const m = raw.match(
                  /(?:^|[^a-z])hw[^0-9]*?(\d+)[._-](\d+)[._-](\d+)/i
                );
                if (m) {
                  return [
                    Number(m[1] || 0),
                    Number(m[2] || 0),
                    Number(m[3] || 0),
                  ];
                }
              }
              // 0.1) Compatible Bluetooth version mapping: BL1.1.0 / BL-1.1.0 / BL_1.1.0
              {
                const m = raw.match(
                  /(?:^|[^a-z])bl[^0-9]*?(\d+)[._-](\d+)[._-](\d+)/i
                );
                if (m) {
                  return [
                    Number(m[1] || 0),
                    Number(m[2] || 0),
                    Number(m[3] || 0),
                  ];
                }
              }
              // 1) Compatible device side direct reporting format: such as "HW:0.0.1" / "hw:0.0.1" / "ver:0.0.1"
              {
                const m = raw.match(
                  /(?:^|\b)(?:hw|fw|ver|version)\s*:\s*(\d+)[._-](\d+)[._-](\d+)\b/i
                );
                if (m) {
                  return [
                    Number(m[1] || 0),
                    Number(m[2] || 0),
                    Number(m[3] || 0),
                  ];
                }
              }
              // 2) Parse as "file (or path) name": take the last paragraph and remove the extension
              const base = raw.split(/[?#]/)[0].split("/").pop() || raw;
              // Only remove extensions starting with letters to avoid accidentally deleting version tail segments such as ".0"
              const name = base.replace(/\.(?:[a-z][a-z0-9]{0,7})$/i, "");
              // 2.1) Prioritize matching of LukkeyHW_* structures (case insensitive)
              // Support: lukkeyHW_1.0.0, LukkeyHW-1.0.0, LUKKEYHW_1.0.0, LukkeyHW v1.0.0, etc.
              let m =
                name.match(/lukkeyhw[^0-9]*?(\d+)[._-](\d+)[._-](\d+)/i) ||
                null;
              if (m) {
                return [
                  Number(m[1] || 0),
                  Number(m[2] || 0),
                  Number(m[3] || 0),
                ];
              }
              // 2.2) Fallback: Universal X.Y.Z (to avoid mismatching of other numbers and only capture the standard three-segment dotted version)
              m = name.match(
                /(?:^|[^0-9])(\d+)[._-](\d+)[._-](\d+)(?:[^0-9]|$)/
              );
              if (m) {
                return [
                  Number(m[1] || 0),
                  Number(m[2] || 0),
                  Number(m[3] || 0),
                ];
              }
              // 3) Final fallback: try to grab X.Y.Z in the original string
              {
                const m2 = raw.match(/(\d+)[._-](\d+)[._-](\d+)/);
                if (m2) {
                  return [
                    Number(m2[1] || 0),
                    Number(m2[2] || 0),
                    Number(m2[3] || 0),
                  ];
                }
              }
              return null;
                  };
                  const __cmpVersion = (a, b) => {
              if (!a && !b) return 0;
              if (!a) return -1;
              if (!b) return 1;
              for (let i = 0; i < 3; i++) {
                const ai = Number(a[i] || 0);
                const bi = Number(b[i] || 0);
                if (ai > bi) return 1;
                if (ai < bi) return -1;
              }
              return 0;
                  };
                  const applyFiles = async (files) => {
              try {
                if (!isOtaCheckStillActive()) return;
                let deviceVerStr = null;
                try {
                  deviceVerStr = await getSecureItem("hardwareVersion");
                  if (!deviceVerStr) {
                    deviceVerStr = await getSecureItem("bluetoothVersion");
                  }
                } catch {}
                const devVer = __parseVersion(deviceVerStr);

                // Only use BL_/HW_ in versions as the version basis
                let latest = null;
                const list = Array.isArray(files) ? files : [];
                const withTaggedVersion = list.filter((f) => {
                  const versionRaw =
                    typeof f === "object" ? f?.version || f?.versionRaw : null;
                  const versionStr = String(versionRaw || "").trim();
                  return /^bl_/i.test(versionStr) || /^hw_/i.test(versionStr);
                });
                try {
                  console.log("[OTA][server-files] total=", list.length);
                  console.log(
                    "[OTA][server-files] tagged-only=",
                    withTaggedVersion.length
                  );
                } catch {}
                const patchFilesMeta = [];
                for (const f of withTaggedVersion) {
                  const url = f?.url || f;
                  const name =
                    (typeof f === "object" && f?.name) ||
                    (url || "").split("/").pop();
                  const verRaw =
                    typeof f === "object" ? f?.version || f?.versionRaw : null;
                  const ver = __parseVersion(verRaw);
                  try {
                    console.log("[OTA][server-file]", {
                      name,
                      url,
                      verRaw,
                      parsedVer: ver ? `${ver[0]}.${ver[1]}.${ver[2]}` : null,
                    });
                  } catch {}
                  if (!ver && !verRaw) continue;
                  patchFilesMeta.push({
                    name,
                    url,
                    version: verRaw,
                    ver: ver || [0, 0, 0],
                  });
                  if (!latest || __cmpVersion(ver, latest.ver) > 0) {
                    latest = { ver, item: { name, url, version: verRaw } };
                  }
                }
                const patchFilesSorted = patchFilesMeta
                  .sort((a, b) => __cmpVersion(b.ver, a.ver))
                  .map((f) => ({
                    name: f.name,
                    url: f.url,
                    version: f.version,
                  }));

                // Select differential package or full package based on device base version number
                let deviceBaseVer = null;
                try {
                  const baseStr = await getSecureItem("baseVersion");
                  if (baseStr) deviceBaseVer = __parseVersion(baseStr);
                } catch {}

                // New name: Patch = LukkeyHW-(\d+\.\d+\.\d+)_b(\d+\.\d+\.\d+)\.zip
                const __parseBaseFromName = (fileName) => {
                  const m = String(fileName || "").match(/_b(\d+)\.(\d+)\.(\d+)/i);
                  if (!m) return null;
                  return [Number(m[1]), Number(m[2]), Number(m[3])];
                };
                const __isPatchFile = (fileName) => /_b\d+\.\d+\.\d+/i.test(String(fileName || ""));

                const selectOtaFile = (latestItem, allFiles) => {
                  if (!latestItem) return null;
                  const targetVer = __parseVersion(latestItem.version || latestItem.name);
                  if (!targetVer) return latestItem;

                  const candidates = (allFiles || []).filter((f) => {
                    const fVer = __parseVersion(f.version || f.name);
                    return fVer && __cmpVersion(fVer, targetVer) === 0;
                  });
                  if (candidates.length === 0) return latestItem;

                  if (deviceBaseVer) {
                    const patchCandidate = candidates.find((f) => {
                      if (!__isPatchFile(f.name)) return false;
                      const fileBase = __parseBaseFromName(f.name);
                      return fileBase && __cmpVersion(fileBase, deviceBaseVer) === 0;
                    });
                    if (patchCandidate) {
                      console.log("[OTA][select] base matched → patch:", patchCandidate.name);
                      return patchCandidate;
                    }
                  }
                  const fullCandidate = candidates.find((f) => !__isPatchFile(f.name));
                  console.log("[OTA][select] base mismatch or missing → full:", fullCandidate?.name || latestItem.name);
                  return fullCandidate || latestItem;
                };

                try {
                  console.log(
                    "[OTA][version-compare] deviceVerStr=",
                    deviceVerStr,
                    "parsedDevVer=",
                    devVer,
                    "latestName=",
                    latest && latest.item && latest.item.name,
                    "parsedLatestVer=",
                    latest && latest.ver
                  );
                } catch {}
                const __cmp =
                  latest && devVer ? __cmpVersion(latest.ver, devVer) : null;
                if (latest && (__cmp == null || __cmp > 0)) {
                  // Prompt user for confirmation before executing OTA
                  try {
                    if (!isOtaCheckStillActive()) return;
                    const resolvedList = (() => {
                      const seen = new Map();
                      for (const f of patchFilesSorted) {
                        const key = __parseVersion(f.version || f.name);
                        if (!key) continue;
                        const verKey = `${key[0]}.${key[1]}.${key[2]}`;
                        if (seen.has(verKey)) continue;
                        const chosen = selectOtaFile(f, patchFilesSorted);
                        if (chosen) {
                          seen.set(verKey, chosen);
                        }
                      }
                      return Array.from(seen.values()).sort((a, b) =>
                        __cmpVersion(__parseVersion(b.version || b.name), __parseVersion(a.version || a.name))
                      );
                    })();
                    typeof setOtaFiles === "function" &&
                      setOtaFiles(
                        resolvedList.length > 0 ? resolvedList : [latest.item]
                      );
                    setVerificationStatus &&
                      setVerificationStatus("updateAvailable");
                  } catch {}
                  // Prepare to delay the start of the function until the user confirms it.
                  handleFirmwareUpdate({
                    device,
                    devices,
                    verifiedDevices,
                    bleManagerRef,
                    setBleVisible,
                    t,
                    setModalMessage,
                    setErrorModalVisible,
                    setSuccessModalVisible,
                    serviceUUID,
                    writeCharacteristicUUID,
                    notifyCharacteristicUUID:
                      bluetoothConfig.notifyCharacteristicUUID,
                    setVerificationStatus,
                    setCheckStatusModalVisible,
                    setCheckStatusProgress,
                    openExclusiveModal,
                    syncFirmwareUpdateInfo,
                    deferStart: true,
                    registerStart: (fn) => {
                      try {
                        typeof registerOtaStart === "function" &&
                          registerOtaStart(fn);
                      } catch {}
                    },
                  });
                } else {
                  // Already up to date or unable to determine (serverless version)
                  typeof setOtaFiles === "function" && setOtaFiles([]);
                  try {
                    typeof syncFirmwareUpdateInfo === "function" &&
                      syncFirmwareUpdateInfo(false);
                  } catch {}
                  try {
                    if (!isOtaCheckStillActive()) return;
                    setVerificationStatus && setVerificationStatus("otaLatest");
                  } catch {}
                }
              } catch (e) {
                // Failure to detect is considered a failure
                typeof setOtaFiles === "function" && setOtaFiles([]);
                try {
                  if (!isOtaCheckStillActive()) return;
                  setVerificationStatus && setVerificationStatus("otaFail");
                } catch {}
              }
                  };
                  (async () => {
                    try {
                      if (!isOtaCheckStillActive()) return;
                      try {
                        if (typeof queryDeviceVersion === "function") {
                          await queryDeviceVersion();
                          if (typeof setVersionRefreshKey === "function")
                            setVersionRefreshKey((k) => k + 1);
                        }
                      } catch {}
                      if (!isOtaCheckStillActive()) return;
                      if (!firmwareAPI.enabled) {
                        typeof setOtaFiles === "function" && setOtaFiles([]);
                        setVerificationStatus && setVerificationStatus("otaFail");
                        return;
                      }
                      const withTimeout = (promise, ms = 3500) => {
                        return Promise.race([
                          promise,
                          new Promise((_, reject) =>
                            setTimeout(() => reject(new Error("FETCH_TIMEOUT")), ms)
                          ),
                        ]);
                      };
                      const base = firmwareAPI.lvglBase;
                      try {
                        const listUrl = firmwareAPI.lvglList;
                        const listHeaders = {
                          Accept: "application/json",
                        };
                        if (
                          firmwareAPI.lvglListHeaderName &&
                          firmwareAPI.lvglListToken
                        ) {
                          listHeaders[firmwareAPI.lvglListHeaderName] =
                            firmwareAPI.lvglListToken;
                        }
                        const lj = await withTimeout(
                          fetch(listUrl, {
                            headers: listHeaders,
                          })
                        );
                        if (lj.ok) {
                          const j = await lj.json();
                          if (Array.isArray(j.files) && j.files.length > 0) {
                            const versionsMap =
                              j && typeof j.versions === "object" ? j.versions : {};
                            const finalFiles = j.files.map((name) => ({
                              name,
                              url: base + encodeURI(name),
                              version: versionsMap[name],
                            }));
                            applyFiles(finalFiles);
                            return;
                          }
                        }
                      } catch {}
                      const res = await withTimeout(fetch(base));
                      const html = await res.text();
                      let hrefs = (() => {
                  const out = [];
                  const regs = [
                    /href="([^"]+)"/gi,
                    /href='([^']+)'/gi,
                    /href=([^>\s]+)/gi,
                  ];
                  for (const re of regs) {
                    let m;
                    while ((m = re.exec(html))) out.push(m[1]);
                  }
                  return out;
                      })();
                      if (!hrefs.length) {
                        try {
                          const keys = Array.from(
                            (html || "").matchAll(/<Key>([^<]+)<\/Key>/gi)
                          ).map((m) => m[1]);
                          hrefs = keys
                            .filter(
                              (k) => k && (k.startsWith("lvgl/") || !k.includes("/"))
                            )
                            .map((k) => k.split("/").pop());
                        } catch {}
                      }
                      const files = hrefs
                        .filter(
                          (href) =>
                            !!href &&
                            !href.startsWith("?") &&
                      !href.startsWith("#") &&
                      href !== "/" &&
                      href !== "../" &&
                      !href.endsWith("/")
                  )
                  .map((href) => {
                    const rawUrl = href.startsWith("http") ? href : base + href;
                    return {
                      name: decodeURIComponent(rawUrl.split("/").pop()),
                      url: encodeURI(rawUrl),
                    };
                  });
                const unique = [];
                const seen = new Set();
                for (const f of files) {
                  const key = f.url;
                  if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(f);
                  }
                }
                if (typeof setOtaFiles === "function") {
                  let finalFiles = unique;
                  if (!finalFiles.length) {
                    try {
                      const mj = await fetch(base + "manifest.json");
                      if (mj.ok) {
                        const arr = await mj.json();
                        if (Array.isArray(arr)) {
                          finalFiles = arr
                            .map((it) => {
                              if (typeof it === "string") {
                                const url = it.startsWith("http")
                                  ? it
                                  : base + it;
                                return {
                                  name: decodeURIComponent(
                                    url.split("/").pop()
                                  ),
                                  url,
                                };
                              } else if (it && typeof it === "object") {
                                const url = it.url
                                  ? it.url
                                  : base + (it.path || it.name || "");
                                const name =
                                  it.name ||
                                  decodeURIComponent(
                                    (it.url || it.path || "").split("/").pop()
                                  );
                                return { name, url };
                              }
                              return null;
                            })
                            .filter(Boolean);
                        }
                      }
                    } catch {}
                  }
                  if (!finalFiles.length) {
                    try {
                      const ij = await fetch(base + "index.json");
                      if (ij.ok) {
                        const arr = await ij.json();
                        if (Array.isArray(arr)) {
                          finalFiles = arr
                            .map((nameOrObj) => {
                              if (typeof nameOrObj === "string") {
                                const url = nameOrObj.startsWith("http")
                                  ? nameOrObj
                                  : base + nameOrObj;
                                return {
                                  name: decodeURIComponent(
                                    url.split("/").pop()
                                  ),
                                  url,
                                };
                              } else if (
                                nameOrObj &&
                                typeof nameOrObj === "object"
                              ) {
                                const url = nameOrObj.url
                                  ? nameOrObj.url
                                  : base +
                                    (nameOrObj.path || nameOrObj.name || "");
                                const name =
                                  nameOrObj.name ||
                                  decodeURIComponent(
                                    (nameOrObj.url || nameOrObj.path || "")
                                      .split("/")
                                      .pop()
                                  );
                                return { name, url };
                              }
                              return null;
                            })
                            .filter(Boolean);
                        }
                      }
                    } catch {}
                  }
                  applyFiles(finalFiles);
                }
              } catch {
                try {
                  applyFiles([]);
                } catch {}
              }
            })();
                },
              },
            ]
          : []),
        ...(cryptoCards && cryptoCards.length > 0
          ? [
              {
                title: t("Manage Paired Devices"),
                icon: "bluetooth",
                onPress: () => {
                  Vibration.vibrate();
                  typeof handleBluetoothPairing === "function" &&
                    handleBluetoothPairing();
                },
              },
            ]
          : []),
      ];

      // Help & Support
      const supportGroup = [
        ...(cryptoCards && cryptoCards.length > 0
          ? []
          : [
              {
                title: t("Version"),
                icon: "info-outline",
                selectedOption: appVersion || "-",
                disabled: true,
              },
            ]),
        {
          title: t("Help & Support"),
          icon: "help-outline",
          onPress: () => {
            Vibration.vibrate();
            navigation.navigate("Support");
          },
        },
        {
          title: t("About"),
          icon: "info-outline",
          onPress: () => {
            Vibration.vibrate();
            if (!externalLinks.aboutEnabled) return;
            Linking.openURL(externalLinks.aboutPage);
          },
        },
      ];

      // Danger area
      const dangerGroup =
        cryptoCards && cryptoCards.length > 0
          ? [
              {
                title: t("Reset Local Profile"),
                icon: "delete-outline",
                onPress: handleDeleteWallet,
                danger: true,
              },
            ]
          : [];

      // Account (if any) is ranked as an independent group
      const accountGroup =
        displayAccountName.length > 0
          ? [
              [
                {
                  title: t("Account"),
                  icon: "account-circle",
                  onPress: () => {
                    Vibration.vibrate();
                  },
                  selectedOption: displayAccountName,
                },
              ],
            ]
          : [];

      return [
        ...accountGroup,
        personalization,
        securityPrivacy,
        deviceManagement,
        supportGroup,
        dangerGroup,
      ].filter((grp) => Array.isArray(grp) && grp.length > 0);
    })(),
  };
};

export default getSettingsOptions;
