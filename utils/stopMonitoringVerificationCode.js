/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
/**
  * Stop listening to the public tool function for verification codes
  * Used to stop the verification code listening subscription of Bluetooth devices
 */

/**
  * Create a function to stop listening for verification codes
  * @param {React.MutableRefObject} monitorSubscriptionRef - the reference to monitor the subscription
  * @returns {Function} Stop listening function
 */
export const createStopMonitoringVerificationCode = (
  monitorSubscriptionRef
) => {
  return () => {
    try {
      monitorSubscriptionRef.current?.remove();
    } catch (error) {
      console.log("Error stopping monitoring:", error);
    } finally {
      monitorSubscriptionRef.current = null;
    }
  };
};

/**
  * Directly used stop listening function (applicable to scenarios where monitorSubscription ref already exists)
  * @param {React.MutableRefObject} monitorSubscriptionRef - the reference to monitor the subscription
 */
export const stopMonitoringVerificationCode = (monitorSubscriptionRef) => {
  try {
    monitorSubscriptionRef.current?.remove();
  } catch (error) {
    console.log("Error stopping monitoring:", error);
  } finally {
    monitorSubscriptionRef.current = null;
  }
};

export default createStopMonitoringVerificationCode;
