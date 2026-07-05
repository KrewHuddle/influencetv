import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { FocusableCard } from "../components/FocusableCard";
import { api } from "../lib/api";
import { COLORS } from "../lib/constants";

type Props = StackScreenProps<RootStackParamList, "Browse">;

interface Video {
  id: string;
  title: string;
  creator_name?: string | null;
}

export function BrowseScreen({ navigation }: Props) {
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    api
      .get<{ items: Video[] }>("/api/browse?sort=new")
      .then((d) => setVideos(d.items ?? []))
      .catch(() => setVideos([]));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Browse</Text>
      <View style={styles.grid}>
        {videos.map((v, i) => (
          <FocusableCard
            key={v.id}
            hasTVPreferredFocus={i === 0}
            onSelect={() => navigation.navigate("VODPlayer", { videoId: v.id })}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{v.title}</Text>
            <Text style={styles.cardMeta}>{v.creator_name ?? "Influence TV"}</Text>
          </FocusableCard>
        ))}
        {videos.length === 0 && <Text style={styles.empty}>Nothing to browse yet.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  content: { padding: 48 },
  title: { color: COLORS.white, fontSize: 40, fontWeight: "800", marginBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  card: { width: 360, height: 200, padding: 20, justifyContent: "flex-end" },
  cardTitle: { color: COLORS.white, fontSize: 24, fontWeight: "600" },
  cardMeta: { color: COLORS.textMuted, fontSize: 18, marginTop: 4 },
  empty: { color: COLORS.textMuted, fontSize: 22 },
});
