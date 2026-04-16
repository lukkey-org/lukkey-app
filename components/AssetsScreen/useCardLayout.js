/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { useCallback } from "react";

const useCardLayout = ({
  cardLayoutYRef,
  pendingScrollIndexRef,
  scrollViewRef,
  cardStartPositions,
}) => {
  const handleCardLayout = useCallback(
    (index, y) => {
      if (!Number.isFinite(y)) return;
      cardLayoutYRef.current[index] = y;
      if (pendingScrollIndexRef.current === index) {
        pendingScrollIndexRef.current = null;
        const targetScrollY = Math.max(0, y - 50);
        scrollViewRef?.current?.scrollTo({ y: targetScrollY, animated: true });
      }
    },
    [cardLayoutYRef, pendingScrollIndexRef, scrollViewRef],
  );

  const scrollCardToTop = useCallback(
    (index) => {
      const cardY = cardLayoutYRef.current[index];
      if (!Number.isFinite(cardY)) return;
      const targetScrollY = Math.max(0, cardY - 50);
      scrollViewRef?.current?.scrollTo({ y: targetScrollY, animated: true });
    },
    [cardLayoutYRef, scrollViewRef],
  );

  const initCardPosition = useCallback(
    (_ref, _index) =>
      _ref?.measure(
        (fx, fy, width, height, px, py) =>
          (cardStartPositions.current[_index] = py),
      ),
    [cardStartPositions],
  );

  return {
    handleCardLayout,
    scrollCardToTop,
    initCardPosition,
  };
};

export default useCardLayout;
