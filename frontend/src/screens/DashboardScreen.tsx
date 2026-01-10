import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, useColorScheme } from 'react-native';
import axios from 'axios';
import Markdown from 'react-native-markdown-display';
import { API_URL } from '../utils/env';
import { useNavigation } from '@react-navigation/native';
import { OrganizelLogo } from '../components/Logo';
import { getAuthHeaders } from '../utils/auth';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [todayTodos, setTodayTodos] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [upcomingTodos, setUpcomingTodos] = useState<any[]>([]);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const navigation = useNavigation();

  const renderPeople = (people: any[] | undefined) => {
    if (!people || people.length === 0) return null;
    return (
      <View className="flex-row flex-wrap gap-2 mt-2">
        {people.map((p: any) => (
          <View key={p.id ?? p.name} className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-1 rounded-xl`}>
            <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-xs font-semibold`}>
              {p.name}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const fetchData = async () => {
    try {
      const headers = await getAuthHeaders();
      const tzOffsetMinutes = new Date().getTimezoneOffset();
      
      // Fetch Dashboard Data (Fast)
      try {
        const dashboardRes = await axios.get(`${API_URL}/dashboard/today`, { headers, params: { tzOffsetMinutes } });
        const todos = dashboardRes.data.todos || [];
        // Debug: log first todo to check structure
        if (todos.length > 0) {
          console.log('First todo from API:', JSON.stringify(todos[0], null, 2));
        }
        setTodayEvents(dashboardRes.data.events || []);
        setTodayTodos(todos);
        setUpcomingEvents(dashboardRes.data.upcomingEvents || []);
        setUpcomingTodos(dashboardRes.data.upcomingTodos || []);
      } catch (err) {
        console.error('Error fetching dashboard items', err);
      } finally {
        setLoading(false);
      }

      // Fetch Summary (Slow)
      try {
        const summaryRes = await axios.get(`${API_URL}/summary`, { headers, params: { tzOffsetMinutes } });
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

  const refreshToday = async () => {
    try {
      const headers = await getAuthHeaders();
      const tzOffsetMinutes = new Date().getTimezoneOffset();
      const dashboardRes = await axios.get(`${API_URL}/dashboard/today`, { headers, params: { tzOffsetMinutes } });
      setTodayEvents(dashboardRes.data.events || []);
      setTodayTodos(dashboardRes.data.todos || []);
      setUpcomingEvents(dashboardRes.data.upcomingEvents || []);
      setUpcomingTodos(dashboardRes.data.upcomingTodos || []);
    } catch (e) {
      console.error('Failed to refresh dashboard', e);
    }
  };

  const completeTodo = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      await axios.patch(`${API_URL}/actionable-items/${id}/complete`, { completed: true }, { headers });
      await refreshToday();
    } catch (e) {
      console.error('Failed to complete todo', e);
    }
  };

  const archiveItem = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      await axios.patch(`${API_URL}/actionable-items/${id}/archive`, {}, { headers });
      await refreshToday();
    } catch (e) {
      console.error('Failed to archive item', e);
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
        <OrganizelLogo width={50} height={50} color={isDark ? '#60A5FA' : '#2563EB'} />
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
            {todayEvents.length === 0 && todayTodos.length === 0 
              ? "Nothing on your agenda today. Enjoy your free day! 🎉"
              : "AI insights will appear here as you capture more notes."}
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
              {renderPeople(event.people)}
            </View>
          ))
        ) : (
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl`}>
            <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-center font-semibold mb-2`}>
              No events scheduled for today
            </Text>
            {upcomingEvents.length > 0 && (
              <View className="mt-4">
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm font-semibold mb-2`}>
                  Coming up:
                </Text>
                {upcomingEvents.slice(0, 3).map((event, index) => (
                  <View key={index} className="mb-2">
                    <Text className={`${isDark ? 'text-gray-300' : 'text-gray-800'} text-sm`}>
                      📅 {event.title} • {new Date(event.startTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                ))}
              </View>
            )}
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
          todayTodos.map((todo, index) => {
            // Handle both camelCase and snake_case field names
            const dueDate = todo.dueDate || todo.due_date;
            return (
            <View 
              key={index} 
              className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 mb-3 rounded-xl border-l-4 shadow-sm`}
              style={{ borderLeftColor: '#FFC107' }}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {todo.title}
                  </Text>
                  {dueDate && (
                    <View className="flex-row items-center mt-2">
                      <Text className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                        🗓️ Due: {new Date(dueDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => completeTodo(todo.id)}
                    className="bg-green-600 px-3 py-2 rounded-xl"
                  >
                    <Text className="text-white font-bold text-xs">Done</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => archiveItem(todo.id)}
                    className={`${isDark ? 'bg-gray-700' : 'bg-gray-200'} px-3 py-2 rounded-xl`}
                  >
                    <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} font-bold text-xs`}>Archive</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {renderPeople(todo.people)}
            </View>
            );
          })
        ) : (
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-xl`}>
            <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-center font-semibold mb-2`}>
              No tasks due today
            </Text>
            {upcomingTodos.length > 0 && (
              <View className="mt-4">
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm font-semibold mb-2`}>
                  Upcoming:
                </Text>
                {upcomingTodos.slice(0, 3).map((todo, index) => (
                  <View key={index} className="mb-2">
                    <Text className={`${isDark ? 'text-gray-300' : 'text-gray-800'} text-sm`}>
                      ✅ {todo.title} • {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'No due date'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
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

