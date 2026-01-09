import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, useColorScheme } from 'react-native';
import axios from 'axios';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../utils/env';
import { getAuthHeaders } from '../utils/auth';

export default function PersonOverviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const personId = route?.params?.personId as string | undefined;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const tzOffsetMinutes = new Date().getTimezoneOffset();

  const fetchOverview = async () => {
    if (!personId) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(
        `${API_URL}/person-overview/${personId}?tzOffsetMinutes=${tzOffsetMinutes}`,
        { headers },
      );
      setData(res.data);
    } catch (e) {
      console.error('Failed to fetch person overview', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchOverview();
    }, [personId]),
  );

  const person = data?.person;
  const events = data?.events ?? [];
  const todos = data?.todos ?? [];
  const infos = data?.infos ?? [];
  const inboxItems = data?.inboxItems ?? [];
  const recentDumps = data?.recentDumps ?? [];

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <View className={`${isDark ? 'bg-gray-900' : 'bg-gray-100'} px-4 pt-4 pb-3`}>
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => navigation.navigate('People')}
            className="flex-row items-center"
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={isDark ? '#E5E7EB' : '#111827'}
            />
            <Text className={`text-base font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              People
            </Text>
          </TouchableOpacity>
        </View>

        <Text className={`mt-3 text-2xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {person?.name || 'Person'}
        </Text>
        {!!person?.relationship && (
          <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
            {person.relationship}{person.category ? ` • ${person.category}` : ''}
          </Text>
        )}
      </View>

      {loading && !data ? (
        <ActivityIndicator size="large" className="mt-12" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {/* Todos */}
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-2xl mb-4`}>
            <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              ✅ Todos
            </Text>
            {todos.length === 0 ? (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No active todos.</Text>
            ) : (
              todos.map((t: any) => (
                <View key={t.id} className="py-2 border-b" style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                  <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-semibold`}>
                    {t.title}
                  </Text>
                  {t.dueDate && (
                    <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                      Due: {new Date(t.dueDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Info */}
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-2xl mb-4`}>
            <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              ℹ️ Info
            </Text>
            {infos.length === 0 ? (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No active info.</Text>
            ) : (
              infos.map((i: any) => (
                <View key={i.id} className="py-2 border-b" style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                  <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-semibold`}>
                    {i.title}
                  </Text>
                  {i.expiresAt && (
                    <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                      Expires: {new Date(i.expiresAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Events */}
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-2xl mb-4`}>
            <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              📅 Events
            </Text>
            {events.length === 0 ? (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No linked events.</Text>
            ) : (
              events.slice(0, 20).map((e: any) => (
                <View key={e.id} className="py-2 border-b" style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                  <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-semibold`}>
                    {e.title}
                  </Text>
                  {e.startTime && (
                    <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                      {new Date(e.startTime).toLocaleString()}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Inbox */}
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-2xl mb-4`}>
            <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              📥 Inbox
            </Text>
            {inboxItems.length === 0 ? (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No pending inbox items.</Text>
            ) : (
              inboxItems.slice(0, 10).map((it: any) => (
                <View key={it.id} className="py-2 border-b" style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                  <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-semibold`}>
                    {it.dump?.contentText?.slice?.(0, 80) || 'Inbox item'}
                  </Text>
                  <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                    Status: {it.status}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Recent notes */}
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-2xl mb-4`}>
            <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              📝 Recent notes
            </Text>
            {recentDumps.length === 0 ? (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No recent notes.</Text>
            ) : (
              recentDumps.map((d: any) => (
                <View key={d.id} className="py-2 border-b" style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                  <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    {d.contentText || (d.mediaUrl ? 'Image note' : 'Note')}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}


