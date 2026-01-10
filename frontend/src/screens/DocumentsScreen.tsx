import React, { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Image, TouchableOpacity, useColorScheme } from 'react-native';
import axios from 'axios';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getAuthHeaders } from '../utils/auth';
import { API_URL } from '../utils/env';

// Helper to get base URL for images (remove /api suffix)
const getImageBaseUrl = () => {
  const base = API_URL.replace('/api', '');
  return base;
};

interface Document {
  id: string;
  contentText: string | null;
  mediaUrl: string | null;
  sourceType: string;
  category: string | null;
  infoContext: any[] | null;
  createdAt: string;
  processedAt: string | null;
  people: Array<{ id: string; name: string; relationship: string | null }>;
  events: Array<{ id: string; title: string; startTime: string }>;
  actionItems: Array<{ id: string; title: string; completed: boolean; dueDate: string | null }>;
}

export default function DocumentsScreen() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const navigation = useNavigation<any>();

  const getAuthHeader = async (forceRefresh = false) => getAuthHeaders({ forceRefresh });

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/documents`, { headers });
      setDocuments(res.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchDocuments();
    }, [])
  );

  const renderItem = ({ item }: { item: Document }) => {
    const date = new Date(item.createdAt).toLocaleDateString();
    const hasImage = !!item.mediaUrl;
    const imageUrl = item.mediaUrl?.startsWith('http') 
      ? item.mediaUrl 
      : `${getImageBaseUrl()}${item.mediaUrl}`;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('DocumentDetail', { documentId: item.id })}
        className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 mb-3 mx-4 mt-3 rounded-xl`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.25 : 0.15,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            {item.category && (
              <View className={`${isDark ? 'bg-blue-900' : 'bg-blue-100'} px-2 py-1 rounded-lg self-start mb-2`}>
                <Text className={`${isDark ? 'text-blue-200' : 'text-blue-800'} text-xs font-semibold`}>
                  {item.category}
                </Text>
              </View>
            )}
            {item.contentText && (
              <Text 
                className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-sm`}
                numberOfLines={2}
              >
                {item.contentText}
              </Text>
            )}
            {!item.contentText && !hasImage && (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm italic`}>
                No content preview
              </Text>
            )}
          </View>
          {hasImage && (
            <Image
              source={{ uri: imageUrl }}
              className="w-16 h-16 rounded-lg ml-3"
              resizeMode="cover"
            />
          )}
        </View>

        <View className="flex-row items-center gap-4 mt-2">
          {item.actionItems.length > 0 && (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs">✅</Text>
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs`}>
                {item.actionItems.length} todo{item.actionItems.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {item.events.length > 0 && (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs">📅</Text>
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs`}>
                {item.events.length} event{item.events.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {item.people.length > 0 && (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs">👤</Text>
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs`}>
                {item.people.length} person{item.people.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          <Text className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-xs ml-auto`}>
            {date}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && documents.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (documents.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-10">
        <Text className="text-6xl mb-4">📄</Text>
        <Text className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          No documents yet
        </Text>
        <Text className={`text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          Documents you capture will appear here, organized by category.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F9FAFB' }}>
      <FlatList
        data={documents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshing={loading}
        onRefresh={fetchDocuments}
      />
    </View>
  );
}

