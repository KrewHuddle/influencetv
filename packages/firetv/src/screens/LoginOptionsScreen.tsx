import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { FocusableCard } from "../components/FocusableCard";
import { COLORS } from "../lib/constants";

type Props = StackScreenProps<RootStackParamList, "LoginOptions">;

export function LoginOptionsScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>APEX</Text>
      <Text style={styles.sub}>Sign in to start watching</Text>
      <FocusableCard
        hasTVPreferredFocus
        onSelect={() => navigation.navigate("CodeLogin")}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Sign In on Your Phone</Text>
      </FocusableCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.black, gap: 24 },
  logo: { color: COLORS.white, fontSize: 56, fontWeight: "800", letterSpacing: 6 },
  sub: { color: COLORS.textSecondary, fontSize: 24 },
  button: { paddingVertical: 20, paddingHorizontal: 48, marginTop: 16 },
  buttonText: { color: COLORS.white, fontSize: 26, fontWeight: "600" },
});
