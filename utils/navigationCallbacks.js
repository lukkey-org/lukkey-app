/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
const callbacks = new Map();

const makeCallbackId = () =>
  `navcb_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const registerNavigationCallback = (callback) => {
  if (typeof callback !== "function") {
    return null;
  }
  const id = makeCallbackId();
  callbacks.set(id, callback);
  return id;
};

export const callNavigationCallback = (id, payload) => {
  if (!id) return false;
  const callback = callbacks.get(id);
  if (typeof callback !== "function") {
    return false;
  }
  try {
    callback(payload);
  } finally {
    callbacks.delete(id);
  }
  return true;
};

export const clearNavigationCallback = (id) => {
  if (!id) return false;
  return callbacks.delete(id);
};
