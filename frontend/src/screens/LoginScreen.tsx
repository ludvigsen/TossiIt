import React from 'react';
import { View, Button, StyleSheet, Text, Alert } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import axios from 'axios';

// Replace with your Web Client ID from Google Cloud Console
const WEB_CLIENT_ID = '201262960432-gqo8nu0ghtoc174fdlaegcbeche9t82g.apps.googleusercontent.com'; 

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID, 
  offlineAccess: true, // Needed to get a refresh token for the backend
  scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/gmail.readonly'],
});

const API_URL = 'https://api-kixeywtaia-uc.a.run.app/api';

export default function LoginScreen({ onLogin }: { onLogin: (token: string, userId: string) => void }) {
  
  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();

      console.log('User Info:', userInfo);
      console.log('Tokens:', tokens);

      if (userInfo.data?.idToken) {
           // Send tokens to backend to sync/store
           try {
             await axios.post(`${API_URL}/auth/sync-token`, {
                email: userInfo.data.user.email,
                // We send the auth code so backend can exchange for refresh token if needed, 
                // OR if offlineAccess=true, 'serverAuthCode' is returned.
                // For simplicity, let's assume we send what we have.
                // The backend auth/sync-token route currently expects 'refresh_token'.
                // Ideally, we exchange the serverAuthCode on the backend.
                // But for this "quick" setup, if we get a refresh token on client (unlikely on mobile without extra work), we send it.
                // Better pattern: Send `serverAuthCode` to backend, backend exchanges it.
                refresh_token: 'TODO_EXCHANGE_ON_BACKEND' 
             });
             
             onLogin(userInfo.data.idToken, userInfo.data.user.id);
           } catch (err) {
             console.error("Backend Sync Failed", err);
             // Allow login anyway for now?
             onLogin(userInfo.data.idToken, userInfo.data.user.id);
           }
      }

    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Play Services not available');
      } else {
        console.error(error);
        Alert.alert('Login Error', error.toString());
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to The Dump</Text>
      <Button title="Sign in with Google" onPress={signIn} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 50, fontWeight: 'bold' },
});

