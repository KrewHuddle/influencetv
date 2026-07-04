import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../lib/constants";

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>APEX</Text>
      <ActivityIndicator color={COLORS.red} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.black, gap: 32 },
  logo: { color: COLORS.white, fontSize: 64, fontWeight: "800", letterSpacing: 8 },
});
