import React, { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert, Modal, TextInput, ScrollView, TouchableOpacity, useColorScheme, StyleSheet } from 'react-native';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { API_URL } from '../utils/env';

// Metadata field definitions based on relationship type
const getMetadataFields = (relationship: string) => {
  const rel = relationship?.toLowerCase() || '';
  
  if (rel === 'child' || rel === 'son' || rel === 'daughter') {
    return [
      { key: 'birthDate', label: 'Birth Date', placeholder: 'YYYY-MM-DD', hint: 'Used to calculate age and match events' },
      { key: 'grade', label: 'Grade', placeholder: 'e.g., 8th grade, 8. klasse', hint: 'Helps match school events automatically' },
      { key: 'school', label: 'School', placeholder: 'School name' },
    ];
  } else if (rel === 'coworker' || rel === 'colleague') {
    return [
      { key: 'company', label: 'Company', placeholder: 'Company name' },
      { key: 'department', label: 'Department', placeholder: 'e.g., Engineering, Sales' },
      { key: 'skills', label: 'Skills', placeholder: 'Comma-separated (e.g., React, Node.js)' },
      { key: 'role', label: 'Role/Title', placeholder: 'Job title' },
    ];
  } else if (rel === 'teammate') {
    return [
      { key: 'team', label: 'Team', placeholder: 'Team name' },
      { key: 'sport', label: 'Sport', placeholder: 'e.g., Soccer, Basketball' },
      { key: 'position', label: 'Position', placeholder: 'e.g., Forward, Goalkeeper' },
    ];
  } else if (rel === 'spouse' || rel === 'partner') {
    return [
      { key: 'birthDate', label: 'Birth Date', placeholder: 'YYYY-MM-DD' },
      { key: 'workplace', label: 'Workplace', placeholder: 'Where they work' },
    ];
  }
  
  // Default fields for any relationship
  return [
    { key: 'birthDate', label: 'Birth Date', placeholder: 'YYYY-MM-DD' },
  ];
};

export default function PeopleScreen() {
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    relationship: '',
    category: '',
    metadata: {} as Record<string, string>,
    notes: '',
  });
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getAuthHeader = async () => {
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
    const tokens = await GoogleSignin.getTokens();
    const bearer = tokens.idToken;
    if (!bearer) {
      throw new Error('No idToken available; please sign in again.');
    }
    return { 
      'Authorization': `Bearer ${bearer}`,
      'X-User-Id': userInfo?.user.id 
    };
  };

  const fetchPeople = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/people`, { headers });
      setPeople(res.data);
    } catch (error) {
      console.error('Error fetching people:', error);
      Alert.alert('Error', 'Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchPeople();
    }, [])
  );

  const resetForm = () => {
    setForm({
      name: '',
      relationship: '',
      category: '',
      metadata: {},
      notes: '',
    });
  };

  const openAddModal = () => {
    resetForm();
    setEditingPerson(null);
    setShowAddModal(true);
  };

  const openEditModal = (person: any) => {
    setForm({
      name: person.name || '',
      relationship: person.relationship || '',
      category: person.category || '',
      metadata: (person.metadata as Record<string, string>) || {},
      notes: person.notes || '',
    });
    setEditingPerson(person);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingPerson(null);
    resetForm();
  };

  const updateMetadataField = (key: string, value: string) => {
    setForm({
      ...form,
      metadata: {
        ...form.metadata,
        [key]: value,
      }
    });
  };

  const savePerson = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    try {
      const headers = await getAuthHeader();
      // Clean up empty metadata fields
      const cleanMetadata: Record<string, string> = {};
      Object.keys(form.metadata).forEach(key => {
        if (form.metadata[key] && form.metadata[key].trim()) {
          cleanMetadata[key] = form.metadata[key].trim();
        }
      });

      const data = {
        name: form.name.trim(),
        relationship: form.relationship.trim() || null,
        category: form.category.trim() || null,
        metadata: Object.keys(cleanMetadata).length > 0 ? cleanMetadata : null,
        notes: form.notes.trim() || null,
        id: editingPerson?.id || undefined,
      };

      if (editingPerson) {
        await axios.post(`${API_URL}/people`, data, { headers });
        Alert.alert('Success', 'Person updated!');
      } else {
        await axios.post(`${API_URL}/people`, data, { headers });
        Alert.alert('Success', 'Person added!');
      }
      
      closeModal();
      fetchPeople();
    } catch (error: any) {
      console.error('Error saving person:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save person');
    }
  };

  const deletePerson = (person: any) => {
    Alert.alert(
      'Delete Person',
      `Are you sure you want to delete ${person.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = await getAuthHeader();
              await axios.delete(`${API_URL}/people/${person.id}`, { headers });
              Alert.alert('Deleted', `${person.name} removed`);
              fetchPeople();
              closeModal();
            } catch (error) {
              console.error('Delete error', error);
              Alert.alert('Error', 'Failed to delete person');
            }
          }
        }
      ]
    );
  };

  const getRelationshipIcon = (relationship: string) => {
    switch (relationship?.toLowerCase()) {
      case 'child':
      case 'son':
      case 'daughter': return '👶';
      case 'spouse':
      case 'partner': return '💑';
      case 'family': return '👨‍👩‍👧‍👦';
      case 'coworker':
      case 'colleague': return '👔';
      case 'teammate': return '⚽';
      case 'friend': return '👫';
      default: return '👤';
    }
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const renderItem = ({ item }: { item: any }) => {
    const metadata = (item.metadata as Record<string, string>) || {};
    const age = metadata.birthDate ? calculateAge(metadata.birthDate) : null;
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <TouchableOpacity style={styles.personInfo} onPress={() => openEditModal(item)}>
            <Text style={styles.personIcon}>{getRelationshipIcon(item.relationship)}</Text>
            <View style={styles.personDetails}>
              <Text style={styles.personName}>{item.name}</Text>
              {item.relationship && (
                <Text style={styles.personMeta}>
                  {item.relationship}
                  {item.category && ` • ${item.category}`}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteChip} onPress={() => deletePerson(item)}>
            <Text style={styles.deleteChipText}>Delete</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.cardBody} onPress={() => openEditModal(item)}>
          {age && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Age:</Text>
              <Text style={styles.infoValue}>{age} years old</Text>
            </View>
          )}
          {metadata.grade && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Grade:</Text>
              <Text style={styles.infoValue}>{metadata.grade}</Text>
            </View>
          )}
          {metadata.school && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>School:</Text>
              <Text style={styles.infoValue}>{metadata.school}</Text>
            </View>
          )}
          {metadata.company && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Company:</Text>
              <Text style={styles.infoValue}>{metadata.company}</Text>
            </View>
          )}
          {metadata.team && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Team:</Text>
              <Text style={styles.infoValue}>{metadata.team}</Text>
            </View>
          )}
          {item.notes && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Notes:</Text>
              <Text style={styles.infoValue}>{item.notes}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const metadataFields = getMetadataFields(form.relationship);

  return (
    <View style={styles.container}>
      {loading && people.length === 0 ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <>
          <FlatList 
            data={people}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No people added yet</Text>
                <Text style={styles.emptySubtext}>Add family members, coworkers, and other important people</Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <Text style={styles.addButtonText}>+ Add Person</Text>
          </TouchableOpacity>
        </>
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {editingPerson ? 'Edit Person' : 'Add Person'}
              </Text>
              
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(text) => setForm({...form, name: text})}
                placeholder="e.g., John, Sarah"
              />

              <Text style={styles.label}>Relationship</Text>
              <TextInput
                style={styles.input}
                value={form.relationship}
                onChangeText={(text) => setForm({...form, relationship: text})}
                placeholder="e.g., child, spouse, coworker, teammate"
              />
              <Text style={styles.hint}>This determines which metadata fields are shown</Text>

              <Text style={styles.label}>Category</Text>
              <TextInput
                style={styles.input}
                value={form.category}
                onChangeText={(text) => setForm({...form, category: text})}
                placeholder="e.g., family, work, sports, school"
              />

              {metadataFields.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Additional Information</Text>
                  {metadataFields.map((field) => (
                    <View key={field.key}>
                      <Text style={styles.label}>{field.label}</Text>
                      <TextInput
                        style={styles.input}
                        value={form.metadata[field.key] || ''}
                        onChangeText={(value) => updateMetadataField(field.key, value)}
                        placeholder={field.placeholder}
                      />
                      {field.hint && (
                        <Text style={styles.hint}>{field.hint}</Text>
                      )}
                    </View>
                  ))}
                </>
              )}

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.notes}
                onChangeText={(text) => setForm({...form, notes: text})}
                placeholder="Additional information (optional)"
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                {editingPerson && (
                  <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={() => deletePerson(editingPerson)}>
                    <Text style={styles.modalButtonText}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={savePerson}>
                  <Text style={styles.modalButtonText}>{editingPerson ? 'Update' : 'Add'}</Text>
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
    paddingBottom: 80,
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  personIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  personDetails: {
    flex: 1,
  },
  personName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  personMeta: {
    fontSize: 14,
    color: '#666',
  },
  cardBody: {
    marginTop: 8,
  },
  deleteChip: {
    backgroundColor: '#f44336',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  deleteChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    width: 80,
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
    color: '#333',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 8,
    fontStyle: 'italic',
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
  deleteButton: {
    backgroundColor: '#f44336',
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
