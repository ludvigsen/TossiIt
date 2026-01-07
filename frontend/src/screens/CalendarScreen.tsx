import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
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
      // Force refresh token if requested or if token might be expired
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
      setEvents(res.data);
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

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text>
        {new Date(item.start_time).toLocaleString()}
        {item.end_time ? ` - ${new Date(item.end_time).toLocaleTimeString()}` : ''}
      </Text>
      <Text>Location: {item.location || 'N/A'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading && events.length === 0 ? <ActivityIndicator size="large" /> : (
          <FlatList 
            data={events}
            renderItem={renderItem}
            keyExtractor={(item: any) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>No events scheduled.</Text>}
          />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  card: { backgroundColor: '#e6f7ff', padding: 15, marginBottom: 15, borderRadius: 8 },
  title: { fontSize: 18, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 50, fontSize: 18, color: '#888' }
});

