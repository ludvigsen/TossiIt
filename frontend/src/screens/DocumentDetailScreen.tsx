import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Image, TouchableOpacity, useColorScheme, TextInput, Modal, Alert } from 'react-native';
import axios from 'axios';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getAuthHeaders } from '../utils/auth';
import { API_URL } from '../utils/env';

// Helper to get base URL for images (remove /api suffix)
const getImageBaseUrl = () => {
  const base = API_URL.replace('/api', '');
  return base;
};

export default function DocumentDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { documentId } = route.params || {};
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getAuthHeader = async (forceRefresh = false) => getAuthHeaders({ forceRefresh });

  const fetchDocument = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/documents/${documentId}`, { headers });
      setDocument(res.data);
      setCategoryInput(res.data.category || '');
    } catch (error) {
      console.error('Error fetching document:', error);
      Alert.alert('Error', 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentId) {
      fetchDocument();
    }
  }, [documentId]);

  const updateCategory = async () => {
    try {
      const headers = await getAuthHeader();
      await axios.patch(`${API_URL}/documents/${documentId}`, { category: categoryInput.trim() || null }, { headers });
      setDocument((prev: any) => ({ ...prev, category: categoryInput.trim() || null }));
      setEditingCategory(false);
    } catch (error) {
      console.error('Error updating category:', error);
      Alert.alert('Error', 'Failed to update category');
    }
  };

  const renderPeople = (people: any[] | undefined) => {
    if (!people || people.length === 0) return null;
    return (
      <View className="flex-row flex-wrap gap-2 mt-2">
        {people.map((p: any) => (
          <View key={p.id} className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-1 rounded-xl`}>
            <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-xs font-semibold`}>
              {p.name}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: isDark ? '#111827' : '#F9FAFB' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!document) {
    return (
      <View className="flex-1 justify-center items-center p-10" style={{ backgroundColor: isDark ? '#111827' : '#F9FAFB' }}>
        <Text className={`text-xl font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          Document not found
        </Text>
      </View>
    );
  }

  const hasImage = !!document.mediaUrl;
  const imageUrl = document.mediaUrl?.startsWith('http') 
    ? document.mediaUrl 
    : `${getImageBaseUrl()}${document.mediaUrl}`;
  const infoContext = Array.isArray(document.infoContext) ? document.infoContext : [];

  return (
    <ScrollView 
      className="flex-1" 
      style={{ backgroundColor: isDark ? '#111827' : '#F9FAFB' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      {/* Category */}
      <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl mb-4`}>
        <View className="flex-row items-center justify-between">
          <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm font-semibold mb-2`}>
            Category
          </Text>
          <TouchableOpacity onPress={() => setEditingCategory(!editingCategory)}>
            <Text className="text-blue-500 font-semibold text-sm">
              {editingCategory ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>
        {editingCategory ? (
          <View className="flex-row gap-2 mt-2">
            <TextInput
              value={categoryInput}
              onChangeText={setCategoryInput}
              placeholder="e.g., school, soccer, work"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              className={`flex-1 ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-2 rounded-xl`}
              autoFocus
            />
            <TouchableOpacity
              onPress={updateCategory}
              className="bg-blue-600 px-4 py-2 rounded-xl"
            >
              <Text className="text-white font-semibold">Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text className={`${isDark ? 'text-white' : 'text-gray-900'} text-lg font-bold`}>
            {document.category || 'Uncategorized'}
          </Text>
        )}
      </View>

      {/* Info Context */}
      {infoContext.length > 0 && (
        <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl mb-4`}>
          <Text className={`${isDark ? 'text-white' : 'text-gray-900'} text-lg font-bold mb-3`}>
            Context
          </Text>
          {infoContext.map((info: any, index: number) => (
            <View key={index} className="mb-3 pb-3 border-b border-gray-600 last:border-0 last:mb-0 last:pb-0">
              <Text className={`${isDark ? 'text-white' : 'text-gray-900'} text-base font-semibold mb-1`}>
                {info.title}
              </Text>
              {info.description && (
                <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm mb-2`}>
                  {info.description}
                </Text>
              )}
              {info.expires_at && (
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs`}>
                  Expires: {new Date(info.expires_at).toLocaleDateString()}
                </Text>
              )}
              {info.people_ids && Array.isArray(info.people_ids) && info.people_ids.length > 0 && (
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {info.people_ids.map((pid: string) => {
                    const person = document.people?.find((p: any) => p.id === pid);
                    if (!person) return null;
                    return (
                      <View key={pid} className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-1 rounded-xl`}>
                        <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-xs font-semibold`}>
                          {person.name}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Linked Todos */}
      {document.actionItems && document.actionItems.length > 0 && (
        <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl mb-4`}>
          <Text className={`${isDark ? 'text-white' : 'text-gray-900'} text-lg font-bold mb-3`}>
            Todos ({document.actionItems.length})
          </Text>
          {document.actionItems.map((todo: any) => (
            <TouchableOpacity
              key={todo.id}
              onPress={() => navigation.navigate('Todos' as never)}
              className="mb-2 pb-2 border-b border-gray-600 last:border-0 last:mb-0 last:pb-0"
            >
              <View className="flex-row items-center gap-2">
                <Text className={todo.completed ? 'line-through' : ''}>
                  {todo.completed ? '✅' : '⭕'}
                </Text>
                <View className="flex-1">
                  <Text className={`${isDark ? 'text-white' : 'text-gray-900'} text-base ${todo.completed ? 'line-through' : ''}`}>
                    {todo.title}
                  </Text>
                  {todo.dueDate && (
                    <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                      Due: {new Date(todo.dueDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Linked Events */}
      {document.events && document.events.length > 0 && (
        <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl mb-4`}>
          <Text className={`${isDark ? 'text-white' : 'text-gray-900'} text-lg font-bold mb-3`}>
            Events ({document.events.length})
          </Text>
          {document.events.map((event: any) => (
            <TouchableOpacity
              key={event.id}
              onPress={() => navigation.navigate('Calendar' as never)}
              className="mb-2 pb-2 border-b border-gray-600 last:border-0 last:mb-0 last:pb-0"
            >
              <Text className={`${isDark ? 'text-white' : 'text-gray-900'} text-base`}>
                📅 {event.title}
              </Text>
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                {new Date(event.startTime).toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Document Preview */}
      <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl mb-4`}>
        <Text className={`${isDark ? 'text-white' : 'text-gray-900'} text-lg font-bold mb-3`}>
          Document
        </Text>
        {hasImage && (
          <Image
            source={{ uri: imageUrl }}
            className="w-full h-64 rounded-xl mb-3"
            resizeMode="contain"
          />
        )}
        {document.contentText && (
          <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-sm leading-6`}>
            {document.contentText}
          </Text>
        )}
        {!hasImage && !document.contentText && (
          <Text className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm italic`}>
            No content available
          </Text>
        )}
      </View>

      {/* Metadata */}
      <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-xl`}>
        <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm`}>
          <Text className="font-semibold">Source:</Text> {document.sourceType}
        </Text>
        <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm mt-1`}>
          <Text className="font-semibold">Created:</Text> {new Date(document.createdAt).toLocaleString()}
        </Text>
        {document.processedAt && (
          <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-sm mt-1`}>
            <Text className="font-semibold">Processed:</Text> {new Date(document.processedAt).toLocaleString()}
          </Text>
        )}
        {renderPeople(document.people)}
      </View>
    </ScrollView>
  );
}

