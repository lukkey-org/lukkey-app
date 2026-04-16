/*
 * This file is part of the open source LUKKEY project.
 * Licensed under the MIT License. See LICENSE for details.
 * © Copyright LUKKEY AG
 */
import { useCallback } from "react";

const useNftRoute = ({ route, navigation }) => {
  const nftRouteAction = route?.params?.nftAction || null;
  const nftRoutePayload = route?.params?.nftPayload || route?.params?.nft || null;

  const clearNftRouteAction = useCallback(() => {
    navigation.setParams({ nftAction: null, nftPayload: null });
  }, [navigation]);

  const openNftDetail = useCallback(
    (nft) => {
      navigation.navigate("NFTDetail", { nftPayload: nft });
    },
    [navigation],
  );

  return {
    nftRouteAction,
    nftRoutePayload,
    clearNftRouteAction,
    openNftDetail,
  };
};

export default useNftRoute;
