/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
/*
 * Project: Secure Systems
 * Author: Helvetiq Labs Team
 * Module: GeneralScreen/ModuleSecureView.js
 * License: MIT
 *
 * ModuleSecureView - React component for secure device settings view.
 *
 * Props:
 * - handleDeleteWallet: Function to reset the APP wallet.
 * - handleBluetoothPairing: Function to manage Bluetooth pairing.
 * - isDeleteWalletVisible: Boolean to toggle visibility of delete wallet option.
 * - setIsDeleteWalletVisible: Function to toggle isDeleteWalletVisible state.
 * - isSupportExpanded: Boolean to toggle support section visibility.
 * - setIsSupportExpanded: Function to toggle isSupportExpanded state.
 * - styles: StyleSheet object for styling.
 * - settingsOptions: Object containing settings options.
 * - iconColor: Color used for icons.
 * - cryptoCards: Array of crypto card data.
 * - t: Translation function.
 */

import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Vibration,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";

const ModuleSecureView = ({
  styles, // SecureDeviceScreenStyle
  settingsOptions,
  isSupportExpanded,
  setIsSupportExpanded,
  handleDeleteWallet,
  handleBluetoothPairing,
  iconColor,
  cryptoCards,
  t,
  isDarkMode,
}) => {
  const rightArrowColor =
    typeof isDarkMode === "boolean"
      ? isDarkMode
        ? iconColor
        : "#cccccc"
      : iconColor;
  return (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      <View style={styles.contentContainer}>
        {/* Grouping style (rounded corners cards), enabled when settingsOptions.grouped exists */}
        {Array.isArray(settingsOptions.grouped) ? (
          <>
            {settingsOptions.grouped.map((group, gi) => (
              <View key={`group-${gi}`} style={styles.groupCard}>
                {group.map((option, idx) => (
                  <React.Fragment key={`${option.title}-${idx}`}>
                    <TouchableOpacity
                      activeOpacity={option.disabled ? 1 : 0.85}
                      disabled={option.disabled}
                      onPress={option.onPress}
                      style={styles.groupRow}
                    >
                      <View style={styles.groupIconWrap}>
                        <Icon
                          name={option.icon}
                          size={22}
                          color={
                            option.iconColor ||
                            (option.danger ? "#FF5252" : iconColor)
                          }
                        />
                      </View>
                      <Text
                        style={[
                          styles.Text,
                          { flex: 1 },
                          option.danger && styles.groupDangerText,
                        ]}
                        numberOfLines={1}
                      >
                        {option.title}
                      </Text>

                      {/* Information area on the right: Display the switch first, then display the selected item/version, otherwise display the arrow */}
                      {option.toggle ? (
                        <View>{option.toggle}</View>
                      ) : option.selectedOption ? (
                        <Text
                          style={styles.groupRightText}
                          numberOfLines={1}
                        >
                          {option.selectedOption}
                        </Text>
                      ) : option.version ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          <Text style={styles.groupRightText} numberOfLines={1}>
                            {option.version}
                          </Text>
                          {option.hasUpdate ? (
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: "#FF5252",
                                marginLeft: 8,
                              }}
                            />
                          ) : null}
                        </View>
                      ) : option.hasUpdate && option.onPress ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: "#FF5252",
                              marginRight: 8,
                            }}
                          />
                          <Icon
                            name="chevron-right"
                            size={22}
                            color={rightArrowColor}
                          />
                        </View>
                      ) : option.onPress ? (
                        <Icon
                          name="chevron-right"
                          size={22}
                          color={rightArrowColor}
                        />
                      ) : null}
                    </TouchableOpacity>

                    {idx < group.length - 1 && (
                      <View style={styles.groupDivider} />
                    )}
                  </React.Fragment>
                ))}
              </View>
            ))}
          </>
        ) : (
          <>
            {/* Old rendering (undercover): when group data is not provided, it is still displayed according to the original structure */}
            <View>
              {settingsOptions.settings.map((option) => (
                <TouchableOpacity
                  key={option.title}
                  style={styles.settingsItem}
                  onPress={option.onPress}
                >
                  <View style={styles.listContainer}>
                    <Icon
                      name={option.icon}
                      size={24}
                      color={iconColor}
                      style={styles.Icon}
                    />
                    <Text style={[styles.Text, { flex: 1 }]}>
                      {option.title}
                    </Text>
                    {option.selectedOption && (
                      <Text style={[styles.buttonText, { marginRight: 8 }]}>
                        {option.selectedOption}
                      </Text>
                    )}
                    {option.extraIcon && (
                      <Icon
                        name={option.extraIcon}
                        size={24}
                        color={iconColor}
                      />
                    )}
                  </View>
                  {option.toggle}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => setIsSupportExpanded(!isSupportExpanded)}
            >
              <View style={styles.listContainer}>
                <Icon
                  name="support-agent"
                  size={24}
                  color={iconColor}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.Text, { flex: 1 }]}>{t("Support")}</Text>
                <Icon
                  name={isSupportExpanded ? "arrow-drop-up" : "arrow-drop-down"}
                  size={24}
                  color={iconColor}
                />
              </View>
            </TouchableOpacity>

            {isSupportExpanded && (
              <View>
                {settingsOptions.support.map((option) => {
                  return (
                    <TouchableOpacity
                      key={option.title}
                      style={styles.settingsItem}
                      onPress={option.onPress}
                    >
                      <View style={styles.listContainer}>
                        <Icon
                          name={option.icon}
                          size={24}
                          color={iconColor}
                          style={[styles.Icon, { marginLeft: 20 }]}
                        />
                        <Text style={[styles.Text, { flex: 1 }]}>
                          {option.title}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View>
              {settingsOptions.info.map((option) => (
                <TouchableOpacity
                  key={option.title}
                  style={styles.settingsItem}
                  onPress={option.onPress}
                >
                  <View style={styles.listContainer}>
                    <Icon
                      name={option.icon}
                      size={24}
                      color={iconColor}
                      style={styles.Icon}
                    />
                    <Text style={[styles.Text, { flex: 1 }]}>
                      {option.title}
                    </Text>
                    {option.version && (
                      <Text style={[styles.buttonText, { marginRight: 8 }]}>
                        {option.version}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {cryptoCards.length > 0 && (
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={handleDeleteWallet}
              >
                <View style={styles.listContainer}>
                  <Icon
                    name="delete-outline"
                    size={24}
                    color="#FF5252"
                    style={styles.Icon}
                  />
                  <Text style={[styles.Text, { flex: 1, color: "#FF5252" }]}>
                    {t("Reset Local Profile")}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {cryptoCards.length > 0 && (
              <View style={{ marginTop: 40, alignItems: "center" }}>
                <TouchableOpacity
                  style={styles.roundButton}
                  onPress={() => {
                    Vibration.vibrate();
                    handleBluetoothPairing();
                  }}
                >
                  <Text style={styles.BluetoothBtnText}>
                    {t("Manage Paired Devices")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default ModuleSecureView;
