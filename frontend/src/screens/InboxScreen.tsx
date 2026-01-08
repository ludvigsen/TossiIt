import React, { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert, Modal, TextInput, ScrollView, Image, TouchableOpacity, useColorScheme } from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { API_URL } from '../utils/env';

// Helper to get base URL for images
const getImageBaseUrl = () => {
  const base = API_URL.replace('/api', '');
  return base;
};

export default function InboxScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    start_time: '',
    end_time: '',
    category: '',
    location: '',
  });
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

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const [inboxRes, peopleRes] = await Promise.all([
        axios.get(`${API_URL}/inbox`, { headers }),
        axios.get(`${API_URL}/people`, { headers }).catch(() => ({ data: [] }))
      ]);
      setItems(inboxRes.data);
      setPeople(peopleRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const addPerson = async (personData: any) => {
    try {
      const headers = await getAuthHeader();
      await axios.post(`${API_URL}/people`, personData, { headers });
      Alert.alert('Success', `Added ${personData.name} to your contacts`);
      fetchInbox();
    } catch (error) {
      Alert.alert('Error', 'Failed to add person');
      console.error(error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchInbox();
    }, [])
  );

  const openEditModal = (item: any) => {
    let data = item.proposed_data || {};
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch(e) {}
    }
    
    // Format dates for input (YYYY-MM-DDTHH:mm)
    const formatDateTime = (dateStr: string | null) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      } catch {
        return '';
      }
    };

    setEditForm({
      title: data.title || '',
      start_time: formatDateTime(data.start_time),
      end_time: formatDateTime(data.end_time),
      category: data.category || '',
      location: data.location || '',
    });
    setEditingItem(item);
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditForm({
      title: '',
      start_time: '',
      end_time: '',
      category: '',
      location: '',
    });
  };

  const saveEdit = async () => {
    if (!editForm.title || !editForm.start_time) {
      Alert.alert('Missing Info', 'Title and start time are required.');
      return;
    }

    try {
      const headers = await getAuthHeader();
      await axios.post(`${API_URL}/inbox/${editingItem.id}/confirm`, {
        title: editForm.title,
        start_time: editForm.start_time,
        end_time: editForm.end_time || null,
        category: editForm.category || null,
        location: editForm.location || null,
      }, { headers });
      Alert.alert('Saved', 'Event created!');
      closeEditModal();
      fetchInbox();
    } catch (error) {
      Alert.alert('Error', 'Failed to save');
      console.error(error);
    }
  };

  const confirmItem = async (item: any) => {
    try {
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

        const headers = await getAuthHeader();
        await axios.post(`${API_URL}/inbox/${item.id}/confirm`, {
            ...proposed
        }, { headers });
        Alert.alert('Confirmed', 'Event created!');
        fetchInbox();
    } catch (error) {
        Alert.alert('Error', 'Failed to confirm');
        console.error(error);
    }
  };

  const dismissItem = async (item: any) => {
    Alert.alert(
      'Dismiss Item',
      'Are you sure you want to dismiss this item? It will be removed from your inbox.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = await getAuthHeader();
              await axios.post(`${API_URL}/inbox/${item.id}/dismiss`, {}, { headers });
              Alert.alert('Dismissed', 'Item removed from inbox');
              fetchInbox();
            } catch (error) {
              Alert.alert('Error', 'Failed to dismiss item');
              console.error(error);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#4CAF50';
      case 'needs_info': return '#FF9800';
      case 'rejected': return '#f44336';
      default: return '#2196F3';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return '✅';
      case 'needs_info': return '❓';
      case 'rejected': return '❌';
      default: return '⏳';
    }
  };

  const renderItem = ({ item }: { item: any }) => {
     let data = item.proposed_data || {};
     if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) {}
     }
     
     const detectedPeople = data.people || [];
     const actionableItems = data.actionable_items || [];
     const confidence = item.ai_confidence_score != null ? (item.ai_confidence_score * 100).toFixed(0) : 'N/A';
     const dump = item.dump || {};
     const mediaUrl = dump.mediaUrl;
     const statusColor = getStatusColor(item.status);
     
     return (
        <View 
          className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 mb-4 rounded-xl`}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.25 : 0.15,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
             <View className="flex-row justify-between items-center mb-3">
               <View className="flex-row items-center gap-1.5">
                 <Text className="text-base">{getStatusIcon(item.status)}</Text>
                 <Text className="text-xs font-semibold capitalize" style={{ color: statusColor }}>
                   {item.status.replace('_', ' ').toUpperCase()}
                 </Text>
               </View>
               {item.ai_confidence_score != null && (
                 <View className="bg-blue-100 px-2 py-1 rounded-xl">
                   <Text className="text-xs font-semibold text-blue-700">{confidence}%</Text>
                 </View>
               )}
             </View>

             {mediaUrl && (
               <Image 
                 source={{ 
                   uri: mediaUrl.startsWith('http') 
                     ? mediaUrl 
                     : `${getImageBaseUrl()}${mediaUrl}`
                 }} 
                 className="w-full h-48 rounded-lg mb-3"
                 resizeMode="cover"
               />
             )}

             {dump.contentText && (
               <View className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'} p-3 rounded-lg mb-3`}>
                 <Text className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                   Original Text:
                 </Text>
                 <Text className={`text-sm leading-4 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                   {dump.contentText}
                 </Text>
               </View>
             )}

             <View className={`${isDark ? 'bg-green-900/30' : 'bg-green-50'} p-3 rounded-lg mb-3`}>
               <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-green-400' : 'text-green-800'}`}>
                 📋 Extracted Information:
               </Text>
               
               <View className="flex-row mb-1.5 items-center flex-wrap">
                 <Text className={`text-xs font-semibold w-20 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                   Title:
                 </Text>
                 <Text className={`text-xs flex-1 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                   {data.title || 'Not detected'}
                 </Text>
               </View>

               <View className="flex-row mb-1.5 items-center flex-wrap">
                 <Text className={`text-xs font-semibold w-20 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                   Date/Time:
                 </Text>
                 <Text className={`text-xs flex-1 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                   {data.start_time 
                     ? new Date(data.start_time).toLocaleString() 
                     : 'Not detected'}
                 </Text>
               </View>

               {data.category && (
                 <View className="flex-row mb-1.5 items-center flex-wrap">
                   <Text className={`text-xs font-semibold w-20 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                     Category:
                   </Text>
                   <View className="bg-white px-2 py-1 rounded-xl">
                     <Text className="text-xs font-semibold text-green-800">{data.category}</Text>
                   </View>
                 </View>
               )}

               {data.location && (
                 <View className="flex-row mb-1.5 items-center flex-wrap">
                   <Text className={`text-xs font-semibold w-20 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                     Location:
                   </Text>
                   <Text className={`text-xs flex-1 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                     {data.location}
                   </Text>
                 </View>
               )}
             </View>
             
             {detectedPeople.length > 0 && (
               <View className="mt-3 mb-2">
                 <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                   👥 People Detected:
                 </Text>
                 <View className="flex-row flex-wrap gap-2">
                   {detectedPeople.map((person: any, idx: number) => {
                     const existingPerson = people.find((p: any) => 
                       p.name.toLowerCase() === person.name.toLowerCase()
                     );
                     const isNew = !existingPerson;
                     
                     return (
                       <View 
                         key={idx} 
                         className={`${isNew ? 'bg-orange-100 border border-orange-500' : isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2.5 py-1.5 rounded-xl flex-row items-center gap-2`}
                       >
                         <Text className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                           {person.name}
                           {person.relationship && ` (${person.relationship})`}
                         </Text>
                         {isNew && (
                           <TouchableOpacity 
                             className="bg-green-500 px-2 py-1 rounded-lg"
                             onPress={() => addPerson({
                               name: person.name,
                               relationship: person.relationship,
                               category: person.category
                             })}
                           >
                             <Text className="text-xs text-white font-semibold">+ Add</Text>
                           </TouchableOpacity>
                         )}
                       </View>
                     );
                   })}
                 </View>
               </View>
             )}
             
             {actionableItems.length > 0 && (
               <View className="mt-3 mb-2">
                 <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                   ✅ Action Items:
                 </Text>
                 {actionableItems.map((action: any, idx: number) => (
                   <View key={idx} className={`${isDark ? 'bg-orange-900/30' : 'bg-orange-50'} p-2.5 rounded-lg mb-2 border-l-4 border-orange-500`}>
                     <Text className={`text-sm font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                       • {action.title}
                     </Text>
                     {action.description && (
                       <Text className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                         {action.description}
                       </Text>
                     )}
                     {action.due_date && (
                       <Text className={`text-xs font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                         Due: {new Date(action.due_date).toLocaleDateString()}
                       </Text>
                     )}
                   </View>
                 ))}
               </View>
             )}
             
             {item.flag_reason && (
               <View className={`${isDark ? 'bg-orange-900/30' : 'bg-orange-50'} p-2.5 rounded-lg mt-2 mb-2`}>
                 <Text className={`text-sm ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                   ⚠️ {item.flag_reason}
                 </Text>
               </View>
             )}

             {data.missing_info && data.missing_info.length > 0 && (
               <View className={`${isDark ? 'bg-pink-900/30' : 'bg-pink-50'} p-2.5 rounded-lg mt-2 mb-2`}>
                 <Text className={`text-xs font-semibold mb-1 ${isDark ? 'text-pink-400' : 'text-pink-800'}`}>
                   Missing Information:
                 </Text>
                 {data.missing_info.map((info: string, idx: number) => (
                   <Text key={idx} className={`text-xs mb-0.5 ${isDark ? 'text-pink-300' : 'text-pink-900'}`}>
                     • {info}
                   </Text>
                 ))}
               </View>
             )}
             
             <View className="flex-row mt-3 gap-2">
                <TouchableOpacity 
                  className="bg-green-500 flex-1 py-3 rounded-lg items-center"
                  onPress={() => confirmItem(item)}
                >
                  <Text className="text-white text-xs font-semibold">✓ Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="bg-blue-500 flex-1 py-3 rounded-lg items-center"
                  onPress={() => openEditModal(item)}
                >
                  <Text className="text-white text-xs font-semibold">✏️ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="bg-red-500 flex-1 py-3 rounded-lg items-center"
                  onPress={() => dismissItem(item)}
                >
                  <Text className="text-white text-xs font-semibold">✕ Dismiss</Text>
                </TouchableOpacity>
             </View>
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
            keyExtractor={(item: any) => item.id}
            ListEmptyComponent={
              <Text className={`text-center mt-12 text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Inbox is empty! 📭
              </Text>
            }
            contentContainerStyle={{ padding: 16 }}
          />
      )}

      <Modal
        visible={editingItem !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={closeEditModal}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-5 w-[90%] max-h-[80%]`}>
            <ScrollView>
              <Text className={`text-xl font-bold mb-5 ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
                Edit Event
              </Text>
              
              {editingItem && (() => {
                let extracted = editingItem.proposed_data || {};
                if (typeof extracted === 'string') {
                  try { extracted = JSON.parse(extracted); } catch(e) {}
                }
                return (
                  <View className={`${isDark ? 'bg-gray-700' : 'bg-green-50'} p-3 rounded-lg mb-4`}>
                    <Text className={`text-xs font-semibold mb-2 ${isDark ? 'text-green-400' : 'text-green-800'}`}>
                      AI Extracted:
                    </Text>
                    <Text className={`text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Title: {extracted.title || 'Not detected'}
                    </Text>
                    <Text className={`text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Date: {extracted.start_time ? new Date(extracted.start_time).toLocaleString() : 'Not detected'}
                    </Text>
                    {extracted.category && (
                      <Text className={`text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Category: {extracted.category}
                      </Text>
                    )}
                    {extracted.location && (
                      <Text className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Location: {extracted.location}
                      </Text>
                    )}
                  </View>
                );
              })()}
              
              <Text className={`text-sm font-semibold mt-3 mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Title *
              </Text>
              <TextInput
                className={`${isDark ? 'bg-gray-700 text-gray-50 border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg p-3 text-base`}
                placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                value={editForm.title}
                onChangeText={(text) => setEditForm({...editForm, title: text})}
                placeholder="Event title"
              />

              <Text className={`text-sm font-semibold mt-3 mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Start Time *
              </Text>
              <TextInput
                className={`${isDark ? 'bg-gray-700 text-gray-50 border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg p-3 text-base`}
                placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                value={editForm.start_time}
                onChangeText={(text) => setEditForm({...editForm, start_time: text})}
                placeholder="YYYY-MM-DDTHH:mm"
              />

              <Text className={`text-sm font-semibold mt-3 mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                End Time
              </Text>
              <TextInput
                className={`${isDark ? 'bg-gray-700 text-gray-50 border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg p-3 text-base`}
                placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                value={editForm.end_time}
                onChangeText={(text) => setEditForm({...editForm, end_time: text})}
                placeholder="YYYY-MM-DDTHH:mm (optional)"
              />

              <Text className={`text-sm font-semibold mt-3 mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Category
              </Text>
              <TextInput
                className={`${isDark ? 'bg-gray-700 text-gray-50 border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg p-3 text-base`}
                placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                value={editForm.category}
                onChangeText={(text) => setEditForm({...editForm, category: text})}
                placeholder="e.g., Work, Personal, Soccer, Family"
              />

              <Text className={`text-sm font-semibold mt-3 mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Location
              </Text>
              <TextInput
                className={`${isDark ? 'bg-gray-700 text-gray-50 border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-300'} border rounded-lg p-3 text-base`}
                placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                value={editForm.location}
                onChangeText={(text) => setEditForm({...editForm, location: text})}
                placeholder="Event location (optional)"
              />

              <View className="flex-row justify-between mt-5 gap-3">
                <TouchableOpacity 
                  className={`${isDark ? 'bg-gray-600' : 'bg-gray-300'} flex-1 py-3 rounded-lg items-center`}
                  onPress={closeEditModal}
                >
                  <Text className="text-sm font-semibold text-white">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="bg-blue-500 flex-1 py-3 rounded-lg items-center"
                  onPress={saveEdit}
                >
                  <Text className="text-sm font-semibold text-white">Save & Confirm</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

