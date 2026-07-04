import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Video, { type VideoRef } from "react-native-video";

interface Props {
  hlsUrl: string;
  startOffset?: number;
  onError?: () => void;
}

/** Full-screen HLS player for Fire TV (ExoPlayer via react-native-video). */
export function TVPlayer({ hlsUrl, startOffset, onError }: Props) {
  const ref = useRef<VideoRef>(null);
  const [retries, setRetries] = useState(0);

  return (
    <View style={styles.container}>
      <Video
        ref={ref}
        source={{ uri: hlsUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
        controls={false}
        paused={false}
        onLoad={() => {
          if (startOffset && startOffset > 0) ref.current?.seek(startOffset);
        }}
        onError={() => {
          if (retries < 3) {
            setRetries((r) => r + 1);
            setTimeout(() => ref.current?.seek(startOffset ?? 0), 2000 * (retries + 1));
          } else {
            onError?.();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
});
