import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { FocusableCard } from "../components/FocusableCard";
import { api } from "../lib/api";
import { COLORS } from "../lib/constants";

type Props = StackScreenProps<RootStackParamList, "LiveTV">;

interface GuideChannel {
  id: string;
  name: string;
  slug: string;
  number?: number;
  items?: Array<{ id: string; title: string }>;
}

export function LiveTVScreen({ navigation }: Props) {
  const [channels, setChannels] = useState<GuideChannel[]>([]);

  useEffect(() => {
    api
      .get<{ channels: GuideChannel[] }>("/api/channels/guide")
      .then((d) => setChannels(d.channels ?? []))
      .catch(() => setChannels([]));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Live TV Guide</Text>
      {channels.map((ch, i) => (
        <FocusableCard
          key={ch.id}
          hasTVPreferredFocus={i === 0}
          onSelect={() => navigation.navigate("ChannelPlayer", { channelId: ch.id, slug: ch.slug })}
          style={styles.row}
        >
          <Text style={styles.channelName}>{ch.name}</Text>
          <Text style={styles.now}>{ch.items?.[0]?.title ?? "No programming"}</Text>
        </FocusableCard>
      ))}
      {channels.length === 0 && <Text style={styles.empty}>No channels.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  content: { padding: 48, gap: 16 },
  title: { color: COLORS.white, fontSize: 40, fontWeight: "800", marginBottom: 16 },
  row: { padding: 24, flexDirection: "row", justifyContent: "space-between" },
  channelName: { color: COLORS.white, fontSize: 26, fontWeight: "600" },
  now: { color: COLORS.textSecondary, fontSize: 22 },
  empty: { color: COLORS.textMuted, fontSize: 22 },
});
