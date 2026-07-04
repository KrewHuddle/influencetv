import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { api } from "../lib/api";
import { ACTIVATE_URL, COLORS } from "../lib/constants";
import { useAuthStore, type TVUser } from "../store/authStore";

interface GenResponse {
  code: string;
  deviceId: string;
  expiresAt: string;
}
interface PollResponse {
  status?: "pending";
  accessToken?: string;
  refreshToken?: string;
  user?: TVUser;
}

export function CodeLoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [code, setCode] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generate = async () => {
    const res = await api.post<GenResponse>("/api/auth/tv-code/generate", {});
    setCode(res.code);
    setDeviceId(res.deviceId);
  };

  useEffect(() => {
    void generate();
    // Refresh the code every 9 minutes (codes expire at 10).
    const refresh = setInterval(() => void generate(), 9 * 60 * 1000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get<PollResponse>(`/api/auth/tv-code/poll/${deviceId}`);
        if (res.accessToken && res.refreshToken && res.user) {
          if (pollRef.current) clearInterval(pollRef.current);
          setAuth(res.user, res.accessToken, res.refreshToken);
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [deviceId, setAuth]);

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.heading}>Sign In on Your Phone</Text>
        <Text style={styles.code}>{code.split("").join(" ")}</Text>
        <Text style={styles.hint}>Go to apex.tv/activate on your phone</Text>
      </View>
      <View style={styles.right}>
        {code ? (
          <QRCode value={`${ACTIVATE_URL}?code=${code}`} size={220} backgroundColor={COLORS.black} color={COLORS.white} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.black, gap: 80, paddingHorizontal: 80 },
  left: { gap: 24 },
  right: { padding: 20, backgroundColor: COLORS.black },
  heading: { color: COLORS.white, fontSize: 32, fontWeight: "700" },
  code: { color: COLORS.white, fontSize: 80, fontWeight: "800", letterSpacing: 8, fontVariant: ["tabular-nums"] },
  hint: { color: COLORS.textSecondary, fontSize: 22 },
});
