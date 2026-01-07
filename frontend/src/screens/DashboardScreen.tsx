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
  const [summaryLoading, setSummaryLoading] = useState(true);
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
      
      // Fetch Dashboard Data (Fast)
      try {
        const dashboardRes = await axios.get(`${API_URL}/dashboard/today`, { headers });
        setTodayEvents(dashboardRes.data.events);
        setTodayTodos(dashboardRes.data.todos);
      } catch (err) {
        console.error('Error fetching dashboard items', err);
      } finally {
        setLoading(false);
      }

      // Fetch Summary (Slow)
      try {
        const summaryRes = await axios.get(`${API_URL}/summary`, { headers });
        setSummary(summaryRes.data.summary);
      } catch (err) {
        console.error('Error fetching summary', err);
      } finally {
        setSummaryLoading(false);
      }
      
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
      setLoading(false);
      setSummaryLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setSummaryLoading(true);
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
        {summaryLoading ? (
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
              style={{ borderLeftColor: '#4CAF50' }}
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

      {/* Priority Tasks */}
      <View className="mb-6">
        <View className="flex-row justify-between items-center mb-4">
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Priority Tasks
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Todos' as never)}>
            <Text className="text-blue-500 font-semibold">See All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : todayTodos.length > 0 ? (
          todayTodos.map((todo, index) => (
            <View 
              key={index} 
              className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 mb-3 rounded-xl border-l-4 shadow-sm`}
              style={{ borderLeftColor: '#FFC107' }}
            >
              <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {todo.title}
              </Text>
              {todo.dueDate && (
                  <Text className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Due: {new Date(todo.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
              )}
            </View>
          ))
        ) : (
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl items-center`}>
            <Text className={`text-gray-400 text-center`}>No tasks due soon</Text>
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

