// Simple runtime API URL selector
// Uses EXPO_PUBLIC_API_URL if set; otherwise defaults based on platform
// Android emulator uses 10.0.2.2 for host machine
import { Platform } from 'react-native';

const fallback = Platform.select({
  android: 'http://10.0.2.2:3000/api',
  ios: 'http://localhost:3000/api',
  default: 'http://localhost:3000/api',
});

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || fallback!;


