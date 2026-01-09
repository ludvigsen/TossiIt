import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useColorScheme, View, TouchableOpacity, Text, Platform, StyleSheet, Modal, Pressable, StatusBar } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import PersonOverviewScreen from './src/screens/PersonOverviewScreen';
import SettingsScreen, { setLogoutCallback, setThemeChangeCallback } from './src/screens/SettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getAuthHeaders } from './src/utils/auth';

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
    </SettingsStack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ShareIntentProvider>
        <AppInner />
      </ShareIntentProvider>
    </SafeAreaProvider>
  );
}

function EmptyScreen() {
  return <View style={{ flex: 1 }} />;
}

function MenuOverlay({
  visible,
  onClose,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
}) {
  const bg = isDark ? '#111827' : '#ffffff';
  const card = isDark ? '#1f2937' : '#ffffff';
  const text = isDark ? '#f9fafb' : '#111827';
  const border = isDark ? '#374151' : '#e5e7eb';

  const go = (route: string) => {
    onClose();
    // Navigate to hidden tab routes so bottom tabs stay visible
    // @ts-ignore
    navigationRef.navigate(route);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.drawerBackdrop} onPress={onClose} />
      <View style={[styles.drawerPanel, { backgroundColor: bg, borderLeftColor: border }]}>
        <Text style={[styles.drawerTitle, { color: text }]}>Menu</Text>

        <TouchableOpacity
          style={[styles.drawerItem, { backgroundColor: card, borderColor: border }]}
          onPress={() => go('Inbox')}
        >
          <Ionicons name="mail-outline" size={20} color={text} />
          <Text style={[styles.drawerItemText, { color: text }]}>Inbox</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.drawerItem, { backgroundColor: card, borderColor: border }]}
          onPress={() => go('History')}
        >
          <Ionicons name="time-outline" size={20} color={text} />
          <Text style={[styles.drawerItemText, { color: text }]}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.drawerItem, { backgroundColor: card, borderColor: border }]}
          onPress={() => go('Settings')}
        >
          <Ionicons name="settings-outline" size={20} color={text} />
          <Text style={[styles.drawerItemText, { color: text }]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function MainTabs({ isDark, onOpenMenu }: { isDark: boolean; onOpenMenu: () => void }) {
  const tabBarBg = isDark ? '#1f2937' : '#ffffff';
  const borderTop = isDark ? '#374151' : '#e5e7eb';
  const active = isDark ? '#42a5f5' : '#2196F3';
  const inactive = isDark ? '#9ca3af' : '#6b7280';

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
        // We'll render our own tab bar (below) for perfect spacing + FAB notch.
      })}
      tabBar={({ state, descriptors, navigation }) => {
        // Visible tabs in order. Keep these equally spaced (5 slots).
        const visible = ['Dashboard', 'Calendar', 'Todos', 'People', 'Menu'] as const;
        const visibleRoutes = state.routes.filter((r) => (visible as readonly string[]).includes(r.name));
        const activeRouteName = state.routes[state.index]?.name;
        const focusProxy: Record<string, string> = {
          Inbox: 'Menu',
          History: 'Menu',
          Settings: 'Menu',
          PersonOverview: 'People',
        };
        const effectiveActive = focusProxy[activeRouteName] || activeRouteName;

        return (
          <View style={[styles.tabBarWrap]}>
            <View
              style={[
                styles.tabBar,
                { backgroundColor: tabBarBg, borderTopColor: borderTop },
              ]}
            >
              {visibleRoutes.map((route) => {
                const { options } = descriptors[route.key];
                const isFocused = route.name === effectiveActive;
                const color = isFocused ? active : inactive;
                const notchSide =
                  route.name === 'Calendar' ? 'left' : route.name === 'Todos' ? 'right' : null;
                const flexWeight =
                  route.name === 'Dashboard'
                    ? 1.4
                    : route.name === 'Calendar'
                      ? 1.15
                      : route.name === 'Todos'
                        ? 1.15
                        : route.name === 'People'
                          ? 0.8
                          : route.name === 'Menu'
                            ? 0.6
                            : 1;

                const onPress = () => {
                  if (route.name === 'Menu') {
                    onOpenMenu();
                    return;
                  }
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                };

                const onLongPress = () => {
                  navigation.emit({ type: 'tabLongPress', target: route.key });
                };

                const iconName: keyof typeof Ionicons.glyphMap =
                  route.name === 'Dashboard'
                    ? isFocused
                      ? 'home'
                      : 'home-outline'
                    : route.name === 'Calendar'
                      ? isFocused
                        ? 'calendar'
                        : 'calendar-outline'
                      : route.name === 'Todos'
                        ? isFocused
                          ? 'checkmark-circle'
                          : 'checkmark-circle-outline'
                        : route.name === 'People'
                          ? isFocused
                            ? 'people'
                            : 'people-outline'
                          : isFocused
                            ? 'menu'
                            : 'menu-outline';

                const label =
                  options.tabBarLabel !== undefined
                    ? String(options.tabBarLabel)
                    : options.title !== undefined
                      ? options.title
                      : route.name;

                return (
                  <TouchableOpacity
                    key={route.key}
                    accessibilityRole="button"
                    accessibilityState={isFocused ? { selected: true } : {}}
                    accessibilityLabel={options.tabBarAccessibilityLabel}
                    testID={options.tabBarButtonTestID}
                    onPress={onPress}
                    onLongPress={onLongPress}
                    style={[
                      styles.tabItem,
                      { flex: flexWeight },
                      notchSide === 'left'
                        ? { paddingRight: 28 }
                        : notchSide === 'right'
                          ? { paddingLeft: 28 }
                          : null,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={iconName} size={22} color={color} />
                    <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                      {label === 'Dashboard' ? 'Home' : label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Floating Capture button - centered, half outside the bar */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate('Capture')}
                style={[
                  styles.fab,
                  { backgroundColor: isDark ? '#2563EB' : '#1D4ED8' },
                ]}
              >
                <Ionicons name="scan" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen
        name="Capture"
        component={CaptureScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen name="Todos" component={TodosScreen} />
      <Tab.Screen name="People" component={PeopleScreen} />
      {/* Hidden tab routes (accessible via Menu overlay) */}
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="PersonOverview"
        component={PersonOverviewScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen name="Menu" component={EmptyScreen} />
    </Tab.Navigator>
  );
}

function AppInner() {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');
  const systemColorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { hasShareIntent } = useShareIntentContext();
  const [navReady, setNavReady] = useState(false);
  const [pendingShareNav, setPendingShareNav] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
        const headers = await getAuthHeaders().catch(() => null);
        const bearer = headers?.Authorization?.startsWith('Bearer ')
          ? headers.Authorization.slice('Bearer '.length)
          : null;

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
    <View style={{ flex: 1, backgroundColor: isDark ? '#111827' : '#ffffff', paddingTop: insets.top }}>
      <StatusBar
        translucent={false}
        backgroundColor={isDark ? '#111827' : '#ffffff'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
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
        <MainTabs isDark={isDark} onOpenMenu={() => setMenuOpen(true)} />
        <MenuOverlay visible={menuOpen} onClose={() => setMenuOpen(false)} isDark={isDark} />
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabBar: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    overflow: 'visible',
    // Wider sections + more bottom padding
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    height: Platform.OS === 'ios' ? 104 : 92,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    // Create a "notch" of space around center for the FAB.
    // (We keep 5 equal slots, but nudge inner items away from center.)
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    // Half outside / half inside the tab bar
    top: -28,
    left: '50%',
    transform: [{ translateX: -28 }],
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  drawerPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 280,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 16,
    borderLeftWidth: 1,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 10,
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
