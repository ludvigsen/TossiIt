import React from "react";
import { View, TouchableOpacity, Text, Alert, useColorScheme } from "react-native";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import axios from "axios";
import { API_URL } from "../utils/env";

// Replace with your Web Client ID from Google Cloud Console
// Use the Web client from google-services.json (client_type: 3)
const WEB_CLIENT_ID =
  "201262960432-982te4kthkbo8kdhgg30rgca4k6rh26s.apps.googleusercontent.com";

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  offlineAccess: true, // Needed to get a refresh token for the backend
  scopes: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
});

export default function LoginScreen({
  onLogin,
}: {
  onLogin: (token: string, userId: string) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();

      console.log("User Info:", userInfo);
      console.log("Tokens:", tokens);

      if (userInfo.data?.idToken) {
        // Send tokens to backend to sync/store
        try {
          await axios.post(`${API_URL}/auth/sync-token`, {
            user_id: userInfo.data.user.id, // Google User ID (required)
            email: userInfo.data.user.email,
            server_auth_code: userInfo.data.serverAuthCode || null,
            refresh_token: tokens.refreshToken || null,
          });

          onLogin(userInfo.data.idToken, userInfo.data.user.id);
        } catch (err) {
          console.error("Backend Sync Failed", err);
          console.error(
            "Backend Sync Failed",
            err?.response?.status,
            err?.response?.data || err?.message,
          );
          // Allow login anyway for now?
          onLogin(userInfo.data.idToken, userInfo.data.user.id);
        }
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert("Cancelled");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert("Play Services not available");
      } else {
        console.error(error);
        Alert.alert("Login Error", error.toString());
      }
    }
  };

  return (
    <View className={`flex-1 justify-center items-center p-5 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      <Text className={`text-3xl font-bold mb-12 ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
        Welcome to The Dump
      </Text>
      <TouchableOpacity
        onPress={signIn}
        className={`${isDark ? 'bg-blue-500' : 'bg-blue-600'} py-3 px-8 rounded-lg`}
      >
        <Text className="text-white text-lg font-semibold">Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}
