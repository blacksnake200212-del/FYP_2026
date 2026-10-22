import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function CircularGauge({
  percentage = 45,
  status = 'NORMAL',
  statusColor = '#0284C7',
  isStale = false,
  trend = 'STEADY',
  size = 220,
  strokeWidth = 14,
  theme = 'light' // 'light' for Public App, 'dark' for Operator App
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  const center = size / 2;
  const radius = center - strokeWidth - 6;
  const circumference = 2 * Math.PI * radius;

  // Clamped percentage 0 - 100
  const clampedPct = Math.min(Math.max(percentage, 0), 100);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: clampedPct,
      duration: 1000,
      useNativeDriver: false
    }).start();
  }, [clampedPct]);

  // Interpolate strokeDashoffset
  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0]
  });

  // Real dam scaled height (3.00 m full supply level)
  const realDamM = ((clampedPct / 100.0) * 3.00).toFixed(2);
  const realDamCm = Math.round((clampedPct / 100.0) * 300);

  const isLight = theme === 'light';

  // Gradient colors based on alert state
  const getGradientColors = () => {
    if (isLight) {
      switch (status) {
        case 'DANGER':
          return { start: '#EF4444', end: '#DC2626' };
        case 'CLEAR_AREA':
          return { start: '#F97316', end: '#EA580C' };
        case 'PRE_WARNING':
          return { start: '#F59E0B', end: '#D97706' };
        default:
          return { start: '#38BDF8', end: '#0284C7' }; // Vivid blue for public app design
      }
    } else {
      switch (status) {
        case 'DANGER':
          return { start: '#EF4444', end: '#991B1B' };
        case 'CLEAR_AREA':
          return { start: '#F97316', end: '#C2410C' };
        case 'PRE_WARNING':
          return { start: '#FACC15', end: '#CA8A04' };
        default:
          return { start: '#10B981', end: '#059669' }; // Neon green / cyan for operator
      }
    }
  };

  const gradient = getGradientColors();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradient.start} />
            <Stop offset="100%" stopColor={gradient.end} />
          </LinearGradient>
        </Defs>

        {/* Background track circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={isLight ? '#E0F2FE' : '#1E293B'}
          strokeWidth={strokeWidth}
          fill={isLight ? '#FFFFFF' : '#0B132B'}
        />

        {/* Active Animated Progress Arc */}
        <G rotation="-90" origin={`${center}, ${center}`}>
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>

      {/* Center Readout Content */}
      <View style={styles.centerTextContainer}>
        <Text style={[styles.waterLevelLabel, { color: isLight ? '#64748B' : '#94A3B8' }]}>
          Water Level
        </Text>

        <Text style={[styles.percentValue, { color: isLight ? '#0284C7' : '#FFFFFF' }]}>
          {Math.round(clampedPct)}%
        </Text>

        <Text style={[styles.depthValue, { color: isLight ? '#0F172A' : '#38BDF8' }]}>
          {realDamM} m ({realDamCm} cm)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center'
  },
  waterLevelLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.2
  },
  percentValue: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 50
  },
  depthValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2
  }
});
