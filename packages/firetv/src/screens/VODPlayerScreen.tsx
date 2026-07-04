import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { TVPlayer } from "../components/TVPlayer";
import { api } from "../lib/api";
import { COLORS } from "../lib/constants";

type Props = StackScreenProps<RootStackParamList, "VODPlayer">;

export function VODPlayerScreen({ route }: Props) {
  const { videoId } = route.params;
  const [hls, setHls] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ video: { hls_url: string | null } }>(`/api/videos/${videoId}`)
      .then((d) => setHls(d.video?.hls_url ?? null))
      .catch(() => setHls(null));
  }, [videoId]);

  return (
    <View style={styles.container}>
      {hls ? (
        <TVPlayer hlsUrl={hls} />
      ) : (
        <View style={styles.center}>
          <Text style={styles.text}>Loading…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: COLORS.textMuted, fontSize: 24 },
});
