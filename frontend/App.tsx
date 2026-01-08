import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useColorScheme, View, TouchableOpacity, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import DashboardScreen from './src/screens/DashboardScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import InboxScreen from './src/screens/InboxScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import TodosScreen from './src/screens/TodosScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import PeopleScreen from './src/screens/PeopleScreen';
import SettingsScreen, { setLogoutCallback, setThemeChangeCallback } from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const Tab = createBottomTabNavigator();
const SettingsStack = createStackNavigator();
const THEME_KEY = 'userThemePreference';

export const navigationRef = createNavigationContainerRef();

// Settings Stack Component
function SettingsStackScreen({ navigation }: any) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: isDark ? '#1f2937' : '#ffffff',
          shadowColor: 'transparent',
        },
        headerTintColor: isDark ? '#f9fafb' : '#1f2937',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <SettingsStack.Screen 
        name="SettingsMain" 
        component={SettingsScreen} 
        options={{ 
          title: 'Settings',
          headerLeft: () => (
             <TouchableOpacity 
               onPress={() => navigation.goBack()}
               style={{ marginLeft: 15 }}
             >
               <Ionicons name="close" size={24} color={isDark ? '#f9fafb' : '#1f2937'} />
             </TouchableOpacity>
          ),
        }}
      />
      <SettingsStack.Screen name="People" component={PeopleScreen} />
      <SettingsStack.Screen name="History" component={HistoryScreen} />
    </SettingsStack.Navigator>
  );
}

export default function App() {
  return (
    <ShareIntentProvider>
      <AppInner />
    </ShareIntentProvider>
  );
}

function AppInner() {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');
  const systemColorScheme = useColorScheme();
  const { hasShareIntent } = useShareIntentContext();
  const [navReady, setNavReady] = useState(false);
  const [pendingShareNav, setPendingShareNav] = useState(false);

  const handleLogout = () => {
    setUserToken(null);
    setUserId(null);
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    setThemePreference(theme);
  };

  // Load theme preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
        setThemePreference(saved as 'light' | 'dark' | 'system');
      }
    });
  }, []);

  // Set up callbacks for SettingsScreen
  useEffect(() => {
    setLogoutCallback(handleLogout);
    setThemeChangeCallback(handleThemeChange);
  }, []);

  // Remember that a share intent happened (can arrive before navigation/auth are ready)
  useEffect(() => {
    if (hasShareIntent) {
      setPendingShareNav(true);
    }
  }, [hasShareIntent]);

  // Handle Share Intent Navigation (works on cold start too)
  useEffect(() => {
    if (pendingShareNav && userToken && navReady && navigationRef.isReady()) {
      // Navigate to Capture screen if share intent exists
      // @ts-ignore
      navigationRef.navigate('Capture');
    }
  }, [pendingShareNav, userToken, navReady]);

  // Attempt silent sign-in on app start so user doesn't have to log in every time
  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        // IMPORTANT: never show dialogs during bootstrap (can run before Activity is ready)
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });

        // Only attempt silent sign-in. Never call interactive sign-in here.
        await GoogleSignin.signInSilently();

        const uid = (await GoogleSignin.getCurrentUser())?.user.id;
        const tokens = await GoogleSignin.getTokens().catch(() => ({ idToken: null } as any));
        const bearer = tokens?.idToken;

        if (bearer && uid) {
          setUserToken(bearer);
          setUserId(uid);
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

  // Determine effective theme
  const effectiveTheme = themePreference === 'system' 
    ? (systemColorScheme || 'light')
    : themePreference;
  const isDark = effectiveTheme === 'dark';

  if (!userToken) {
    if (loading) {
      return null; // Splash could go here
    }
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => setNavReady(true)}
      theme={{
        dark: isDark,
        colors: {
          primary: isDark ? '#42a5f5' : '#2196F3',
          background: isDark ? '#111827' : '#ffffff',
          card: isDark ? '#1f2937' : '#ffffff',
          text: isDark ? '#f9fafb' : '#1f2937',
          border: isDark ? '#374151' : '#e5e7eb',
          notification: isDark ? '#ef5350' : '#f44336',
        },
        fonts: {
          regular: {
            fontFamily: 'System',
            fontWeight: '400' as const,
          },
          medium: {
            fontFamily: 'System',
            fontWeight: '500' as const,
          },
          bold: {
            fontFamily: 'System',
            fontWeight: '700' as const,
          },
          heavy: {
            fontFamily: 'System',
            fontWeight: '800' as const,
          },
        },
      }}
    >
      <Tab.Navigator
        screenOptions={({ route, navigation }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Dashboard') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Capture') {
              iconName = focused ? 'add-circle' : 'add-circle-outline';
            } else if (route.name === 'Inbox') {
              iconName = focused ? 'mail' : 'mail-outline';
            } else if (route.name === 'Calendar') {
              iconName = focused ? 'calendar' : 'calendar-outline';
            } else if (route.name === 'Todos') {
              iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
            } else {
              iconName = 'help-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: isDark ? '#42a5f5' : '#2196F3',
          tabBarInactiveTintColor: isDark ? '#9ca3af' : '#6b7280',
          tabBarStyle: {
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderTopColor: isDark ? '#374151' : '#e5e7eb',
            height: Platform.OS === 'ios' ? 88 : 88,
            paddingTop: 8,
            paddingBottom: Platform.OS === 'ios' ? 28 : 16,
            justifyContent: 'space-between',
            alignItems: 'center',
            display: 'flex',
          },
          tabBarItemStyle: {
            flexGrow: 1,
            width: '100%',
            flex: 1, 
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '600',
            marginTop: 2,
          },
          headerStyle: {
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
          },
          headerTintColor: isDark ? '#f9fafb' : '#1f2937',
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate('SettingsStack')} style={{ marginRight: 15 }}>
              <Ionicons name="person-circle-outline" size={28} color={isDark ? '#f9fafb' : '#1f2937'} />
            </TouchableOpacity>
          ),
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Capture" component={CaptureScreen} />
        <Tab.Screen name="Inbox" component={InboxScreen} />
        <Tab.Screen name="Calendar" component={CalendarScreen} />
        <Tab.Screen name="Todos" component={TodosScreen} />
        
        {/* Settings Stack (Hidden from Tab Bar, accessed via header icon) */}
        <Tab.Screen 
          name="SettingsStack" 
          component={SettingsStackScreen} 
          options={{ 
            tabBarButton: () => null,
            headerShown: false // Hide Tab header for the stack
          }} 
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
