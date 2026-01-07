import React, { useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { API_URL } from '../utils/env';

export default function InboxScreen() {
  const [items, setItems] = useState([]);
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

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/inbox`, { headers });
      setItems(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchInbox();
    }, [])
  );

  const confirmItem = async (item: any) => {
    try {
        // Handle proposed_data whether it comes as string or object
        let proposed = item.proposed_data || {};
        if (typeof proposed === 'string') {
            try {
                proposed = JSON.parse(proposed);
            } catch (e) {
                console.error("Failed to parse proposed_data", e);
                proposed = {};
            }
        }

        if (!proposed.title || !proposed.start_time) {
            Alert.alert('Missing Info', 'Please edit to add title/time before confirming.');
            return;
        }

        const userInfo = GoogleSignin.getCurrentUser();
        const headers = await getAuthHeader();

        await axios.post(`${API_URL}/inbox/${item.id}/confirm`, {
            user_id: userInfo?.user.id,
            ...proposed
        }, { headers });
        Alert.alert('Confirmed', 'Event created!');
        fetchInbox();
    } catch (error) {
        Alert.alert('Error', 'Failed to confirm');
        console.error(error);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
     let data = item.proposed_data || {};
     if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) {}
     }
     
     return (
         <View style={styles.card}>
             <Text style={styles.title}>{data.title || 'Untitled Dump'}</Text>
             <Text>{data.start_time ? new Date(data.start_time).toLocaleString() : 'No Date'}</Text>
             <Text>Confidence: {(item.ai_confidence_score * 100).toFixed(0)}%</Text>
             <Text>Status: {item.status}</Text>
             {item.flag_reason && <Text style={styles.warning}>⚠️ {item.flag_reason}</Text>}
             <View style={styles.buttons}>
                <Button title="Confirm" onPress={() => confirmItem(item)} />
                <Button title="Edit" onPress={() => Alert.alert('TODO', 'Edit Modal')} />
             </View>
         </View>
     );
  };

  return (
    <View style={styles.container}>
      {loading && items.length === 0 ? <ActivityIndicator size="large" /> : (
          <FlatList 
            data={items}
            renderItem={renderItem}
            keyExtractor={(item: any) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Inbox is empty!</Text>}
          />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  card: { backgroundColor: 'white', padding: 15, marginBottom: 15, borderRadius: 8, elevation: 2 },
  title: { fontSize: 18, fontWeight: 'bold' },
  warning: { color: 'orange', marginTop: 5 },
  buttons: { flexDirection: 'row', marginTop: 10, justifyContent: 'space-between' },
  empty: { textAlign: 'center', marginTop: 50, fontSize: 18, color: '#888' }
});

