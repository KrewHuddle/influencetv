import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { FocusableCard } from "../components/FocusableCard";
import { COLORS } from "../lib/constants";
import { useAuthStore } from "../store/authStore";

export function AccountScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{user?.displayName ?? "Viewer"}</Text>
      <Text style={styles.meta}>{user?.email}</Text>
      <Text style={styles.plan}>Plan: {user?.plan}</Text>

      <FocusableCard hasTVPreferredFocus onSelect={() => void signOut()} style={styles.button}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </FocusableCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.black, gap: 12 },
  name: { color: COLORS.white, fontSize: 40, fontWeight: "800" },
  meta: { color: COLORS.textSecondary, fontSize: 22 },
  plan: { color: COLORS.textMuted, fontSize: 20, marginBottom: 24 },
  button: { paddingVertical: 18, paddingHorizontal: 40 },
  buttonText: { color: COLORS.red, fontSize: 24, fontWeight: "600" },
});
