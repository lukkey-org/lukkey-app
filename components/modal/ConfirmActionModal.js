/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from "react-native";
import { BlurView } from "../common/AppBlurView";
import AnimatedWebP from "../common/AnimatedWebP";

const ConfirmActionModal = ({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  onRequestClose,
  styles,
  containerStyle,
  titleStyle,
  subtitleStyle,
  iconSource,
  iconStyle,
  confirmButtonStyle,
  cancelButtonStyle,
  confirmTextStyle,
  cancelTextStyle,
  disableBackdropClose = false,
  hideConfirmButton = false,
}) => {
  const [showModal, setShowModal] = useState(visible);

  useEffect(() => {
    setShowModal(visible);
  }, [visible]);

  if (!showModal) return null;

  const handleCancel = () => {
    if (typeof onCancel === "function") {
      onCancel();
      return;
    }
    if (typeof onRequestClose === "function") {
      onRequestClose();
    }
  };

  const handleRequestClose = () => {
    if (typeof onRequestClose === "function") {
      onRequestClose();
      return;
    }
    handleCancel();
  };

  const modalStyle = containerStyle || styles?.modalView;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showModal}
      onRequestClose={handleRequestClose}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={disableBackdropClose ? undefined : handleCancel}
        >
          <BlurView style={StyleSheet.absoluteFillObject} />
        </Pressable>
        <View style={styles?.centeredView} pointerEvents="box-none">
          <View style={modalStyle} onStartShouldSetResponder={() => true}>
            {!!title && <Text style={[styles?.modalTitle, titleStyle]}>{title}</Text>}
            {!!message && (
              <Text style={[styles?.modalSubtitle, subtitleStyle]}>
                {message}
              </Text>
            )}
            {iconSource ? (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <AnimatedWebP source={iconSource} style={iconStyle} />
              </View>
            ) : null}
            <View
              style={{
                width: "100%",
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 16,
              }}
            >
              <TouchableOpacity
                style={[
                  cancelButtonStyle,
                  hideConfirmButton && { flex: 1, marginRight: 0 },
                ]}
                onPress={handleCancel}
              >
                <Text style={cancelTextStyle}>{cancelText}</Text>
              </TouchableOpacity>
              {!hideConfirmButton ? (
                <TouchableOpacity style={confirmButtonStyle} onPress={onConfirm}>
                  <Text style={confirmTextStyle}>{confirmText}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ConfirmActionModal;
