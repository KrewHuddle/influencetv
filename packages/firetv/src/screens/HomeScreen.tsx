import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { FocusableCard } from "../components/FocusableCard";
import { api } from "../lib/api";
import { COLORS } from "../lib/constants";

type Props = StackScreenProps<RootStackParamList, "Home">;

interface Channel {
  id: string;
  name: string;
  slug: string;
  status: string;
  current_show?: string | null;
  viewer_count?: number | null;
}

export function HomeScreen({ navigation }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);

  useEffect(() => {
    api
      .get<{ channels: Channel[] }>("/api/channels")
      .then((d) => setChannels(d.channels ?? []))
      .catch(() => setChannels([]));
  }, []);

  const live = channels.filter((c) => c.status === "active");
  const featured = live[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{featured?.name ?? "INFLUENCE TV"}</Text>
        <Text style={styles.heroSub}>{featured?.current_show ?? "Live TV · VOD · Shop"}</Text>
      </View>

      <Text style={styles.rowLabel}>LIVE NOW</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {live.map((c, i) => (
          <FocusableCard
            key={c.id}
            hasTVPreferredFocus={i === 0}
            onSelect={() => navigation.navigate("ChannelPlayer", { channelId: c.id, slug: c.slug })}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{c.name}</Text>
            <Text style={styles.cardMeta}>{c.viewer_count ?? 0} watching</Text>
          </FocusableCard>
        ))}
        {live.length === 0 && <Text style={styles.empty}>No live channels.</Text>}
      </ScrollView>

      <View style={styles.navRow}>
        <FocusableCard onSelect={() => navigation.navigate("LiveTV")} style={styles.navCard}>
          <Text style={styles.cardTitle}>Live Guide</Text>
        </FocusableCard>
        <FocusableCard onSelect={() => navigation.navigate("Browse")} style={styles.navCard}>
          <Text style={styles.cardTitle}>Browse</Text>
        </FocusableCard>
        <FocusableCard onSelect={() => navigation.navigate("Account")} style={styles.navCard}>
          <Text style={styles.cardTitle}>Account</Text>
        </FocusableCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  content: { padding: 48 },
  hero: { height: 260, justifyContent: "center" },
  heroTitle: { color: COLORS.white, fontSize: 56, fontWeight: "800" },
  heroSub: { color: COLORS.textSecondary, fontSize: 26, marginTop: 8 },
  rowLabel: { color: COLORS.white, fontSize: 18, fontWeight: "700", marginBottom: 12, letterSpacing: 2 },
  row: { gap: 20, paddingBottom: 12 },
  card: { width: 300, height: 180, padding: 20, justifyContent: "flex-end" },
  navRow: { flexDirection: "row", gap: 20, marginTop: 32 },
  navCard: { width: 220, height: 120, padding: 20, justifyContent: "center" },
  cardTitle: { color: COLORS.white, fontSize: 24, fontWeight: "600" },
  cardMeta: { color: COLORS.textMuted, fontSize: 18, marginTop: 4 },
  empty: { color: COLORS.textMuted, fontSize: 20 },
});
