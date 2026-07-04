import { useRef } from "react";

/**
 * Fire TV focus helper. On react-native-tvos, focus is driven by the native
 * TVFocusGuideView; this hook exposes a ref + default handlers screens use to
 * set the initial focus target on mount.
 */
export function useTVFocusGuide() {
  const ref = useRef(null);
  return { ref };
}
