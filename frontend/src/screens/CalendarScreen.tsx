import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { API_URL } from '../utils/env';

export default function CalendarScreen() {
  const [events, setEvents] = useState([]);
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
      <View style={[styles.card, { borderLeftColor: categoryColor }]}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.categoryIcon}>{categoryIcon}</Text>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          </View>
          {item.category && (
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
              <Text style={[styles.categoryText, { color: categoryColor }]}>
                {item.category}
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.deleteChip} onPress={handleDelete}>
            <Text style={styles.deleteChipText}>Delete</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🕐</Text>
            <Text style={styles.infoText}>
              {formatTimeRange(item.startTime, item.endTime)}
            </Text>
          </View>
          
          {item.location && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText}>{item.location}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSection = (dateKey: string, events: any[]) => (
    <View key={dateKey} style={styles.section}>
      <Text style={styles.sectionTitle}>{dateKey}</Text>
      {events.map((event: any) => (
        <View key={event.id}>
          {renderItem({ item: event })}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {loading && events.length === 0 ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : Object.keys(groupedEvents).length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyText}>No events scheduled</Text>
          <Text style={styles.emptySubtext}>Events you confirm from the inbox will appear here</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5',
  },
  loader: {
    marginTop: 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    marginLeft: 4,
  },
  card: { 
    backgroundColor: 'white', 
    padding: 16, 
    marginBottom: 12, 
    borderRadius: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  title: { 
    fontSize: 18, 
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    gap: 8,
  },
  deleteChip: {
    backgroundColor: '#f44336',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  deleteChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
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
