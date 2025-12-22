import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';

export default function CalendarScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/events', {
        headers: { 'X-User-Id': 'mock-user-id' }
      });
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
      <Text>{new Date(item.start_time).toLocaleString()} - {new Date(item.end_time).toLocaleTimeString()}</Text>
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

