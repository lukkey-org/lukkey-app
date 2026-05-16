/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
// Single source of truth for runtime dev flag
export const RUNTIME_DEV = process.env.EXPO_PUBLIC_RUNTIME_DEV === "true";
