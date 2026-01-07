import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './src/screens/HomeScreen';
import InboxScreen from './src/screens/InboxScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import TodosScreen from './src/screens/TodosScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import PeopleScreen from './src/screens/PeopleScreen';
import LoginScreen from './src/screens/LoginScreen';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const Tab = createBottomTabNavigator();

export default function App() {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Attempt silent sign-in on app start so user doesn't have to log in every time
  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        // Always try silent sign-in first to refresh credentials if possible
        try {
          await GoogleSignin.signInSilently();
        } catch {
          // If silent sign-in fails, we'll just show the login screen
          console.log('Silent sign-in failed; user may need to login manually');
        }

        // Force-refresh tokens so we never reuse an expired idToken
        const tokens = await GoogleSignin.getTokens({ forceRefresh: true } as any);
        const bearer = tokens.idToken;
        const uid = (await GoogleSignin.getCurrentUser())?.user.id;

        if (bearer && uid) {
          setUserToken(bearer);
          setUserId(uid);
          // Persist for UX (we don't rely on this for auth anymore)
          await AsyncStorage.setItem('userToken', bearer);
          await AsyncStorage.setItem('userId', uid);
        }
      } catch (err) {
        // Ignore and show login screen
        console.log('Silent sign-in not available; showing login screen');
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const handleLogin = async (token: string, id: string) => {
    setUserToken(token);
    setUserId(id);
    await AsyncStorage.setItem('userToken', token);
    await AsyncStorage.setItem('userId', id);
  };

  if (!userToken) {
    if (loading) {
      return null; // Splash could go here
    }
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Capture" component={HomeScreen} />
        <Tab.Screen name="Inbox" component={InboxScreen} />
        <Tab.Screen name="Calendar" component={CalendarScreen} />
        <Tab.Screen name="Todos" component={TodosScreen} />
        <Tab.Screen name="People" component={PeopleScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

