/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light theme colors
        light: {
          background: '#ffffff',
          surface: '#f5f5f5',
          text: '#1f2937',
          textSecondary: '#6b7280',
          border: '#e5e7eb',
          primary: '#2196F3',
          primaryDark: '#1976D2',
          secondary: '#4CAF50',
          danger: '#f44336',
          warning: '#FF9800',
        },
        // Dark theme colors
        dark: {
          background: '#111827',
          surface: '#1f2937',
          text: '#f9fafb',
          textSecondary: '#9ca3af',
          border: '#374151',
          primary: '#42a5f5',
          primaryDark: '#2196F3',
          secondary: '#66bb6a',
          danger: '#ef5350',
          warning: '#ffa726',
        },
      },
    },
  },
  plugins: [],
};

