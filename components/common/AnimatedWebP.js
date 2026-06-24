/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Image } from "expo-image";

const PLAY_ONCE_WEBP_META = new Map([
  [require("../../assets/animations/Empty.webp"), { totalMs: 1499 }],
  [require("../../assets/animations/Fail.webp"), { totalMs: 1999 }],
  [require("../../assets/animations/Success.webp"), { totalMs: 1340 }],
]);

const mapResizeMode = (resizeMode) => {
  switch (resizeMode) {
    case "contain":
      return "contain";
    case "cover":
      return "cover";
    case "stretch":
      return "fill";
    case "center":
      return "none";
    case "repeat":
      return "cover";
    default:
      return undefined;
  }
};

const AnimatedWebP = React.forwardRef(
  (
    { resizeMode, contentFit, autoplay, onDisplay, source, ...props },
    forwardedRef,
  ) => {
    const mappedFit = contentFit || mapResizeMode(resizeMode);
    const imageRef = useRef(null);
    const stopTimerRef = useRef(null);

    const playOnceMeta = useMemo(() => {
      if (typeof source === "number" && PLAY_ONCE_WEBP_META.has(source)) {
        return PLAY_ONCE_WEBP_META.get(source);
      }
      return null;
    }, [source]);

    const shouldPlayOnce = playOnceMeta != null;
    const resolvedAutoplay = shouldPlayOnce ? true : autoplay;

    const assignRef = useCallback(
      (node) => {
        imageRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const handleDisplay = useCallback(() => {
      if (typeof onDisplay === "function") {
        onDisplay();
      }
      if (!shouldPlayOnce) return;
      const target = imageRef.current;
      if (!target?.stopAnimating) return;
      if (!resolvedAutoplay && target?.startAnimating) {
        try {
          target.startAnimating();
        } catch {}
      }
      if (playOnceMeta && playOnceMeta.totalMs > 0) {
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
        }
        const stopDelayMs = playOnceMeta.totalMs;
        stopTimerRef.current = setTimeout(() => {
          try {
            target.stopAnimating();
          } catch {}
        }, stopDelayMs);
      }
    }, [onDisplay, playOnceMeta, resolvedAutoplay, shouldPlayOnce]);

    useEffect(
      () => () => {
        if (stopTimerRef.current) {
          clearTimeout(stopTimerRef.current);
        }
      },
      [],
    );

    return (
      <Image
        ref={assignRef}
        contentFit={mappedFit}
        autoplay={resolvedAutoplay}
        onDisplay={handleDisplay}
        source={source}
        {...props}
      />
    );
  },
);

AnimatedWebP.displayName = "AnimatedWebP";

export default AnimatedWebP;
