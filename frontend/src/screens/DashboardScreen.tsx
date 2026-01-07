import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, useColorScheme } from 'react-native';
import axios from 'axios';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Markdown from 'react-native-markdown-display';
import { API_URL } from '../utils/env';
import { useNavigation } from '@react-navigation/native';
import { TossItLogo } from '../components/Logo';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [todayTodos, setTodayTodos] = useState<any[]>([]);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const navigation = useNavigation();

  const getAuthHeader = async () => {
    const tokens = await GoogleSignin.getTokens();
    const userInfo = await GoogleSignin.getCurrentUser();
    return { 
        'Authorization': `Bearer ${tokens.idToken}`,
        'X-User-Id': userInfo?.user.id 
    };
  };

  const fetchData = async () => {
    try {
      const headers = await getAuthHeader();
      
      // Fetch Summary
      const summaryRes = await axios.get(`${API_URL}/summary`, { headers });
      setSummary(summaryRes.data.summary);

      // Fetch Events
      const eventsRes = await axios.get(`${API_URL}/events`, { headers });
      // Filter for today
      const today = new Date();
      const events = eventsRes.data.filter((e: any) => {
        const eventDate = new Date(e.startTime);
        return eventDate.toDateString() === today.toDateString();
      });
      setTodayEvents(events);

      // Fetch Todos (simulated for now as we don't have a todos endpoint yet, or use existing local if stored)
      // Assuming we might have a todos endpoint or similar logic. 
      // For now, I'll fetch from the inbox or similar if available, or just leave empty if no dedicated endpoint
      // Let's assume we can get them from the same source as TodosScreen
      // If TodosScreen uses local state, we might need to lift that up or persist it.
      // For this implementation, I will assume we can fetch them or pass them.
      // Since TodosScreen uses local state in the previous code, I'll recommend moving to backend or Context.
      // For now, I'll skip fetching todos from backend if it doesn't exist and focus on Summary + Events
      
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const markdownStyles = {
    body: { color: isDark ? '#E5E7EB' : '#374151', fontSize: 16, lineHeight: 24 },
    heading1: { color: isDark ? '#F9FAFB' : '#111827', fontSize: 24, fontWeight: 'bold', marginBottom: 10, marginTop: 20 },
    heading2: { color: isDark ? '#F9FAFB' : '#111827', fontSize: 20, fontWeight: 'bold', marginBottom: 8, marginTop: 16 },
    paragraph: { marginBottom: 12 },
    list_item: { marginBottom: 6 },
  };

  return (
    <ScrollView 
      className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
    >
      <View className="flex-row justify-between items-center mb-6 mt-2">
        <View>
          <Text className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Good Morning
          </Text>
          <Text className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Here's your daily briefing
          </Text>
        </View>
        <TossItLogo width={50} height={50} color={isDark ? '#60A5FA' : '#2563EB'} />
      </View>

      {/* Daily Summary Card */}
      <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-5 rounded-2xl shadow-sm mb-6`}>
        <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
          ✨ AI Insight
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={isDark ? '#9CA3AF' : '#6B7280'} />
        ) : summary ? (
          <Markdown style={markdownStyles}>
            {summary}
          </Markdown>
        ) : (
          <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>
            No summary available yet. Capture some notes to get started!
          </Text>
        )}
      </View>

      {/* Today's Schedule */}
      <View className="mb-6">
        <View className="flex-row justify-between items-center mb-4">
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Today's Agenda
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Calendar' as never)}>
            <Text className="text-blue-500 font-semibold">See All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : todayEvents.length > 0 ? (
          todayEvents.map((event, index) => (
            <View 
              key={index} 
              className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 mb-3 rounded-xl border-l-4 shadow-sm`}
              style={{ borderLeftColor: '#4CAF50' }} // Default green for now
            >
              <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {event.title}
              </Text>
              <Text className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {event.location ? ` • ${event.location}` : ''}
              </Text>
            </View>
          ))
        ) : (
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl items-center`}>
            <Text className={`text-gray-400 text-center`}>No events scheduled for today</Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View className="flex-row gap-4">
        <TouchableOpacity 
          className="flex-1 bg-blue-600 p-4 rounded-xl items-center shadow-sm"
          onPress={() => navigation.navigate('Capture' as never)}
        >
          <Text className="text-white font-bold text-lg">+ Capture</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

