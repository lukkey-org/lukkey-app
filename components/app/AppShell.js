/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Platform, StatusBar, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { DarkModeContext, DeviceContext } from "../../utils/DeviceContext";
import OnboardingScreen from "../../utils/OnboardingScreen";
import ScreenLock from "../../utils/ScreenLock";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const RootStack = createNativeStackNavigator();

function AppInner({ MainStackComponent }) {
  const { isDarkMode } = useContext(DarkModeContext);
  const navTheme = React.useMemo(() => {
    const base = isDarkMode ? DarkTheme : DefaultTheme;
    const background = isDarkMode ? "#21201E" : "#FFFFFF";
    return {
      ...base,
      colors: {
        ...base.colors,
        background,
        card: background,
      },
    };
  }, [isDarkMode]);

  useEffect(() => {
    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 1300);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
          });
        }
      } catch (e) {
        console.log(
          "Failed to set Android notification channel:",
          e?.message || e,
        );
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="AppContextRoot">
            {(props) => (
              <AppContextRoot
                {...props}
                MainStackComponent={MainStackComponent}
              />
            )}
          </RootStack.Screen>
        </RootStack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

function AppContextRoot({ MainStackComponent }) {
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);
  const [screenLockEnabled, setScreenLockEnabled] = useState(false);
  const [isScreenLockLoaded, setIsScreenLockLoaded] = useState(false);
  const { isDarkMode } = useContext(DarkModeContext);
  const { isAppLaunching, settingsLoaded } = useContext(DeviceContext);
  const forceShowOnboarding = false;
  const forceShowBootSplash = false;

  useEffect(() => {
    AsyncStorage.getItem("alreadyLaunched").then((value) => {
      if (value === null) {
        setIsFirstLaunch(true);
      } else {
        setIsFirstLaunch(false);
      }
    });
  }, []);

  const handleOnboardingDone = async () => {
    try {
      await AsyncStorage.setItem("alreadyLaunched", "true");
    } catch (error) {
      console.error("Failed to persist alreadyLaunched", error);
    }
    setIsFirstLaunch(false);
  };

  useEffect(() => {
    if (isFirstLaunch !== false) return;
    (async () => {
      try {
        const value = await AsyncStorage.getItem("screenLockEnabled");
        if (value !== null) {
          setScreenLockEnabled(JSON.parse(value));
          return;
        }
        const legacyValue = await AsyncStorage.getItem(
          "screenLockFeatureEnabled",
        );
        if (legacyValue !== null) {
          const parsedLegacy = JSON.parse(legacyValue);
          setScreenLockEnabled(parsedLegacy);
          await AsyncStorage.setItem(
            "screenLockEnabled",
            JSON.stringify(parsedLegacy),
          );
          await AsyncStorage.removeItem("screenLockFeatureEnabled");
        }
      } catch (error) {
        console.error("Failed to load screenLockEnabled", error);
      } finally {
        setIsScreenLockLoaded(true);
      }
    })();
  }, [isFirstLaunch]);

  const statusBarBackgroundColor = isDarkMode ? "#21201E" : "#FFFFFF";
  const statusBarStyle = isDarkMode ? "light-content" : "dark-content";

  return (
    <>
      <StatusBar
        backgroundColor={statusBarBackgroundColor}
        barStyle={statusBarStyle}
      />
      <AppGate
        forceShowOnboarding={forceShowOnboarding}
        forceShowBootSplash={forceShowBootSplash}
        isFirstLaunch={isFirstLaunch}
        isScreenLockLoaded={isScreenLockLoaded}
        screenLockEnabled={screenLockEnabled}
        isAppLaunching={isAppLaunching}
        settingsLoaded={settingsLoaded}
        isDarkMode={isDarkMode}
        onOnboardingDone={handleOnboardingDone}
        MainStackComponent={MainStackComponent}
      />
    </>
  );
}

export function AppBootSplash({ isDarkMode }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? "#21201E" : "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator
        size="small"
        color={isDarkMode ? "#FFFFFF" : "#333333"}
      />
    </View>
  );
}

function AppGate({
  forceShowOnboarding,
  forceShowBootSplash,
  isFirstLaunch,
  isScreenLockLoaded,
  screenLockEnabled,
  isAppLaunching,
  settingsLoaded,
  isDarkMode,
  onOnboardingDone,
  MainStackComponent,
}) {
  if (forceShowOnboarding || isFirstLaunch === true) {
    return <OnboardingApp onDone={onOnboardingDone} />;
  }

  const isBooting =
    (isFirstLaunch === null && !forceShowOnboarding) ||
    !isScreenLockLoaded ||
    !settingsLoaded;

  if (forceShowBootSplash || isBooting) {
    return <AppBootSplash isDarkMode={isDarkMode} />;
  }

  if (screenLockEnabled && isAppLaunching) {
    return <ScreenLock />;
  }

  if (!MainStackComponent) return null;
  return <MainStackComponent />;
}

/**
 * OnboardingApp displays the onboarding screen for first-time users.
 */
function OnboardingApp({ onDone }) {
  return (
    <>
      <OnboardingScreen onDone={onDone} />
    </>
  );
}

export default AppInner;
