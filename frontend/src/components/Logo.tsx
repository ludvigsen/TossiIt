import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { View } from 'react-native';

export const TossItLogo = ({ width = 40, height = 40, color = "#2196F3" }) => (
  <View style={{ width, height }}>
    <Svg width="100%" height="100%" viewBox="0 0 100 100" fill="none">
      {/* Background Circle */}
      <Circle cx="50" cy="50" r="48" stroke={color} strokeWidth="4" />
      
      {/* Paper Plane / Arrow Icon */}
      <Path
        d="M25 50L45 55L75 25L50 75L45 55"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Motion trail */}
      <Path
        d="M20 70C25 75 35 80 50 80"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </Svg>
  </View>
);

