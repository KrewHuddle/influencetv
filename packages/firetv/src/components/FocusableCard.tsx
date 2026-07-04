import React, { useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { COLORS } from "../lib/constants";

interface Props {
  onSelect?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  hasTVPreferredFocus?: boolean;
  style?: ViewStyle;
  children: ReactNode;
}

/** Base focusable element for D-pad navigation. Scales + rings on focus. */
export function FocusableCard({
  onSelect,
  onFocus,
  onBlur,
  hasTVPreferredFocus,
  style,
  children,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const [focused, setFocused] = useState(false);

  const animate = (to: number) =>
    Animated.timing(scale, {
      toValue: to,
      duration: 150,
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      onPress={onSelect}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => {
        setFocused(true);
        animate(1.05);
        onFocus?.();
      }}
      onBlur={() => {
        setFocused(false);
        animate(1);
        onBlur?.();
      }}
    >
      <Animated.View
        style={[
          styles.card,
          focused && styles.focused,
          { transform: [{ scale }] },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 3,
    borderColor: "transparent",
    backgroundColor: COLORS.surface1,
  },
  focused: { borderColor: COLORS.focus },
});
