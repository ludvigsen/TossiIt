import React, { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Image, useColorScheme } from 'react-native';
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
      <View 
        className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 mb-3 mx-4 mt-3 rounded-xl`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.25 : 0.15,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <View className="flex-row justify-between items-center mb-3">
          <Text className={`text-xs flex-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{date}</Text>
          <View className="px-2 py-1 rounded-xl" style={{ backgroundColor: badge.color + '20' }}>
            <Text className="text-xs font-semibold" style={{ color: badge.color }}>{badge.text}</Text>
          </View>
        </View>

        {item.mediaUrl && (
          <Image 
            source={{ 
              uri: item.mediaUrl.startsWith('http') 
                ? item.mediaUrl 
                : `${getImageBaseUrl()}${item.mediaUrl}`
            }} 
            className="w-full h-48 rounded-lg mb-3"
            resizeMode="cover"
          />
        )}

        {item.contentText && (
          <Text className={`text-sm mb-3 leading-5 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
            {item.contentText}
          </Text>
        )}

        {item.outcomeType === 'event' && item.outcome && (
          <View className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} p-3 rounded-lg mb-3`}>
            <Text className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Created Event:
            </Text>
            <Text className={`text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              📅 {item.outcome.title}
            </Text>
            {item.outcome.startTime && (
              <Text className={`text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                🕐 {new Date(item.outcome.startTime).toLocaleString()}
              </Text>
            )}
            {item.outcome.category && (
              <Text className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                🏷️ {item.outcome.category}
              </Text>
            )}
          </View>
        )}

        {item.outcomeType === 'inbox' && item.outcome && (
          <View className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} p-3 rounded-lg mb-3`}>
            <Text className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              In Inbox:
            </Text>
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
                    <Text className={`text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      📝 {proposedData.title}
                    </Text>
                  )}
                  {proposedData.start_time && (
                    <Text className={`text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      🕐 {new Date(proposedData.start_time).toLocaleString()}
                    </Text>
                  )}
                </>
              ) : null;
            })()}
            {item.outcome.confidenceScore !== undefined && item.outcome.confidenceScore !== null && (
              <Text className={`text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Confidence: {(item.outcome.confidenceScore * 100).toFixed(0)}%
              </Text>
            )}
            {item.outcome.flagReason && (
              <Text className={`text-sm ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                ⚠️ {item.outcome.flagReason}
              </Text>
            )}
          </View>
        )}

        <Text className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'} italic`}>
          Source: {item.sourceType}
        </Text>
      </View>
    );
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {loading && items.length === 0 ? (
        <ActivityIndicator size="large" className="mt-12" />
      ) : (
        <FlatList 
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="flex-grow justify-center">
              <Text className={`text-center mt-12 text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                No history yet. Start capturing moments!
              </Text>
            </View>
          }
          contentContainerStyle={items.length === 0 ? { flexGrow: 1 } : undefined}
        />
      )}
    </View>
  );
}
