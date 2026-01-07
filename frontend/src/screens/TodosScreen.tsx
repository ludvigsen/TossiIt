import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
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

  const getAuthHeader = async (forceRefresh = false) => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    let userInfo = await GoogleSignin.getCurrentUser();
    if (!userInfo) {
      try {
        await GoogleSignin.signInSilently();
      } catch {
        userInfo = (await GoogleSignin.signIn()) as any;
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
      <View key={item.id} style={[styles.card, overdue && styles.overdueCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{item.title}</Text>
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          )}
        </View>

        {item.description && <Text style={styles.description}>{item.description}</Text>}

        <View style={styles.metaRow}>
          {dueLabel && (
            <Text style={[styles.metaText, overdue && styles.overdueText]}>
              🗓 {dueLabel}
            </Text>
          )}
          {item.priority && (
            <Text style={styles.metaText}>⚑ {item.priority}</Text>
          )}
        </View>

        {item.people && item.people.length > 0 && (
          <View style={styles.peopleRow}>
            {item.people.map((p: any) => (
              <View key={p.id} style={styles.personChip}>
                <Text style={styles.personChipText}>{p.name}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.doneButton]}
            onPress={() => toggleComplete(item, true)}
          >
            <Text style={styles.buttonText}>Mark Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading && items.length === 0 ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>No open todos</Text>
          <Text style={styles.emptySubtext}>
            When Gemini finds actionable items in your dumps, they will show up here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {items.map(renderItem)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loader: {
    marginTop: 50,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  overdueCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
  },
  description: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#666',
  },
  overdueText: {
    color: '#f44336',
    fontWeight: '600',
  },
  peopleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  personChip: {
    backgroundColor: '#f0f4f8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  personChipText: {
    fontSize: 12,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  doneButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
});


