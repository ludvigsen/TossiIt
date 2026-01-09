// Simple runtime API URL selector
// Uses EXPO_PUBLIC_API_URL if set; otherwise defaults based on platform
// Android emulator uses 10.0.2.2 for host machine
import { Platform } from 'react-native';

const productionUrl = 'https://api-kixeywtaia-uc.a.run.app/api';

const fallback = Platform.select({
  android: 'http://10.0.2.2:3000/api',
  ios: 'http://localhost:3000/api',
  default: 'http://localhost:3000/api',
});

// Temporarily force production URL for debugging
// Set EXPO_PUBLIC_API_URL environment variable to override, or change this line
const FORCE_PRODUCTION = false; // Set to true to force the deployed backend

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  // @ts-ignore
  (FORCE_PRODUCTION || !__DEV__ ? productionUrl : fallback!);

// Log the API URL for debugging
if (__DEV__) {
  console.log('API_URL configured as:', API_URL);
  console.log('FORCE_PRODUCTION:', FORCE_PRODUCTION);
  console.log('__DEV__:', __DEV__);
}


