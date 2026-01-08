import React, { useState, useEffect } from 'react';
import { View, TextInput, Image, Alert, Text, ScrollView, Linking, TouchableOpacity, ActivityIndicator, Modal, Platform } from 'react-native';
import { useColorScheme } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
// Use expo-file-system for reading files as base64
import * as FileSystem from 'expo-file-system/legacy';
import { useShareIntentContext } from 'expo-share-intent';
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
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const [shareConsumed, setShareConsumed] = useState(false);

  useEffect(() => {
    if (!hasShareIntent || shareConsumed) return;

    // Cold start: files can arrive a tick later; this effect will rerun when shareIntent updates.
    if (shareIntent.type === 'image' || shareIntent.type === 'media') {
      const first = shareIntent.files?.[0];
      const uri = first?.path;
      if (uri) {
        console.log('Share intent image received:', { uri, mimeType: first?.mimeType, fileName: first?.fileName });
        setImage(uri);
        setShareConsumed(true);
        // Give the UI time to render the image before clearing native payload.
        setTimeout(() => resetShareIntent(), 750);
      } else {
        console.log('Share intent present but no file yet:', shareIntent);
      }
    } else if (shareIntent.type === 'text') {
      const value = shareIntent.value || '';
      console.log('Share intent text received:', value?.slice?.(0, 80));
      setText(value);
      setShareConsumed(true);
      setTimeout(() => resetShareIntent(), 750);
    }
  }, [hasShareIntent, shareIntent, shareConsumed, resetShareIntent]);

  const getAuthHeader = async (forceRefresh = false) => {
    // Never show dialogs from background/initialization flows
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
    let userInfo = await GoogleSignin.getCurrentUser();
    if (!userInfo) {
      try {
        await GoogleSignin.signInSilently();
      } catch {
        // Do NOT trigger interactive sign-in here (can crash on cold start).
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
    
    const userInfo = await GoogleSignin.getCurrentUser();

    // Use JSON for both text + images.
    // For images, encode as base64 to avoid flaky multipart uploads on RN/Android.
    let requestData: any;
    if (image) {
      try {
        setProgressText('Reading image...');
        let fileUri = image;
        if (!fileUri.includes('://')) {
          fileUri = fileUri.startsWith('/') ? `file://${fileUri}` : `file:///${fileUri}`;
        }

        const base64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        requestData = {
          user_id: userInfo?.user.id || 'unknown',
          source_type: 'app_capture',
          content_text: text || null,
          file_base64: base64,
        };
        console.log('Prepared JSON payload with image base64 length:', base64.length);
      } catch (e) {
        console.error('Failed to read image as base64:', e);
        Alert.alert('Error', 'Failed to read image. Please try another image.');
        setLoading(false);
        setProgressText('');
        return;
      }
    } else {
      requestData = {
        user_id: userInfo?.user.id || 'unknown',
        source_type: 'app_capture',
        content_text: text || null,
      };
    }

    try {
      setProgressText('Authenticating...');
      let headers = await getAuthHeader();
      
      console.log('Uploading to:', `${API_URL}/dump`);
      console.log('Request entries:', { hasFile: !!image, hasText: !!text, userId: userInfo?.user.id });
      
      // Test connectivity first with a simple authenticated request (like other screens do)
      try {
        console.log('Testing backend connectivity with authenticated request...');
        console.log('Full API_URL:', API_URL);
        // Use the same pattern as other screens - try to fetch something that requires auth
        // This will tell us if it's a general connectivity issue or specific to FormData
        const testResponse = await axios.get(`${API_URL}/people`, { 
          headers,
          timeout: 10000,
          validateStatus: (status) => status < 500 // Accept any status < 500 as "reachable"
        });
        console.log('Backend is reachable, status:', testResponse.status);
      } catch (testError: any) {
        console.error('Backend connectivity test failed:');
        console.error('  Error code:', testError?.code);
        console.error('  Error message:', testError?.message);
        console.error('  Error response:', testError?.response?.status, testError?.response?.data);
        console.error('  Request URL:', testError?.config?.url);
        // If this fails, it's a general connectivity issue, not FormData-specific
        if (testError?.code === 'ERR_NETWORK') {
          Alert.alert(
            'Network Error', 
            'Cannot reach the backend server. Please check:\n' +
            '1. Your internet connection\n' +
            '2. If you\'re on a VPN, try disabling it\n' +
            '3. The backend URL: ' + API_URL
          );
          setLoading(false);
          setProgressText('');
          return;
        }
        // Continue anyway - might be a 401/403 which is fine for testing
      }
      
      setProgressText('Uploading and processing...');
      try {
        const response = await axios.post(`${API_URL}/dump`, requestData, {
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        console.log('Upload successful:', response.status);
        setProgressText('Success!');
        Alert.alert('Success', 'Note saved!');
        setText('');
        setImage(null);
      } catch (error: any) {
        console.log('Caught error during upload:', error);
        console.log('Error status:', error?.response?.status);
        
        if (error?.response?.status === 401) {
          console.log('401 detected, attempting refresh...');
          setProgressText('Refreshing session...');
          
          try {
            // Force sign in silently to ensure we get a fresh token
            await GoogleSignin.signInSilently();
            headers = await getAuthHeader(true);
            console.log('Session refreshed, new headers obtained');
          } catch (refreshError) {
            console.error('Failed to refresh session:', refreshError);
            throw new Error('Session expired. Please sign out and sign in again.');
          }

          setProgressText('Retrying upload...');
          await axios.post(`${API_URL}/dump`, requestData, {
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          });

          Alert.alert('Success', 'Note saved!');
          setText('');
          setImage(null);
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      console.error('Error response:', error?.response?.data);
      console.error('Error status:', error?.response?.status);
      console.error('Request URL:', `${API_URL}/dump`);
      
      let errorMessage = 'Failed to save note';
      
      if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your internet connection and try again.';
      } else if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
        errorMessage = 'Network error. Please check your internet connection and ensure the server is reachable.';
      } else if (error?.code === 'ERR_INTERNET_DISCONNECTED') {
        errorMessage = 'No internet connection. Please check your network settings.';
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.status) {
        errorMessage = `Server error (${error.response.status}). Please try again later.`;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
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
