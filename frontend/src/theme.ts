import { useColorScheme } from 'react-native';

export type Theme = 'light' | 'dark';

export const useTheme = () => {
  const colorScheme = useColorScheme();
  return (colorScheme || 'light') as Theme;
};

export const getThemeColors = (theme: Theme) => {
  if (theme === 'dark') {
    return {
      background: 'bg-gray-900',
      surface: 'bg-gray-800',
      text: 'text-gray-50',
      textSecondary: 'text-gray-400',
      border: 'border-gray-700',
      primary: 'bg-blue-500',
      primaryText: 'text-blue-500',
      primaryDark: 'bg-blue-600',
      secondary: 'bg-green-500',
      secondaryText: 'text-green-500',
      danger: 'bg-red-500',
      dangerText: 'text-red-500',
      warning: 'bg-orange-500',
      warningText: 'text-orange-500',
    };
  }
  
  return {
    background: 'bg-white',
    surface: 'bg-gray-100',
    text: 'text-gray-900',
    textSecondary: 'text-gray-600',
    border: 'border-gray-300',
    primary: 'bg-blue-500',
    primaryText: 'text-blue-500',
    primaryDark: 'bg-blue-600',
    secondary: 'bg-green-500',
    secondaryText: 'text-green-500',
    danger: 'bg-red-500',
    dangerText: 'text-red-500',
    warning: 'bg-orange-500',
    warningText: 'text-orange-500',
  };
};

