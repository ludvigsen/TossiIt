import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { API_URL } from '../utils/env';

// Helper to get base URL for images (remove /api suffix)
const getImageBaseUrl = () => {
  const base = API_URL.replace('/api', '');
  return base;
};

interface HistoryItem {
  id: string;
  contentText: string | null;
  mediaUrl: string | null;
  sourceType: string;
  createdAt: string;
  processedAt: string | null;
  outcome: any;
  outcomeType: 'event' | 'inbox' | 'processing' | 'processed' | null;
}

export default function HistoryScreen() {
  const [items, setItems] = useState<HistoryItem[]>([]);
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

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/history`, { headers });
      setItems(res.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchHistory();
    }, [])
  );

  const getOutcomeBadge = (item: HistoryItem) => {
    switch (item.outcomeType) {
      case 'event':
        return { text: '📅 Event', color: '#4CAF50' };
      case 'inbox':
        const status = item.outcome?.status || 'pending';
        if (status === 'approved') {
          return { text: '✅ Approved', color: '#2196F3' };
        } else if (status === 'needs_info') {
          return { text: '❓ Needs Info', color: '#FF9800' };
        } else {
          return { text: '⏳ Pending', color: '#FF9800' };
        }
      case 'processing':
        return { text: '⏳ Processing', color: '#9E9E9E' };
      case 'processed':
        return { text: '✓ Processed', color: '#9E9E9E' };
      default:
        return { text: '❓ Unknown', color: '#9E9E9E' };
    }
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const badge = getOutcomeBadge(item);
    const date = new Date(item.createdAt).toLocaleString();

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.date}>{date}</Text>
          <View style={[styles.badge, { backgroundColor: badge.color + '20' }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        </View>

        {item.mediaUrl && (
          <Image 
            source={{ 
              uri: item.mediaUrl.startsWith('http') 
                ? item.mediaUrl 
                : `${getImageBaseUrl()}${item.mediaUrl}`
            }} 
            style={styles.image}
            resizeMode="cover"
          />
        )}

        {item.contentText && (
          <Text style={styles.text}>{item.contentText}</Text>
        )}

        {item.outcomeType === 'event' && item.outcome && (
          <View style={styles.outcomeBox}>
            <Text style={styles.outcomeTitle}>Created Event:</Text>
            <Text style={styles.outcomeText}>📅 {item.outcome.title}</Text>
            {item.outcome.startTime && (
              <Text style={styles.outcomeText}>
                🕐 {new Date(item.outcome.startTime).toLocaleString()}
              </Text>
            )}
            {item.outcome.category && (
              <Text style={styles.outcomeText}>🏷️ {item.outcome.category}</Text>
            )}
          </View>
        )}

        {item.outcomeType === 'inbox' && item.outcome && (
          <View style={styles.outcomeBox}>
            <Text style={styles.outcomeTitle}>In Inbox:</Text>
            {(() => {
              let proposedData = item.outcome.proposedData;
              if (typeof proposedData === 'string') {
                try {
                  proposedData = JSON.parse(proposedData);
                } catch (e) {
                  proposedData = null;
                }
              }
              
              return proposedData ? (
                <>
                  {proposedData.title && (
                    <Text style={styles.outcomeText}>📝 {proposedData.title}</Text>
                  )}
                  {proposedData.start_time && (
                    <Text style={styles.outcomeText}>
                      🕐 {new Date(proposedData.start_time).toLocaleString()}
                    </Text>
                  )}
                </>
              ) : null;
            })()}
            {item.outcome.confidenceScore !== undefined && item.outcome.confidenceScore !== null && (
              <Text style={styles.outcomeText}>
                Confidence: {(item.outcome.confidenceScore * 100).toFixed(0)}%
              </Text>
            )}
            {item.outcome.flagReason && (
              <Text style={[styles.outcomeText, styles.warning]}>
                ⚠️ {item.outcome.flagReason}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.sourceType}>Source: {item.sourceType}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading && items.length === 0 ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList 
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>No history yet. Start capturing dumps!</Text>
          }
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
        />
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
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: { 
    backgroundColor: 'white', 
    padding: 15, 
    marginBottom: 12, 
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12, 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  date: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
  },
  text: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
    lineHeight: 20,
  },
  outcomeBox: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  outcomeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  outcomeText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  warning: {
    color: '#FF9800',
  },
  sourceType: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  empty: { 
    textAlign: 'center', 
    marginTop: 50, 
    fontSize: 16, 
    color: '#888' 
  },
});

