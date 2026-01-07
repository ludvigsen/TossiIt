import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, Image, Alert, Text, ScrollView, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { API_URL } from '../utils/env';

export default function HomeScreen() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

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
      const bearer = tokens.idToken; // Backend expects ID token
      if (!bearer) {
        throw new Error('No idToken available; please sign in again.');
      }
      return { 
          'Authorization': `Bearer ${bearer}`,
          'X-User-Id': userInfo?.user.id 
      };
  };

  useEffect(() => {
    // Fetch summary
    getAuthHeader().then(headers => {
        axios.get(`${API_URL}/summary`, { headers })
        .then(res => setSummary(res.data.summary))
        .catch(async (err) => {
          // If 401, try with refreshed token
          if (err?.response?.status === 401) {
            try {
              const refreshedHeaders = await getAuthHeader(true);
              const res = await axios.get(`${API_URL}/summary`, { headers: refreshedHeaders });
              setSummary(res.data.summary);
            } catch (refreshErr) {
              console.error('Failed to fetch summary after token refresh:', refreshErr);
            }
          } else {
            console.error('Failed to fetch summary:', err);
          }
        });
    });
  }, []);

  const ensureMediaPermissions = async () => {
    const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status === 'granted' || status === 'limited') return true;

    if (!canAskAgain) {
      Alert.alert(
        'Permission needed',
        'Please enable photo library access in Settings to pick images.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    } else {
      Alert.alert('Permission needed', 'Please allow photo library access to pick images.');
    }
    return false;
  };

  const pickImage = async () => {
    try {
      const granted = await ensureMediaPermissions();
      if (!granted) return;

      const mediaTypeImages =
        // Prefer new API; fall back to string for safety on older runtimes
        // @ts-ignore
        (ImagePicker as any).MediaType?.Images ?? 'images';

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: [mediaTypeImages],
        allowsEditing: true,
        quality: 1,
        selectionLimit: 1,
      });

      if (!result.canceled && result.assets?.length) {
        setImage(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Image pick failed', err);
      Alert.alert('Error', 'Unable to open image picker.');
    }
  };

  const submitDump = async () => {
    if (!text && !image) return;
    
    setLoading(true);
    const formData = new FormData();
    const userInfo = GoogleSignin.getCurrentUser();
    
    formData.append('user_id', userInfo?.user.id || 'unknown'); 
    formData.append('source_type', 'app_capture');
    if (text) formData.append('content_text', text);
    
    if (image) {
      // @ts-ignore
      formData.append('file', {
        uri: image,
        name: 'upload.jpg',
        type: 'image/jpeg',
      });
    }

    try {
      let headers = await getAuthHeader();
      try {
        await axios.post(`${API_URL}/dump`, formData, {
          headers: { 
              'Content-Type': 'multipart/form-data',
              ...headers
          },
        });
        Alert.alert('Success', 'Dump saved!');
        setText('');
        setImage(null);
      } catch (error: any) {
        // If 401, try once more with refreshed token
        if (error?.response?.status === 401) {
          headers = await getAuthHeader(true); // Force refresh
          await axios.post(`${API_URL}/dump`, formData, {
            headers: { 
                'Content-Type': 'multipart/form-data',
                ...headers
            },
          });
          Alert.alert('Success', 'Dump saved!');
          setText('');
          setImage(null);
        } else {
          throw error;
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save dump');
      console.error(error);
    } finally {
        setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>The Dump</Text>

      {summary && (
        <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Morning Briefing</Text>
            <Text>{summary}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="What's on your mind?"
        value={text}
        onChangeText={setText}
        multiline
      />
      <Button title="Pick an image" onPress={pickImage} />
      {image && <Image source={{ uri: image }} style={styles.image} />}
      <Button title={loading ? "Dumping..." : "Dump It!"} onPress={submitDump} disabled={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  summaryCard: { backgroundColor: '#f0f0f0', padding: 15, borderRadius: 8, marginBottom: 20 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 20, minHeight: 100, borderRadius: 8 },
  image: { width: '100%', height: 200, marginVertical: 10, borderRadius: 8 },
});

