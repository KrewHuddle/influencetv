import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useAuthStore } from "../store/authStore";
import { SplashScreen } from "../screens/SplashScreen";
import { LoginOptionsScreen } from "../screens/LoginOptionsScreen";
import { CodeLoginScreen } from "../screens/CodeLoginScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LiveTVScreen } from "../screens/LiveTVScreen";
import { ChannelPlayerScreen } from "../screens/ChannelPlayerScreen";
import { VODPlayerScreen } from "../screens/VODPlayerScreen";
import { BrowseScreen } from "../screens/BrowseScreen";
import { AccountScreen } from "../screens/AccountScreen";

export type RootStackParamList = {
  Splash: undefined;
  LoginOptions: undefined;
  CodeLogin: undefined;
  Home: undefined;
  LiveTV: undefined;
  ChannelPlayer: { channelId: string; slug: string };
  VODPlayer: { videoId: string };
  Browse: undefined;
  Account: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false, cardStyle: { backgroundColor: "#080808" } }}
      >
        {!hydrated ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : !user ? (
          <>
            <Stack.Screen name="LoginOptions" component={LoginOptionsScreen} />
            <Stack.Screen name="CodeLogin" component={CodeLoginScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="LiveTV" component={LiveTVScreen} />
            <Stack.Screen name="ChannelPlayer" component={ChannelPlayerScreen} />
            <Stack.Screen name="VODPlayer" component={VODPlayerScreen} />
            <Stack.Screen name="Browse" component={BrowseScreen} />
            <Stack.Screen name="Account" component={AccountScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
