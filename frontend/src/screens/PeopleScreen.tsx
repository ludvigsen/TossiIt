import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import axios from 'axios';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../utils/env';
import { getAuthHeaders } from '../utils/auth';

type RelationshipKind =
  | 'child'
  | 'family'
  | 'spouse'
  | 'coworker'
  | 'acquaintance'
  | 'friend'
  | 'teacher'
  | 'coach'
  | 'other';

const REL_OPTIONS: Array<{ key: RelationshipKind; label: string }> = [
  { key: 'child', label: 'Child' },
  { key: 'spouse', label: 'Spouse/Partner' },
  { key: 'family', label: 'Family' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'coach', label: 'Coach' },
  { key: 'coworker', label: 'Coworker' },
  { key: 'friend', label: 'Friend' },
  { key: 'acquaintance', label: 'Acquaintance' },
  { key: 'other', label: 'Other' },
];

const META_FIELDS: Record<RelationshipKind, Array<{ key: string; label: string; placeholder?: string }>> = {
  child: [
    { key: 'birthDate', label: 'Birth date', placeholder: 'YYYY-MM-DD' },
    { key: 'grade', label: 'Grade', placeholder: 'e.g. 3rd grade / 8. klasse' },
    { key: 'school', label: 'School', placeholder: 'School name' },
    { key: 'kindergarten', label: 'Kindergarten', placeholder: 'Kindergarten name' },
  ],
  teacher: [
    { key: 'school', label: 'School', placeholder: 'School name' },
    { key: 'gradeTaught', label: 'Grade taught', placeholder: 'e.g. 2nd grade' },
    { key: 'subject', label: 'Subject', placeholder: 'e.g. Math' },
  ],
  coach: [
    { key: 'sport', label: 'Sport', placeholder: 'e.g. Soccer' },
    { key: 'team', label: 'Team', placeholder: 'Team name' },
    { key: 'organization', label: 'Club/organization', placeholder: 'Club name' },
  ],
  coworker: [
    { key: 'company', label: 'Company', placeholder: 'Company name' },
    { key: 'department', label: 'Department', placeholder: 'e.g. Engineering' },
    { key: 'role', label: 'Role', placeholder: 'e.g. PM' },
  ],
  spouse: [
    { key: 'birthDate', label: 'Birth date', placeholder: 'YYYY-MM-DD' },
    { key: 'workplace', label: 'Workplace', placeholder: 'Company / workplace' },
  ],
  family: [{ key: 'birthDate', label: 'Birth date', placeholder: 'YYYY-MM-DD' }],
  friend: [{ key: 'birthDate', label: 'Birth date', placeholder: 'YYYY-MM-DD' }],
  acquaintance: [{ key: 'birthDate', label: 'Birth date', placeholder: 'YYYY-MM-DD' }],
  other: [{ key: 'birthDate', label: 'Birth date', placeholder: 'YYYY-MM-DD' }],
};

function normalizeRel(relationship: string | null | undefined): RelationshipKind {
  const rel = (relationship || '').toLowerCase().trim();
  if (rel === 'child' || rel === 'son' || rel === 'daughter') return 'child';
  if (rel === 'spouse' || rel === 'partner') return 'spouse';
  if (rel === 'coworker' || rel === 'colleague') return 'coworker';
  if (rel === 'acquaintance') return 'acquaintance';
  if (rel === 'friend') return 'friend';
  if (rel === 'teacher') return 'teacher';
  if (rel === 'coach' || rel === 'teammate') return 'coach';
  if (rel === 'family') return 'family';
  return 'other';
}

function deriveCategory(rel: RelationshipKind) {
  if (rel === 'child' || rel === 'teacher') return 'school';
  if (rel === 'coach') return 'sports';
  if (rel === 'coworker') return 'work';
  return 'family';
}

function cleanMeta(meta: Record<string, string>) {
  const out: Record<string, string> = {};
  Object.keys(meta || {}).forEach((k) => {
    const v = meta[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  });
  return out;
}

export default function PeopleScreen() {
  const navigation = useNavigation<any>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importantUpdatingId, setImportantUpdatingId] = useState<string | null>(null);

  const [showOthers, setShowOthers] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [existingPickerOpen, setExistingPickerOpen] = useState(false);
  const [newPersonOpen, setNewPersonOpen] = useState(false);
  const [editPersonOpen, setEditPersonOpen] = useState(false);

  const [existingSearch, setExistingSearch] = useState('');

  const [newName, setNewName] = useState('');
  const [newRel, setNewRel] = useState<RelationshipKind>('child');
  const [newNotes, setNewNotes] = useState('');
  const [newMeta, setNewMeta] = useState<Record<string, string>>({});

  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editRel, setEditRel] = useState<RelationshipKind>('child');
  const [editNotes, setEditNotes] = useState('');
  const [editMeta, setEditMeta] = useState<Record<string, string>>({});

  const relLabel = (relationship: string | null | undefined) => {
    const normalized = normalizeRel(relationship);
    return REL_OPTIONS.find((o) => o.key === normalized)?.label ?? 'Other';
  };

  const fetchPeople = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_URL}/people`, { headers });
      setPeople(res.data || []);
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
    }, []),
  );

  const openOverview = (person: any) => {
    navigation.navigate('PersonOverview', { personId: person.id });
  };

  const setImportant = async (person: any, isImportant: boolean) => {
    const id = String(person?.id || '');
    if (id) {
      setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, isImportant } : p)));
    }
    setImportantUpdatingId(id || null);
    try {
      const headers = await getAuthHeaders();
      await axios.post(
        `${API_URL}/people`,
        {
          id: person.id,
          name: person.name,
          relationship: person.relationship ?? null,
          category: person.category ?? null,
          metadata: person.metadata ?? null,
          notes: person.notes ?? null,
          isImportant,
          pinnedOrder: person.pinnedOrder ?? null,
        },
        { headers },
      );
      await fetchPeople();
    } catch (e) {
      console.error('Failed to set important', e);
      if (id) {
        setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, isImportant: !isImportant } : p)));
      }
      Alert.alert('Error', 'Failed to update person');
    } finally {
      setImportantUpdatingId(null);
    }
  };

  const openEdit = (person: any) => {
    setEditingPerson(person);
    setEditName(String(person?.name || ''));
    setEditRel(normalizeRel(person?.relationship));
    setEditNotes(String(person?.notes || ''));
    setEditMeta((person?.metadata as any) || {});
    setEditPersonOpen(true);
  };

  const saveEdit = async () => {
    const name = editName.trim();
    if (!editingPerson?.id) return;
    if (!name) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const meta = cleanMeta(editMeta);
      await axios.post(
        `${API_URL}/people`,
        {
          id: editingPerson.id,
          name,
          relationship: editRel,
          category: editingPerson.category ?? deriveCategory(editRel),
          metadata: Object.keys(meta).length ? meta : null,
          notes: editNotes.trim() || null,
          isImportant: !!editingPerson.isImportant,
          pinnedOrder: editingPerson.pinnedOrder ?? null,
        },
        { headers },
      );
      setEditPersonOpen(false);
      setEditingPerson(null);
      await fetchPeople();
    } catch (e: any) {
      console.error('Failed to save person edit', e);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to save changes');
    }
  };

  const deleteFromEdit = () => {
    if (!editingPerson) return;
    Alert.alert('Delete person', `Delete ${editingPerson.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const headers = await getAuthHeaders();
            await axios.delete(`${API_URL}/people/${editingPerson.id}`, { headers });
            setEditPersonOpen(false);
            setEditingPerson(null);
            await fetchPeople();
          } catch (e) {
            console.error('Failed to delete person', e);
            Alert.alert('Error', 'Failed to delete person');
          }
        },
      },
    ]);
  };

  const createNewImportantPerson = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const meta = cleanMeta(newMeta);
      await axios.post(
        `${API_URL}/people`,
        {
          name,
          relationship: newRel,
          category: deriveCategory(newRel),
          metadata: Object.keys(meta).length ? meta : null,
          notes: newNotes.trim() || null,
          isImportant: true,
        },
        { headers },
      );
      setNewName('');
      setNewRel('child');
      setNewNotes('');
      setNewMeta({});
      setNewPersonOpen(false);
      await fetchPeople();
    } catch (e: any) {
      console.error('Failed to create person', e);
      Alert.alert('Error', e?.response?.data?.error || 'Failed to add person');
    }
  };

  const importantPeople = useMemo(() => people.filter((p) => !!p.isImportant), [people]);
  const otherPeople = useMemo(() => people.filter((p) => !p.isImportant), [people]);

  const filteredOtherPeople = useMemo(() => {
    const q = existingSearch.trim().toLowerCase();
    if (!q) return otherPeople;
    return otherPeople.filter((p) => String(p.name || '').toLowerCase().includes(q));
  }, [existingSearch, otherPeople]);

  const renderImportant = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        onPress={() => openOverview(item)}
        className={`${isDark ? 'bg-gray-800' : 'bg-white'} px-4 py-4 rounded-2xl mb-3 flex-row items-center justify-between`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.25 : 0.12,
          shadowRadius: 3.84,
          elevation: 4,
        }}
      >
        <View className="flex-1 pr-3">
          <Text className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</Text>
          <View className="flex-row items-center mt-1">
            <View className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-1 rounded-xl`}>
              <Text className={`${isDark ? 'text-gray-200' : 'text-gray-700'} text-xs font-semibold`}>
                {relLabel(item.relationship)}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setImportant(item, false)}
            disabled={importantUpdatingId === String(item.id)}
            className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} w-10 h-10 rounded-2xl items-center justify-center ${importantUpdatingId === String(item.id) ? 'opacity-60' : ''}`}
            accessibilityLabel="Remove from important"
          >
            <Ionicons name="star" size={18} color="#F59E0B" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openEdit(item)}
            className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} w-10 h-10 rounded-2xl items-center justify-center`}
            accessibilityLabel="Edit person"
          >
            <Ionicons name="pencil-outline" size={18} color={isDark ? '#E5E7EB' : '#111827'} />
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-1">
            <Text className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>People</Text>
            <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>Important people only</Text>
          </View>
          <TouchableOpacity
            onPress={() => setAddMenuOpen(true)}
            className="bg-blue-600 px-4 py-2 rounded-xl"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              elevation: 3,
            }}
          >
            <View className="flex-row items-center gap-1">
              <Ionicons name="add" size={18} color="#fff" />
              <Text className="text-white font-bold text-sm">Add</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {loading && people.length === 0 ? (
        <ActivityIndicator size="large" className="mt-12" />
      ) : (
        <>
          <FlatList
            data={importantPeople}
            renderItem={renderImportant}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View className="px-6 pt-10 items-center">
                <Text className="text-6xl mb-4">⭐</Text>
                <Text className={`text-lg font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  No important people yet
                </Text>
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-center mt-2`}>
                  Add the people you care about most to your important list.
                </Text>
              </View>
            }
            contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
            ListFooterComponent={
              <View className="mt-4">
                <TouchableOpacity
                  onPress={() => setShowOthers((v) => !v)}
                  className={`${isDark ? 'bg-gray-800' : 'bg-white'} px-4 py-4 rounded-2xl`}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.25 : 0.1,
                    shadowRadius: 3.84,
                    elevation: 3,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {showOthers ? 'Hide other people' : 'Show other people'}
                    </Text>
                    <Ionicons
                      name={showOthers ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={isDark ? '#9CA3AF' : '#6B7280'}
                    />
                  </View>
                  <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                    {otherPeople.length} other {otherPeople.length === 1 ? 'person' : 'people'}
                  </Text>
                </TouchableOpacity>

                {showOthers && (
                  <View className="mt-3">
                    {otherPeople.map((p) => (
                      <View
                        key={p.id}
                        className={`${isDark ? 'bg-gray-800' : 'bg-white'} px-4 py-3 rounded-2xl mb-2 flex-row items-center justify-between`}
                      >
                        <View className="flex-1 pr-3">
                          <Text className={`text-sm font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {p.name}
                          </Text>
                          <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                            {relLabel(p.relationship)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={async () => setImportant(p, true)}
                          disabled={importantUpdatingId === String(p.id)}
                          className={`bg-blue-600 px-3 py-2 rounded-xl ${importantUpdatingId === String(p.id) ? 'opacity-60' : ''}`}
                        >
                          <Text className="text-white text-xs font-bold">Add</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    {otherPeople.length === 0 && (
                      <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-center mt-2`}>
                        No other people yet.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            }
          />

          <TouchableOpacity
            className="absolute left-4 right-4 bottom-6 bg-blue-600 py-4 rounded-2xl items-center"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 6,
            }}
            onPress={() => setAddMenuOpen(true)}
          >
            <Text className="text-white font-extrabold text-base">Add person to list</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Add menu */}
      <Modal visible={addMenuOpen} transparent animationType="fade" onRequestClose={() => setAddMenuOpen(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-t-3xl p-5`}>
            <Text className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add person</Text>
            <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
              Add an existing person to your important list, or create a new one.
            </Text>

            <TouchableOpacity
              className="mt-4 bg-blue-600 py-4 rounded-2xl items-center"
              onPress={() => {
                setAddMenuOpen(false);
                setExistingSearch('');
                setExistingPickerOpen(true);
              }}
            >
              <Text className="text-white font-extrabold">Add existing person</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} mt-3 py-4 rounded-2xl items-center`}
              onPress={() => {
                setAddMenuOpen(false);
                setNewPersonOpen(true);
              }}
            >
              <Text className={`${isDark ? 'text-white' : 'text-gray-900'} font-extrabold`}>Create new person</Text>
            </TouchableOpacity>

            <TouchableOpacity className="mt-3 py-4 rounded-2xl items-center" onPress={() => setAddMenuOpen(false)}>
              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-600'} font-bold`}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Existing picker */}
      <Modal visible={existingPickerOpen} transparent animationType="slide" onRequestClose={() => setExistingPickerOpen(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl p-5 max-h-[80%]`}>
            <View className="flex-row items-center justify-between">
              <Text className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add existing</Text>
              <TouchableOpacity onPress={() => setExistingPickerOpen(false)}>
                <Ionicons name="close" size={22} color={isDark ? '#E5E7EB' : '#111827'} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={existingSearch}
              onChangeText={setExistingSearch}
              placeholder="Search people…"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
              className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} mt-4 px-4 py-3 rounded-2xl`}
            />

            <ScrollView className="mt-4">
              {filteredOtherPeople.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  className={`${isDark ? 'bg-gray-800' : 'bg-gray-50'} px-4 py-3 rounded-2xl mb-2 flex-row items-center justify-between`}
                  onPress={async () => {
                    await setImportant(p, true);
                    setExistingPickerOpen(false);
                  }}
                >
                  <View className="flex-1 pr-3">
                    <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-bold`}>{p.name}</Text>
                    <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>{relLabel(p.relationship)}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={isDark ? '#60A5FA' : '#2563EB'} />
                </TouchableOpacity>
              ))}
              {filteredOtherPeople.length === 0 && (
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-center mt-6`}>No matches.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create new */}
      <Modal visible={newPersonOpen} transparent animationType="slide" onRequestClose={() => setNewPersonOpen(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl p-5 max-h-[85%]`}>
            <View className="flex-row items-center justify-between">
              <Text className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>New person</Text>
              <TouchableOpacity onPress={() => setNewPersonOpen(false)}>
                <Ionicons name="close" size={22} color={isDark ? '#E5E7EB' : '#111827'} />
              </TouchableOpacity>
            </View>

            <ScrollView className="mt-4">
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Name"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
              />

              <View className="mt-3 flex-row flex-wrap gap-2">
                {REL_OPTIONS.map((opt) => {
                  const selected = newRel === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setNewRel(opt.key)}
                      className={`${selected ? 'bg-blue-600' : isDark ? 'bg-gray-800' : 'bg-gray-100'} px-3 py-2 rounded-2xl`}
                    >
                      <Text className={`${selected ? 'text-white' : isDark ? 'text-gray-200' : 'text-gray-800'} font-bold text-xs`}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View className="mt-4">
                <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-bold mb-2`}>Details (optional)</Text>
                {META_FIELDS[newRel].map((f) => (
                  <View key={f.key} className="mb-2">
                    <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs font-semibold mb-1`}>{f.label}</Text>
                    <TextInput
                      value={newMeta[f.key] || ''}
                      onChangeText={(t) => setNewMeta((m) => ({ ...m, [f.key]: t }))}
                      placeholder={f.placeholder || ''}
                      placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                      className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
                    />
                  </View>
                ))}
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs font-semibold mb-1 mt-1`}>
                  Notes (optional)
                </Text>
                <TextInput
                  value={newNotes}
                  onChangeText={setNewNotes}
                  placeholder="Anything else…"
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  multiline
                  className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
                />
              </View>

              <TouchableOpacity className="mt-4 bg-blue-600 py-4 rounded-2xl items-center" onPress={createNewImportantPerson}>
                <Text className="text-white font-extrabold">Add to important list</Text>
              </TouchableOpacity>
              <View className="h-8" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit person */}
      <Modal visible={editPersonOpen} transparent animationType="slide" onRequestClose={() => setEditPersonOpen(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl p-5 max-h-[85%]`}>
            <View className="flex-row items-center justify-between">
              <Text className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>Edit person</Text>
              <TouchableOpacity onPress={() => setEditPersonOpen(false)}>
                <Ionicons name="close" size={22} color={isDark ? '#E5E7EB' : '#111827'} />
              </TouchableOpacity>
            </View>

            <ScrollView className="mt-4">
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Name"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
              />

              <View className="mt-3 flex-row flex-wrap gap-2">
                {REL_OPTIONS.map((opt) => {
                  const selected = editRel === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setEditRel(opt.key)}
                      className={`${selected ? 'bg-blue-600' : isDark ? 'bg-gray-800' : 'bg-gray-100'} px-3 py-2 rounded-2xl`}
                    >
                      <Text className={`${selected ? 'text-white' : isDark ? 'text-gray-200' : 'text-gray-800'} font-bold text-xs`}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View className="mt-4">
                <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-bold mb-2`}>Details (optional)</Text>
                {META_FIELDS[editRel].map((f) => (
                  <View key={f.key} className="mb-2">
                    <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs font-semibold mb-1`}>{f.label}</Text>
                    <TextInput
                      value={editMeta[f.key] || ''}
                      onChangeText={(t) => setEditMeta((m) => ({ ...m, [f.key]: t }))}
                      placeholder={f.placeholder || ''}
                      placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                      className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
                    />
                  </View>
                ))}
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs font-semibold mb-1 mt-1`}>
                  Notes (optional)
                </Text>
                <TextInput
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Anything else…"
                  placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                  multiline
                  className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
                />
              </View>

              <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                  className={`${isDark ? 'bg-gray-800' : 'bg-gray-100'} flex-1 py-4 rounded-2xl items-center`}
                  onPress={deleteFromEdit}
                >
                  <Text className="text-red-500 font-extrabold">Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity className="bg-blue-600 flex-1 py-4 rounded-2xl items-center" onPress={saveEdit}>
                  <Text className="text-white font-extrabold">Save</Text>
                </TouchableOpacity>
              </View>

              <View className="h-8" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}


