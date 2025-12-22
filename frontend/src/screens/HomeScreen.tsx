import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, Image, Alert, Text, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const API_URL = 'https://api-kixeywtaia-uc.a.run.app/api';

export default function HomeScreen() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const getAuthHeader = async () => {
      const tokens = await GoogleSignin.getTokens();
      // Or use idToken, depending on backend verification strategy
      const userInfo = GoogleSignin.getCurrentUser();
      return { 
          'Authorization': `Bearer ${tokens.accessToken}`,
          'X-User-Id': userInfo?.user.id 
      };
  };

  useEffect(() => {
    // Fetch summary
    getAuthHeader().then(headers => {
        axios.get(`${API_URL}/summary`, { headers })
        .then(res => setSummary(res.data.summary))
        .catch(err => console.error(err));
    });
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
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
      const headers = await getAuthHeader();
      await axios.post(`${API_URL}/dump`, formData, {
        headers: { 
            'Content-Type': 'multipart/form-data',
            ...headers
        },
      });
      Alert.alert('Success', 'Dump saved!');
      setText('');
      setImage(null);
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

