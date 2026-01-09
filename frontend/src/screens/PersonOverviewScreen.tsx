import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  useColorScheme,
  Modal,
  TextInput,
} from 'react-native';
import axios from 'axios';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../utils/env';
import { getAuthHeaders } from '../utils/auth';

export default function PersonOverviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const personId = route?.params?.personId as string | undefined;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editorKind, setEditorKind] = useState<'todo' | 'info'>('todo');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | ''>('');
  const [formDueDate, setFormDueDate] = useState(''); // YYYY-MM-DD
  const [formExpiresAt, setFormExpiresAt] = useState(''); // YYYY-MM-DD
  const [formPeopleIds, setFormPeopleIds] = useState<string[]>([]);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const tzOffsetMinutes = new Date().getTimezoneOffset();

  const fetchOverview = async () => {
    if (!personId) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(
        `${API_URL}/person-overview/${personId}?tzOffsetMinutes=${tzOffsetMinutes}`,
        { headers },
      );
      setData(res.data);
    } catch (e) {
      console.error('Failed to fetch person overview', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeople = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_URL}/people`, { headers });
      setPeople(res.data || []);
    } catch {
      // ignore
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchOverview();
      fetchPeople();
    }, [personId]),
  );

  const person = data?.person;
  const events = data?.events ?? [];
  const todos = data?.todos ?? [];
  const infos = data?.infos ?? [];
  const inboxItems = data?.inboxItems ?? [];
  const recentDumps = data?.recentDumps ?? [];

  const personIdSet = useMemo(() => (personId ? new Set([personId]) : new Set<string>()), [personId]);

  const togglePerson = (id: string) => {
    setFormPeopleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openCreate = (kind: 'todo' | 'info') => {
    setEditingItem(null);
    setEditorKind(kind);
    setFormTitle('');
    setFormDescription('');
    setFormCategory(kind === 'todo' ? 'school' : 'school');
    setFormPriority('');
    setFormDueDate('');
    setFormExpiresAt('');
    setFormPeopleIds(personId ? [personId] : []);
    setEditorOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setEditorKind(item.kind === 'info' ? 'info' : 'todo');
    setFormTitle(String(item.title || ''));
    setFormDescription(String(item.description || ''));
    setFormCategory(String(item.category || ''));
    setFormPriority((item.priority as any) || '');
    setFormDueDate(item.dueDate ? String(item.dueDate).slice(0, 10) : '');
    setFormExpiresAt(item.expiresAt ? String(item.expiresAt).slice(0, 10) : '');
    setFormPeopleIds(Array.isArray(item.people) ? item.people.map((p: any) => p.id) : personId ? [personId] : []);
    if (personId && !formPeopleIds.includes(personId)) {
      // ensure person stays included by default (user can remove, but default should include)
      setFormPeopleIds((prev) => (prev.includes(personId) ? prev : [personId, ...prev]));
    }
    setEditorOpen(true);
  };

  const submitEditor = async () => {
    const title = formTitle.trim();
    if (!title) {
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const payload: any = {
        title,
        description: formDescription.trim() || null,
        category: formCategory.trim() || null,
        priority: editorKind === 'todo' ? (formPriority || null) : null,
        peopleIds: formPeopleIds,
      };
      if (editorKind === 'todo') payload.dueDate = formDueDate.trim() ? formDueDate.trim() : null;
      if (editorKind === 'info') payload.expiresAt = formExpiresAt.trim() ? formExpiresAt.trim() : null;

      if (editingItem) {
        await axios.patch(`${API_URL}/actionable-items/${editingItem.id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/actionable-items`, { ...payload, kind: editorKind }, { headers });
      }
      setEditorOpen(false);
      setEditingItem(null);
      await fetchOverview();
    } catch (e) {
      console.error('Failed to save item', e);
    }
  };

  const completeTodo = async (item: any) => {
    try {
      const headers = await getAuthHeaders();
      await axios.patch(`${API_URL}/actionable-items/${item.id}/complete`, { completed: true }, { headers });
      await fetchOverview();
    } catch (e) {
      console.error('Failed to complete item', e);
    }
  };

  const archiveItem = async (item: any) => {
    try {
      const headers = await getAuthHeaders();
      await axios.patch(`${API_URL}/actionable-items/${item.id}/archive`, {}, { headers });
      await fetchOverview();
    } catch (e) {
      console.error('Failed to archive item', e);
    }
  };

  const unarchiveItem = async (item: any) => {
    try {
      const headers = await getAuthHeaders();
      await axios.patch(`${API_URL}/actionable-items/${item.id}/unarchive`, {}, { headers });
      await fetchOverview();
    } catch (e) {
      console.error('Failed to unarchive item', e);
    }
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <View className={`${isDark ? 'bg-gray-900' : 'bg-gray-100'} px-4 pt-4 pb-3`}>
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => navigation.navigate('People')}
            className="flex-row items-center"
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={isDark ? '#E5E7EB' : '#111827'}
            />
            <Text className={`text-base font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              People
            </Text>
          </TouchableOpacity>
        </View>

        <Text className={`mt-3 text-2xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {person?.name || 'Person'}
        </Text>
        {!!person?.relationship && (
          <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
            {person.relationship}{person.category ? ` • ${person.category}` : ''}
          </Text>
        )}
      </View>

      {loading && !data ? (
        <ActivityIndicator size="large" className="mt-12" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {/* Todos */}
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-2xl mb-4`}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ✅ Todos
              </Text>
              <TouchableOpacity
                onPress={() => openCreate('todo')}
                className="bg-blue-600 px-3 py-2 rounded-xl"
              >
                <Text className="text-white font-bold text-xs">+ Add</Text>
              </TouchableOpacity>
            </View>
            {todos.length === 0 ? (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No active todos.</Text>
            ) : (
              todos.map((t: any) => (
                <View key={t.id} className="py-2 border-b" style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-semibold`}>
                        {t.title}
                      </Text>
                      {t.dueDate && (
                        <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                          Due: {new Date(t.dueDate).toLocaleDateString()}
                        </Text>
                      )}
                      {Array.isArray(t.people) && t.people.length > 0 && (
                        <View className="flex-row flex-wrap gap-2 mt-2">
                          {t.people.map((p: any) => (
                            <View key={p.id} className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-1 rounded-xl`}>
                              <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-xs font-semibold`}>
                                {p.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => openEdit(t)}
                        className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-2 rounded-xl`}
                      >
                        <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-xs font-bold`}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => completeTodo(t)}
                        className="bg-green-600 px-2 py-2 rounded-xl"
                      >
                        <Text className="text-white text-xs font-bold">Done</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => archiveItem(t)}
                        className={`${isDark ? 'bg-gray-700' : 'bg-gray-200'} px-2 py-2 rounded-xl`}
                      >
                        <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-xs font-bold`}>Archive</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {t.dueDate && (
                    <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                      Due: {new Date(t.dueDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Info */}
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-2xl mb-4`}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ℹ️ Info
              </Text>
              <TouchableOpacity
                onPress={() => openCreate('info')}
                className="bg-blue-600 px-3 py-2 rounded-xl"
              >
                <Text className="text-white font-bold text-xs">+ Add</Text>
              </TouchableOpacity>
            </View>
            {infos.length === 0 ? (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No active info.</Text>
            ) : (
              infos.map((i: any) => (
                <View key={i.id} className="py-2 border-b" style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-semibold`}>
                        {i.title}
                      </Text>
                      {i.expiresAt && (
                        <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                          Expires: {new Date(i.expiresAt).toLocaleDateString()}
                        </Text>
                      )}
                      {Array.isArray(i.people) && i.people.length > 0 && (
                        <View className="flex-row flex-wrap gap-2 mt-2">
                          {i.people.map((p: any) => (
                            <View key={p.id} className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-1 rounded-xl`}>
                              <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-xs font-semibold`}>
                                {p.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => openEdit(i)}
                        className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'} px-2 py-2 rounded-xl`}
                      >
                        <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-xs font-bold`}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => archiveItem(i)}
                        className={`${isDark ? 'bg-gray-700' : 'bg-gray-200'} px-2 py-2 rounded-xl`}
                      >
                        <Text className={`${isDark ? 'text-gray-200' : 'text-gray-800'} text-xs font-bold`}>Archive</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Events */}
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-2xl mb-4`}>
            <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              📅 Events
            </Text>
            {events.length === 0 ? (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No linked events.</Text>
            ) : (
              events.slice(0, 20).map((e: any) => (
                <View key={e.id} className="py-2 border-b" style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                  <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-semibold`}>
                    {e.title}
                  </Text>
                  {e.startTime && (
                    <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                      {new Date(e.startTime).toLocaleString()}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Inbox */}
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-2xl mb-4`}>
            <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              📥 Inbox
            </Text>
            {inboxItems.length === 0 ? (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No pending inbox items.</Text>
            ) : (
              inboxItems.slice(0, 10).map((it: any) => (
                <View key={it.id} className="py-2 border-b" style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                  <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'} font-semibold`}>
                    {it.dump?.contentText?.slice?.(0, 80) || 'Inbox item'}
                  </Text>
                  <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-xs mt-1`}>
                    Status: {it.status}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Recent notes */}
          <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-2xl mb-4`}>
            <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              📝 Recent notes
            </Text>
            {recentDumps.length === 0 ? (
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No recent notes.</Text>
            ) : (
              recentDumps.map((d: any) => (
                <View key={d.id} className="py-2 border-b" style={{ borderBottomColor: isDark ? '#374151' : '#e5e7eb' }}>
                  <Text className={`${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    {d.contentText || (d.mediaUrl ? 'Image note' : 'Note')}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl p-5 max-h-[85%]`}>
            <View className="flex-row items-center justify-between">
              <Text className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {editingItem ? 'Edit' : 'New'} {editorKind === 'info' ? 'Info' : 'Todo'}
              </Text>
              <TouchableOpacity onPress={() => setEditorOpen(false)}>
                <Text className={`${isDark ? 'text-gray-300' : 'text-gray-600'} font-bold`}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="mt-4">
              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-1`}>Title *</Text>
              <TextInput
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="What is this?"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
              />

              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-1 mt-3`}>Description</Text>
              <TextInput
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Optional details…"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                multiline
                className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
              />

              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-1 mt-3`}>Category</Text>
              <TextInput
                value={formCategory}
                onChangeText={setFormCategory}
                placeholder="school, family, work…"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
              />

              {editorKind === 'todo' ? (
                <>
                  <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-1 mt-3`}>Due date (YYYY-MM-DD)</Text>
                  <TextInput
                    value={formDueDate}
                    onChangeText={setFormDueDate}
                    placeholder="2026-01-08"
                    placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                    className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
                  />

                  <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-2 mt-3`}>Priority</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(['high', 'medium', 'low'] as const).map((p) => {
                      const selected = formPriority === p;
                      return (
                        <TouchableOpacity
                          key={p}
                          onPress={() => setFormPriority(selected ? '' : p)}
                          className={`${selected ? 'bg-blue-600' : isDark ? 'bg-gray-800' : 'bg-gray-100'} px-3 py-2 rounded-2xl`}
                        >
                          <Text className={`${selected ? 'text-white' : isDark ? 'text-gray-200' : 'text-gray-800'} font-bold text-xs`}>
                            {p}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-1 mt-3`}>Expires (YYYY-MM-DD)</Text>
                  <TextInput
                    value={formExpiresAt}
                    onChangeText={setFormExpiresAt}
                    placeholder="2026-01-08"
                    placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                    className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-4 py-3 rounded-2xl`}
                  />
                </>
              )}

              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'} text-xs font-semibold mb-2 mt-4`}>People</Text>
              {people.length === 0 ? (
                <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>No people yet.</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {people.map((p: any) => {
                    const selected = formPeopleIds.includes(p.id);
                    const locked = personIdSet.has(p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => (locked ? null : togglePerson(p.id))}
                        className={`${selected ? 'bg-blue-600' : isDark ? 'bg-gray-800' : 'bg-gray-100'} px-3 py-2 rounded-2xl ${locked ? 'opacity-80' : ''}`}
                        disabled={locked}
                      >
                        <Text className={`${selected ? 'text-white' : isDark ? 'text-gray-200' : 'text-gray-800'} font-bold text-xs`}>
                          {p.name}{locked ? ' • primary' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity className="mt-5 bg-blue-600 py-4 rounded-2xl items-center" onPress={submitEditor}>
                <Text className="text-white font-extrabold">Save</Text>
              </TouchableOpacity>

              {editingItem?.archivedAt && (
                <TouchableOpacity
                  className="mt-3 bg-gray-700 py-4 rounded-2xl items-center"
                  onPress={() => unarchiveItem(editingItem)}
                >
                  <Text className="text-white font-extrabold">Unarchive</Text>
                </TouchableOpacity>
              )}

              <View className="h-8" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}


