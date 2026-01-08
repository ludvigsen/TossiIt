import React, { useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, Alert, useColorScheme } from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { API_URL } from '../utils/env';

export default function CalendarScreen() {
  const [events, setEvents] = useState([]);
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
          'Authorization': `Bearer ${bearer}`,
          'X-User-Id': userInfo?.user.id 
      };
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/events`, { headers });
      
      // Deduplicate events by title and startTime (within 1 hour window)
      const uniqueEvents = res.data.reduce((acc: any[], event: any) => {
        const existing = acc.find((e: any) => {
          const sameTitle = e.title.toLowerCase() === event.title.toLowerCase();
          const timeDiff = Math.abs(new Date(e.startTime).getTime() - new Date(event.startTime).getTime());
          const withinHour = timeDiff < 60 * 60 * 1000; // 1 hour
          return sameTitle && withinHour;
        });
        
        if (!existing) {
          acc.push(event);
        }
        return acc;
      }, []);
      
      setEvents(uniqueEvents);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchEvents();
    }, [])
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Date TBD';
      }
      
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const isToday = date.toDateString() === today.toDateString();
      const isTomorrow = date.toDateString() === tomorrow.toDateString();
      
      if (isToday) {
        return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      } else if (isTomorrow) {
        return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      } else {
        return date.toLocaleDateString('en-US', { 
          weekday: 'long',
          month: 'long', 
          day: 'numeric',
          year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        }) + ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
    } catch (e) {
      return 'Date TBD';
    }
  };

  const formatTimeRange = (startTime: string, endTime: string | null) => {
    try {
      const start = new Date(startTime);
      if (isNaN(start.getTime())) return 'Time TBD';
      
      if (!endTime) {
        return start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
      
      const end = new Date(endTime);
      if (isNaN(end.getTime())) {
        return start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
      
      return `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } catch (e) {
      return 'Time TBD';
    }
  };

  const getCategoryColor = (category: string | null) => {
    switch (category?.toLowerCase()) {
      case 'school': return '#4CAF50';
      case 'work': return '#2196F3';
      case 'family': return '#FF9800';
      case 'sports':
      case 'soccer': return '#9C27B0';
      case 'personal': return '#E91E63';
      default: return '#757575';
    }
  };

  const getCategoryIcon = (category: string | null) => {
    switch (category?.toLowerCase()) {
      case 'school': return '📚';
      case 'work': return '💼';
      case 'family': return '👨‍👩‍👧‍👦';
      case 'sports':
      case 'soccer': return '⚽';
      case 'personal': return '⭐';
      default: return '📅';
    }
  };

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    
    events.forEach((event: any) => {
      try {
        const date = new Date(event.startTime);
        if (isNaN(date.getTime())) {
          const key = 'TBD';
          if (!groups[key]) groups[key] = [];
          groups[key].push(event);
          return;
        }
        
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let key: string;
        if (date.toDateString() === today.toDateString()) {
          key = 'Today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
          key = 'Tomorrow';
        } else {
          key = date.toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'long', 
            day: 'numeric',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
          });
        }
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(event);
      } catch (e) {
        const key = 'TBD';
        if (!groups[key]) groups[key] = [];
        groups[key].push(event);
      }
    });
    
    return groups;
  }, [events]);

  const renderItem = ({ item }: { item: any }) => {
    const categoryColor = getCategoryColor(item.category);
    const categoryIcon = getCategoryIcon(item.category);
    
    const handleDelete = () => {
      Alert.alert(
        'Delete Event',
        `Delete "${item.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: async () => {
              try {
                const headers = await getAuthHeader();
                await axios.delete(`${API_URL}/events/${item.id}`, { headers });
                fetchEvents();
              } catch (error) {
                console.error('Delete event failed', error);
                Alert.alert('Error', 'Failed to delete event');
              }
            } 
          }
        ]
      );
    };
    
    return (
      <View 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-5 mb-4 rounded-xl border-l-4`}
        style={{ 
          borderLeftColor: categoryColor,
          borderLeftWidth: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.25 : 0.15,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <View className="flex-row items-start mb-3">
          <Text className="text-3xl mr-4">{categoryIcon}</Text>
          <View className="flex-1">
            <Text className={`text-xl font-bold mb-3 ${isDark ? 'text-gray-50' : 'text-gray-900'}`} numberOfLines={2}>
              {item.title}
            </Text>
            <View className="flex-row items-center mb-2">
              <Text className="text-lg mr-2">🕐</Text>
              <Text className={`text-base font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {formatTimeRange(item.startTime, item.endTime)}
              </Text>
            </View>
            {item.location && (
              <View className="flex-row items-center">
                <Text className="text-lg mr-2">📍</Text>
                <Text className={`text-base flex-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {item.location}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View className="flex-row items-center justify-between mt-2 pt-3 border-t" style={{ borderTopColor: isDark ? '#374151' : '#e5e7eb' }}>
          {item.category && (
            <View 
              className="px-3 py-1.5 rounded-full" 
              style={{ backgroundColor: categoryColor + '20' }}
            >
              <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: categoryColor }}>
                {item.category}
              </Text>
            </View>
          )}
          <TouchableOpacity 
            className="bg-red-500 px-4 py-2 rounded-lg" 
            onPress={handleDelete}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 2,
            }}
          >
            <Text className="text-white text-sm font-bold">Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSection = (dateKey: string, events: any[]) => (
    <View key={dateKey} className="mb-8">
      <Text className={`text-2xl font-bold mb-5 ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
        {dateKey}
      </Text>
      {events.map((event: any) => (
        <View key={event.id}>
          {renderItem({ item: event })}
        </View>
      ))}
    </View>
  );

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {loading && events.length === 0 ? (
        <ActivityIndicator size="large" className="mt-12" />
      ) : Object.keys(groupedEvents).length === 0 ? (
        <View className="flex-1 justify-center items-center p-10">
          <Text className="text-6xl mb-6">📅</Text>
          <Text className={`text-2xl font-bold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            No events scheduled
          </Text>
          <Text className={`text-base text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Events you confirm from the inbox will appear here
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {Object.entries(groupedEvents)
            .sort(([a], [b]) => {
              if (a === 'Today') return -1;
              if (b === 'Today') return 1;
              if (a === 'Tomorrow') return -1;
              if (b === 'Tomorrow') return 1;
              if (a === 'TBD') return 1;
              if (b === 'TBD') return -1;
              return a.localeCompare(b);
            })
            .map(([dateKey, events]) => renderSection(dateKey, events))}
        </ScrollView>
      )}
    </View>
  );
}
