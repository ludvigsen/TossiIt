import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  Modal,
  TextInput,
} from 'react-native';
import axios from 'axios';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { getAuthHeaders } from '../utils/auth';
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
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<any[]>([]);
  const [segment, setSegment] = useState<'todos' | 'archive'>('todos');
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<any[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | ''>('');
  const [formDueDate, setFormDueDate] = useState(''); // YYYY-MM-DD
  const [formPeopleIds, setFormPeopleIds] = useState<string[]>([]);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const tzOffsetMinutes = new Date().getTimezoneOffset();

  // Allow deep-linking into a specific segment (e.g. from Dashboard)
  useEffect(() => {
    const initial = route?.params?.initialSegment as 'todos' | 'archive' | undefined;
    if (initial && initial !== segment) {
      setSegment(initial);
    }
  }, [route?.params?.initialSegment]);

  const getAuthHeader = async (forceRefresh = false) => getAuthHeaders({ forceRefresh });

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
      if (segment === 'todos') {
        const res = await axios.get(
          `${API_URL}/actionable-items?completed=false&tzOffsetMinutes=${tzOffsetMinutes}`,
          { headers },
        );
        setItems(res.data);
        await scheduleNotificationsForItems(res.data);
      } else {
        const res = await axios.get(
          `${API_URL}/actionable-items/archive?tzOffsetMinutes=${tzOffsetMinutes}`,
          { headers },
        );
        setItems(res.data);
      }
    } catch (error) {
      console.error('Error fetching actionable items', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeople = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/people`, { headers });
      setPeople(res.data || []);
    } catch (e) {
      // non-fatal
      console.log('Failed to fetch people for tagging');
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
      fetchPeople();
    }, [segment]),
  );

  const openCreate = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('');
    setFormPriority('');
    setFormDueDate('');
    setFormPeopleIds([]);
    setEditorOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setFormTitle(String(item.title || ''));
    setFormDescription(String(item.description || ''));
    setFormCategory(String(item.category || ''));
    setFormPriority((item.priority as any) || '');
    setFormDueDate(item.dueDate ? String(item.dueDate).slice(0, 10) : '');
    setFormPeopleIds(Array.isArray(item.people) ? item.people.map((p: any) => p.id) : []);
    setEditorOpen(true);
  };

  const togglePerson = (id: string) => {
    setFormPeopleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitEditor = async () => {
    const title = formTitle.trim();
    if (!title) {
      Alert.alert('Missing', 'Title is required');
      return;
    }
    try {
      const headers = await getAuthHeader();
      const payload: any = {
        title,
        description: formDescription.trim() || null,
        category: formCategory.trim() || null,
        priority: formPriority || null,
        dueDate: formDueDate.trim() ? formDueDate.trim() : null,
        peopleIds: formPeopleIds,
      };

      if (editingItem) {
        await axios.patch(`${API_URL}/actionable-items/${editingItem.id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/actionable-items`, payload, { headers });
      }

      setEditorOpen(false);
      setEditingItem(null);
      fetchTodos();
    } catch (e: any) {
      console.error('Failed to save item', e);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save');
    }
  };

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

  const archiveItem = async (item: any) => {
    try {
      const headers = await getAuthHeader();
      await axios.patch(`${API_URL}/actionable-items/${item.id}/archive`, {}, { headers });
      fetchTodos();
    } catch (error) {
      console.error('Error archiving item', error);
      Alert.alert('Error', 'Failed to archive item');
    }
  };

  const unarchiveItem = async (item: any) => {
    try {
      const headers = await getAuthHeader();
      await axios.patch(`${API_URL}/actionable-items/${item.id}/unarchive`, {}, { headers });
      fetchTodos();
    } catch (error) {
      console.error('Error unarchiving item', error);
      Alert.alert('Error', 'Failed to unarchive item');
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
          {segment !== 'archive' && (
            <TouchableOpacity
              onPress={() => openEdit(item)}
              className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-1 rounded-xl`}
            >
              <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-xs font-semibold`}>
                Edit
              </Text>
            </TouchableOpacity>
          )}
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
          <View className="mb-2">
            <Text className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              For:
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {item.people.map((p: any) => (
                <View key={p.id} className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-1 rounded-xl`}>
                  <Text className={`text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{p.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="flex-row justify-end mt-1">
          {segment === 'archive' ? (
            <TouchableOpacity
              className="bg-blue-500 px-3 py-2 rounded-lg"
              onPress={() => unarchiveItem(item)}
            >
              <Text className="text-white text-sm font-semibold">Unarchive</Text>
            </TouchableOpacity>
          ) : (
            <View className="flex-row gap-2">
              {item.dump?.id && (
                <TouchableOpacity
                  className="bg-blue-500 px-3 py-2 rounded-lg"
                  onPress={() => navigation.navigate('DocumentDetail' as never, { documentId: item.dump.id } as never)}
                >
                  <Text className="text-white text-sm font-semibold">📄 Document</Text>
                </TouchableOpacity>
              )}
              {segment === 'todos' && (
                <TouchableOpacity
                  className="bg-green-500 px-3 py-2 rounded-lg"
                  onPress={() => toggleComplete(item, true)}
                >
                  <Text className="text-white text-sm font-semibold">Mark Done</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className={`${isDark ? 'bg-gray-700' : 'bg-gray-200'} px-3 py-2 rounded-lg`}
                onPress={() => archiveItem(item)}
              >
                <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'} text-sm font-semibold`}>
                  Archive
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <View className="px-4 pt-4 pb-3">
        <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-1 rounded-2xl flex-row`}>
          <TouchableOpacity
            className={`flex-1 py-2 rounded-2xl items-center ${segment === 'todos' ? (isDark ? 'bg-gray-700' : 'bg-gray-200') : ''}`}
            onPress={() => setSegment('todos')}
          >
            <Text className={`${segment === 'todos' ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-gray-300' : 'text-gray-600')} font-semibold`}>
              Todos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 rounded-2xl items-center ${segment === 'archive' ? (isDark ? 'bg-gray-700' : 'bg-gray-200') : ''}`}
            onPress={() => setSegment('archive')}
          >
            <Text className={`${segment === 'archive' ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-gray-300' : 'text-gray-600')} font-semibold`}>
              Archive
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {segment === 'todos' && (
        <View className="px-4 pb-2">
          <TouchableOpacity
            className="bg-blue-600 py-3 rounded-2xl items-center"
            onPress={openCreate}
          >
            <Text className="text-white font-extrabold">
              + New Todo
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && items.length === 0 ? (
        <ActivityIndicator size="large" className="mt-12" />
      ) : items.length === 0 ? (
        <View className="flex-1 justify-center items-center p-10">
          <Text className="text-6xl mb-4">
            {segment === 'todos' ? '✅' : '🗄️'}
          </Text>
          <Text className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {segment === 'todos' ? 'No open todos' : 'Archive is empty'}
          </Text>
          <Text className={`text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            {segment === 'todos'
              ? 'When Gemini finds actionable items in your notes, they will show up here.'
              : 'Completed and stale items will show up here.'}
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          {items.map(renderItem)}
        </ScrollView>
      )}

      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl p-5 max-h-[85%]`}>
            <View className="flex-row items-center justify-between">
              <Text className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {editingItem ? 'Edit' : 'New'} Todo
              </Text>
              <TouchableOpacity onPress={() => setEditorOpen(false)}>
                <Text className={`${isDark ? 'text-gray-300' : 'text-gray-600'} font-bold`}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="mt-4">
              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-1`}>Title *</Text>
              <TextInput
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="What needs doing?"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
              />

              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-1 mt-3`}>Description</Text>
              <TextInput
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Optional details…"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                multiline
                className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
              />

              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-1 mt-3`}>Category</Text>
              <TextInput
                value={formCategory}
                onChangeText={setFormCategory}
                placeholder="school, family, work…"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
              />

              {(editingItem?.kind === 'todo' || (!editingItem && segment === 'todos')) && (
                <>
                  <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-1 mt-3`}>Due date (YYYY-MM-DD)</Text>
                  <TextInput
                    value={formDueDate}
                    onChangeText={setFormDueDate}
                    placeholder="2026-01-08"
                    placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                    className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
                  />

                  <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-2 mt-3`}>Priority</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(['high', 'medium', 'low'] as const).map((p) => {
                      const selected = formPriority === p;
                      return (
                        <TouchableOpacity
                          key={p}
                          onPress={() => setFormPriority(selected ? '' : p)}
                          className={`${selected ? 'bg-blue-600' : isDark ? 'bg-gray-800' : 'bg-gray-100'} px-3 py-2 rounded-2xl`}
                        >
                          <Text className={`${selected ? 'text-white' : isDark ? 'text-gray-200' : 'text-gray-800'} font-bold text-xs`}>
                            {p}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}


              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-2 mt-4`}>People</Text>
              {people.length === 0 ? (
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>No people yet.</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {people.map((p: any) => {
                    const selected = formPeopleIds.includes(p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => togglePerson(p.id)}
                        className={`${selected ? 'bg-blue-600' : isDark ? 'bg-gray-800' : 'bg-gray-100'} px-3 py-2 rounded-2xl`}
                      >
                        <Text className={`${selected ? 'text-white' : isDark ? 'text-gray-200' : 'text-gray-800'} font-bold text-xs`}>
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity className="mt-5 bg-blue-600 py-4 rounded-2xl items-center" onPress={submitEditor}>
                <Text className="text-white font-extrabold">Save</Text>
              </TouchableOpacity>
              <View className="h-8" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
