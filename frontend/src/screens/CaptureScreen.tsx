import React, { useState, useEffect } from 'react';
import { View, TextInput, Image, Alert, Text, ScrollView, Linking, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useColorScheme } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useShareIntent } from 'expo-share-intent';
import axios from 'axios';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { API_URL } from '../utils/env';

export default function CaptureScreen() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (hasShareIntent && (shareIntent.type === 'image' || shareIntent.type === 'media')) {
      if (shareIntent.files && shareIntent.files.length > 0) {
        setImage(shareIntent.files[0].path);
        // Wait a bit before resetting so UI can update
        setTimeout(() => resetShareIntent(), 100);
      }
    } else if (hasShareIntent && shareIntent.type === 'text') {
      setText(shareIntent.value || '');
      setTimeout(() => resetShareIntent(), 100);
    }
  }, [hasShareIntent, shareIntent, resetShareIntent]);

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

  const submitCapture = async () => {
    if (!text && !image) return;

    setLoading(true);
    setProgressText('Preparing upload...');
    
    const formData = new FormData();
    const userInfo = await GoogleSignin.getCurrentUser();

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
      setProgressText('Authenticating...');
      let headers = await getAuthHeader();
      
      setProgressText('Uploading and processing...');
      try {
        await axios.post(`${API_URL}/dump`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...headers
          },
        });
        setProgressText('Success!');
        Alert.alert('Success', 'Note saved!');
        setText('');
        setImage(null);
      } catch (error: any) {
        if (error?.response?.status === 401) {
          setProgressText('Refreshing session...');
          headers = await getAuthHeader(true);
          setProgressText('Retrying upload...');
          await axios.post(`${API_URL}/dump`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              ...headers
            },
          });
          Alert.alert('Success', 'Note saved!');
          setText('');
          setImage(null);
        } else {
          throw error;
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save note');
      console.error(error);
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  return (
    <ScrollView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      <View className="p-5 pt-10">
        <Text className={`text-3xl font-bold mb-2 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Capture
        </Text>
        <Text className={`text-base mb-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Quickly note down thoughts, events, or tasks.
        </Text>

        <TextInput
          className={`${isDark ? 'bg-gray-800 text-white border-gray-700' : 'bg-gray-50 text-gray-900 border-gray-200'} border rounded-xl p-4 mb-5 min-h-[150px] text-base`}
          placeholder="What's on your mind?"
          placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          onPress={pickImage}
          className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border py-4 px-4 rounded-xl mb-5 flex-row justify-center items-center`}
        >
          <Text className="text-2xl mr-2">📷</Text>
          <Text className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Add Image
          </Text>
        </TouchableOpacity>

        {image && (
          <View className="relative mb-5">
            <Image
              source={{ uri: image }}
              className="w-full h-56 rounded-xl"
              resizeMode="cover"
            />
            <TouchableOpacity
              className="absolute top-2 right-2 bg-black/50 p-2 rounded-full"
              onPress={() => setImage(null)}
            >
              <Text className="text-white text-xs">✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          onPress={submitCapture}
          disabled={loading || (!text && !image)}
          className={`${loading || (!text && !image) ? 'bg-gray-400' : 'bg-blue-600'} py-4 px-4 rounded-xl shadow-md mt-2`}
        >
          <Text className="text-white text-center font-bold text-lg">Save Note</Text>
        </TouchableOpacity>

        {/* Loading Overlay */}
        <Modal transparent={true} visible={loading} animationType="fade">
          <View className="flex-1 justify-center items-center bg-black/50">
            <View className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-2xl items-center shadow-lg w-3/4`}>
              <ActivityIndicator size="large" color="#2196F3" className="mb-4" />
              <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {progressText || 'Processing...'}
              </Text>
            </View>
          </View>
        </Modal>

      </View>
    </ScrollView>
  );
}
