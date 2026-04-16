/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
/**
 * index.js - Expo entry to reliably register the root component across platforms
 * Use Expo's registerRootComponent to avoid "main is not registered" problems
 */
import "react-native-gesture-handler";
import "./utils/fetchHmacPatch";
import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
