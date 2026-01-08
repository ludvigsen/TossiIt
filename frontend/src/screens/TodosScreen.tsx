import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, Alert, useColorScheme } from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/env';

// Configure how notifications are handled when received
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const SCHEDULED_KEY = 'scheduledActionItemNotifications';

async function getScheduledMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveScheduledMap(map: Record<string, string>) {
  try {
    await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export default function TodosScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getAuthHeader = async (forceRefresh = false) => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
    let userInfo = await GoogleSignin.getCurrentUser();
    if (!userInfo) {
      try {
        await GoogleSignin.signInSilently();
      } catch {
        throw new Error('Not signed in. Please sign in from the login screen.');
      }
      userInfo = await GoogleSignin.getCurrentUser();
    }
    const tokens = await GoogleSignin.getTokens(forceRefresh ? { forceRefresh: true } : undefined);
    const bearer = tokens.idToken;
    if (!bearer) {
      throw new Error('No idToken available; please sign in again.');
    }
    return {
      Authorization: `Bearer ${bearer}`,
      'X-User-Id': userInfo?.user.id,
    };
  };

  const scheduleNotificationsForItems = async (items: any[]) => {
    try {
      const existingMap = await getScheduledMap();

      for (const item of items) {
        if (!item.dueDate || item.completed) continue;
        const due = new Date(item.dueDate);
        if (isNaN(due.getTime())) continue;

        // Schedule 1 hour before due time (or now+1min if sooner)
        const oneHourBefore = new Date(due.getTime() - 60 * 60 * 1000);
        const triggerTime =
          oneHourBefore.getTime() > Date.now()
            ? oneHourBefore
            : new Date(Date.now() + 60 * 1000);

        if (existingMap[item.id]) {
          // Already scheduled
          continue;
        }

        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: item.title,
            body:
              item.description ||
              `Reminder due at ${due.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}`,
            data: { actionItemId: item.id },
          },
          trigger: triggerTime,
        });

        existingMap[item.id] = id;
      }

      await saveScheduledMap(existingMap);
    } catch (e) {
      console.log('Failed to schedule notifications', e);
    }
  };

  const fetchTodos = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/actionable-items?completed=false`, { headers });
      setItems(res.data);
      await scheduleNotificationsForItems(res.data);
    } catch (error) {
      console.error('Error fetching actionable items', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      // Ask for notification permissions when entering the tab
      (async () => {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      })();

      fetchTodos();
    }, []),
  );

  const toggleComplete = async (item: any, completed: boolean) => {
    try {
      const headers = await getAuthHeader();
      await axios.patch(
        `${API_URL}/actionable-items/${item.id}/complete`,
        { completed },
        { headers },
      );

      // Cancel any scheduled notification if marking complete
      if (completed) {
        const map = await getScheduledMap();
        const notifId = map[item.id];
        if (notifId) {
          try {
            await Notifications.cancelScheduledNotificationAsync(notifId);
          } catch {
            // ignore
          }
          delete map[item.id];
          await saveScheduledMap(map);
        }
      }

      fetchTodos();
    } catch (error) {
      console.error('Error updating actionable item', error);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const renderItem = (item: any) => {
    const due = item.dueDate ? new Date(item.dueDate) : null;
    const overdue = due && due.getTime() < Date.now();
    const dueLabel = due
      ? due.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : null;

    return (
      <View 
        key={item.id} 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 mb-3 rounded-xl ${overdue ? 'border-l-4 border-red-500' : ''}`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.25 : 0.15,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text className={`text-base font-semibold flex-1 mr-2 ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
            {item.title}
          </Text>
          {item.category && (
            <View className="bg-blue-100 px-2 py-1 rounded-xl">
              <Text className="text-xs font-semibold text-blue-700">{item.category}</Text>
            </View>
          )}
        </View>

        {item.description && (
          <Text className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {item.description}
          </Text>
        )}

        <View className="flex-row items-center justify-between mb-2">
          {dueLabel && (
            <Text className={`text-sm ${overdue ? 'text-red-500 font-semibold' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              🗓 {dueLabel}
            </Text>
          )}
          {item.priority && (
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              ⚑ {item.priority}
            </Text>
          )}
        </View>

        {item.people && item.people.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mb-2">
            {item.people.map((p: any) => (
              <View key={p.id} className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-1 rounded-xl`}>
                <Text className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{p.name}</Text>
              </View>
            ))}
          </View>
        )}

        <View className="flex-row justify-end mt-1">
          <TouchableOpacity
            className="bg-green-500 px-3 py-2 rounded-lg"
            onPress={() => toggleComplete(item, true)}
          >
            <Text className="text-white text-sm font-semibold">Mark Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {loading && items.length === 0 ? (
        <ActivityIndicator size="large" className="mt-12" />
      ) : items.length === 0 ? (
        <View className="flex-1 justify-center items-center p-10">
          <Text className="text-6xl mb-4">✅</Text>
          <Text className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            No open todos
          </Text>
          <Text className={`text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            When Gemini finds actionable items in your notes, they will show up here.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          {items.map(renderItem)}
        </ScrollView>
      )}
    </View>
  );
}
