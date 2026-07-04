import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { TVPlayer } from "../components/TVPlayer";
import { api } from "../lib/api";
import { COLORS } from "../lib/constants";
import { useFireTVSocket } from "../hooks/useFireTVSocket";

type Props = StackScreenProps<RootStackParamList, "ChannelPlayer">;

interface NowPlaying {
  title: string;
  hlsUrl: string | null;
  elapsedSeconds: number;
}
interface PinnedProduct {
  title: string;
  price: number;
}

export function ChannelPlayerScreen({ route }: Props) {
  const { channelId } = route.params;
  const socket = useFireTVSocket();
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [product, setProduct] = useState<PinnedProduct | null>(null);
  const [channelHls, setChannelHls] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ item: NowPlaying | null }>(`/api/channels/${channelId}/now-playing`)
      .then((d) => {
        setNow(d.item);
        setChannelHls(d.item?.hlsUrl ?? null);
      })
      .catch(() => setNow(null));
  }, [channelId]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("join-channel", channelId);
    const onPin = (p: PinnedProduct) => setProduct(p);
    socket.on("product-pinned", onPin);
    socket.on("product-unpinned", () => setProduct(null));
    return () => {
      socket.emit("leave-channel", channelId);
      socket.off("product-pinned", onPin);
    };
  }, [socket, channelId]);

  return (
    <View style={styles.container}>
      {channelHls ? (
        <TVPlayer hlsUrl={channelHls} startOffset={now?.elapsedSeconds} />
      ) : (
        <View style={styles.offline}>
          <Text style={styles.offlineText}>Channel offline</Text>
        </View>
      )}

      <View style={styles.bar}>
        <Text style={styles.showTitle}>{now?.title ?? ""}</Text>
      </View>

      {product && (
        <View style={styles.product}>
          <Text style={styles.productTitle}>{product.title}</Text>
          <Text style={styles.productPrice}>${(product.price / 100).toFixed(2)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  offline: { flex: 1, alignItems: "center", justifyContent: "center" },
  offlineText: { color: COLORS.textMuted, fontSize: 24 },
  bar: { position: "absolute", bottom: 40, left: 48 },
  showTitle: { color: COLORS.white, fontSize: 28, fontWeight: "600" },
  product: { position: "absolute", bottom: 40, right: 48, backgroundColor: COLORS.surface1, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  productTitle: { color: COLORS.white, fontSize: 22 },
  productPrice: { color: COLORS.red, fontSize: 24, marginTop: 4 },
});
