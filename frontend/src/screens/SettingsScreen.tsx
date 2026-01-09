import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useNavigation } from '@react-navigation/native';

const THEME_KEY = 'userThemePreference';

// We'll use a context or event emitter pattern, but for now let's use a simpler approach
// with a callback stored in AsyncStorage or a global event
let globalLogoutCallback: (() => void) | null = null;
let globalThemeChangeCallback: ((theme: 'light' | 'dark' | 'system') => void) | null = null;

export const setLogoutCallback = (callback: () => void) => {
  globalLogoutCallback = callback;
};

export const setThemeChangeCallback = (callback: (theme: 'light' | 'dark' | 'system') => void) => {
  globalThemeChangeCallback = callback;
};

export default function SettingsScreen() {
  const navigation = useNavigation();
  const systemTheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');
  const [isDark, setIsDark] = useState(systemTheme === 'dark');

  useEffect(() => {
    // Load saved theme preference
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
        setThemePreference(saved as 'light' | 'dark' | 'system');
        if (saved === 'system') {
          setIsDark(systemTheme === 'dark');
        } else {
          setIsDark(saved === 'dark');
        }
      }
    });
  }, [systemTheme]);

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setThemePreference(newTheme);
    await AsyncStorage.setItem(THEME_KEY, newTheme);
    
    if (newTheme === 'system') {
      setIsDark(systemTheme === 'dark');
    } else {
      setIsDark(newTheme === 'dark');
    }
    
    if (globalThemeChangeCallback) {
      globalThemeChangeCallback(newTheme);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await GoogleSignin.signOut();
              await AsyncStorage.multiRemove(['userToken', 'userId']);
              if (globalLogoutCallback) {
                globalLogoutCallback();
              }
            } catch (error) {
              console.error('Logout error:', error);
              // Still proceed with logout even if signOut fails
              await AsyncStorage.multiRemove(['userToken', 'userId']);
              if (globalLogoutCallback) {
                globalLogoutCallback();
              }
            }
          },
        },
      ]
    );
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <View className="p-5">
        <Text className={`text-3xl font-bold mb-8 ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
          Settings
        </Text>

        {/* Navigation moved to bottom tabs + drawer */}

        {/* Theme Section */}
        <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-5 mb-5 shadow-sm`}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
            Appearance
          </Text>

          <View className="mb-4">
            <TouchableOpacity
              className="flex-row items-center justify-between py-3 border-b"
              style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}
              onPress={() => handleThemeChange('light')}
            >
              <View className="flex-row items-center">
                <Text className="text-2xl mr-3">☀️</Text>
                <View>
                  <Text className={`text-base font-medium ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
                    Light
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Use light theme
                  </Text>
                </View>
              </View>
              {themePreference === 'light' && (
                <View className="w-6 h-6 rounded-full bg-blue-500 items-center justify-center">
                  <View className="w-3 h-3 rounded-full bg-white" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-between py-3 border-b"
              style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}
              onPress={() => handleThemeChange('dark')}
            >
              <View className="flex-row items-center">
                <Text className="text-2xl mr-3">🌙</Text>
                <View>
                  <Text className={`text-base font-medium ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
                    Dark
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Use dark theme
                  </Text>
                </View>
              </View>
              {themePreference === 'dark' && (
                <View className="w-6 h-6 rounded-full bg-blue-500 items-center justify-center">
                  <View className="w-3 h-3 rounded-full bg-white" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center justify-between py-3"
              onPress={() => handleThemeChange('system')}
            >
              <View className="flex-row items-center">
                <Text className="text-2xl mr-3">📱</Text>
                <View>
                  <Text className={`text-base font-medium ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
                    System
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Follow system setting
                  </Text>
                </View>
              </View>
              {themePreference === 'system' && (
                <View className="w-6 h-6 rounded-full bg-blue-500 items-center justify-center">
                  <View className="w-3 h-3 rounded-full bg-white" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Section */}
        <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-5 mb-5 shadow-sm`}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
            Account
          </Text>

          <TouchableOpacity
            className="flex-row items-center justify-between py-3"
            onPress={handleLogout}
          >
            <View className="flex-row items-center">
              <Text className="text-2xl mr-3">🚪</Text>
              <Text className={`text-base font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                Log Out
              </Text>
            </View>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              →
            </Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-5 shadow-sm`}>
          <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
            About
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
            The Dump
          </Text>
          <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Version 1.0.0
          </Text>
        </View>
      </View>
    </View>
  );
}

