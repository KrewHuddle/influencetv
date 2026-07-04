import React, { useEffect } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useAuthStore } from "./src/store/authStore";

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#080808" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
