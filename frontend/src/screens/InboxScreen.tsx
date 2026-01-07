import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, ScrollView, Image, TouchableOpacity } from 'react-native';
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
     
     return (
         <View style={styles.card}>
             <View style={styles.cardHeader}>
               <View style={styles.statusBadge}>
                 <Text style={styles.statusIcon}>{getStatusIcon(item.status)}</Text>
                 <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                   {item.status.replace('_', ' ').toUpperCase()}
                 </Text>
               </View>
               {item.ai_confidence_score != null && (
                 <View style={styles.confidenceBadge}>
                   <Text style={styles.confidenceText}>{confidence}%</Text>
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
                 style={styles.image}
                 resizeMode="cover"
               />
             )}

             {dump.contentText && (
               <View style={styles.originalTextBox}>
                 <Text style={styles.originalTextLabel}>Original Text:</Text>
                 <Text style={styles.originalText}>{dump.contentText}</Text>
               </View>
             )}

             <View style={styles.extractedDataBox}>
               <Text style={styles.extractedTitle}>📋 Extracted Information:</Text>
               
               <View style={styles.fieldRow}>
                 <Text style={styles.fieldLabel}>Title:</Text>
                 <Text style={styles.fieldValue}>{data.title || 'Not detected'}</Text>
               </View>

               <View style={styles.fieldRow}>
                 <Text style={styles.fieldLabel}>Date/Time:</Text>
                 <Text style={styles.fieldValue}>
                   {data.start_time 
                     ? new Date(data.start_time).toLocaleString() 
                     : 'Not detected'}
                 </Text>
               </View>

               {data.category && (
                 <View style={styles.fieldRow}>
                   <Text style={styles.fieldLabel}>Category:</Text>
                   <View style={styles.categoryBadge}>
                     <Text style={styles.categoryText}>{data.category}</Text>
                   </View>
                 </View>
               )}

               {data.location && (
                 <View style={styles.fieldRow}>
                   <Text style={styles.fieldLabel}>Location:</Text>
                   <Text style={styles.fieldValue}>{data.location}</Text>
                 </View>
               )}
             </View>
             
             {detectedPeople.length > 0 && (
               <View style={styles.peopleSection}>
                 <Text style={styles.sectionTitle}>👥 People Detected:</Text>
                 <View style={styles.peopleList}>
                   {detectedPeople.map((person: any, idx: number) => {
                     const existingPerson = people.find((p: any) => 
                       p.name.toLowerCase() === person.name.toLowerCase()
                     );
                     const isNew = !existingPerson;
                     
                     return (
                       <View key={idx} style={[styles.personTag, isNew && styles.newPersonTag]}>
                         <Text style={styles.personText}>
                           {person.name}
                           {person.relationship && ` (${person.relationship})`}
                         </Text>
                         {isNew && (
                           <TouchableOpacity 
                             style={styles.addPersonButton}
                             onPress={() => addPerson({
                               name: person.name,
                               relationship: person.relationship,
                               category: person.category
                             })}
                           >
                             <Text style={styles.addPersonText}>+ Add</Text>
                           </TouchableOpacity>
                         )}
                       </View>
                     );
                   })}
                 </View>
               </View>
             )}
             
             {actionableItems.length > 0 && (
               <View style={styles.actionItemsSection}>
                 <Text style={styles.sectionTitle}>✅ Action Items:</Text>
                 {actionableItems.map((action: any, idx: number) => (
                   <View key={idx} style={styles.actionItem}>
                     <Text style={styles.actionTitle}>• {action.title}</Text>
                     {action.description && (
                       <Text style={styles.actionDesc}>{action.description}</Text>
                     )}
                     {action.due_date && (
                       <Text style={styles.actionDate}>
                         Due: {new Date(action.due_date).toLocaleDateString()}
                       </Text>
                     )}
                   </View>
                 ))}
               </View>
             )}
             
             {item.flag_reason && (
               <View style={styles.warningBox}>
                 <Text style={styles.warningText}>⚠️ {item.flag_reason}</Text>
               </View>
             )}

             {data.missing_info && data.missing_info.length > 0 && (
               <View style={styles.missingInfoBox}>
                 <Text style={styles.missingInfoTitle}>Missing Information:</Text>
                 {data.missing_info.map((info: string, idx: number) => (
                   <Text key={idx} style={styles.missingInfoText}>• {info}</Text>
                 ))}
               </View>
             )}
             
             <View style={styles.buttons}>
                <TouchableOpacity 
                  style={[styles.button, styles.confirmButton]}
                  onPress={() => confirmItem(item)}
                >
                  <Text style={styles.buttonText}>✓ Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.editButton]}
                  onPress={() => openEditModal(item)}
                >
                  <Text style={styles.buttonText}>✏️ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.dismissButton]}
                  onPress={() => dismissItem(item)}
                >
                  <Text style={styles.buttonText}>✕ Dismiss</Text>
                </TouchableOpacity>
             </View>
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
            keyExtractor={(item: any) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Inbox is empty! 📭</Text>}
            contentContainerStyle={styles.listContent}
          />
      )}

      <Modal
        visible={editingItem !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Edit Event</Text>
              
              {editingItem && (() => {
                let extracted = editingItem.proposed_data || {};
                if (typeof extracted === 'string') {
                  try { extracted = JSON.parse(extracted); } catch(e) {}
                }
                return (
                  <View style={styles.extractedPreview}>
                    <Text style={styles.extractedPreviewTitle}>AI Extracted:</Text>
                    <Text style={styles.extractedPreviewText}>
                      Title: {extracted.title || 'Not detected'}
                    </Text>
                    <Text style={styles.extractedPreviewText}>
                      Date: {extracted.start_time ? new Date(extracted.start_time).toLocaleString() : 'Not detected'}
                    </Text>
                    {extracted.category && (
                      <Text style={styles.extractedPreviewText}>
                        Category: {extracted.category}
                      </Text>
                    )}
                    {extracted.location && (
                      <Text style={styles.extractedPreviewText}>
                        Location: {extracted.location}
                      </Text>
                    )}
                  </View>
                );
              })()}
              
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={editForm.title}
                onChangeText={(text) => setEditForm({...editForm, title: text})}
                placeholder="Event title"
              />

              <Text style={styles.label}>Start Time *</Text>
              <TextInput
                style={styles.input}
                value={editForm.start_time}
                onChangeText={(text) => setEditForm({...editForm, start_time: text})}
                placeholder="YYYY-MM-DDTHH:mm"
              />

              <Text style={styles.label}>End Time</Text>
              <TextInput
                style={styles.input}
                value={editForm.end_time}
                onChangeText={(text) => setEditForm({...editForm, end_time: text})}
                placeholder="YYYY-MM-DDTHH:mm (optional)"
              />

              <Text style={styles.label}>Category</Text>
              <TextInput
                style={styles.input}
                value={editForm.category}
                onChangeText={(text) => setEditForm({...editForm, category: text})}
                placeholder="e.g., Work, Personal, Soccer, Family"
              />

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={editForm.location}
                onChangeText={(text) => setEditForm({...editForm, location: text})}
                placeholder="Event location (optional)"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeEditModal}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveEdit}>
                  <Text style={styles.modalButtonText}>Save & Confirm</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  listContent: {
    padding: 16,
  },
  card: { 
    backgroundColor: 'white', 
    padding: 16, 
    marginBottom: 16, 
    borderRadius: 12, 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIcon: {
    fontSize: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  confidenceBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1976d2',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  originalTextBox: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  originalTextLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  originalText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  extractedDataBox: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  extractedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    width: 80,
  },
  fieldValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2e7d32',
  },
  peopleSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
  },
  peopleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personTag: {
    backgroundColor: '#f0f4f8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newPersonTag: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  personText: {
    fontSize: 12,
    color: '#333',
  },
  addPersonButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addPersonText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '600',
  },
  actionItemsSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  actionItem: {
    backgroundColor: '#fff3e0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ff9800',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  actionDate: {
    fontSize: 11,
    color: '#ff9800',
    fontWeight: '500',
  },
  warningBox: {
    backgroundColor: '#fff3e0',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  warningText: {
    color: '#ff9800',
    fontSize: 13,
  },
  missingInfoBox: {
    backgroundColor: '#fce4ec',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  missingInfoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c2185b',
    marginBottom: 4,
  },
  missingInfoText: {
    fontSize: 12,
    color: '#880e4f',
    marginBottom: 2,
  },
  buttons: { 
    flexDirection: 'row', 
    marginTop: 12, 
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  dismissButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  empty: { 
    textAlign: 'center', 
    marginTop: 50, 
    fontSize: 18, 
    color: '#888' 
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  extractedPreview: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  extractedPreviewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8,
  },
  extractedPreviewText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});
