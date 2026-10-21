import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function CircularGauge({
  percentage = 0,
  status = 'NORMAL',
  statusColor = '#10B981',
  isStale = false,
  trend = 'STEADY',
  size = 230,
  strokeWidth = 16
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

  // Calculate calibrated water column depth (40.0 cm / 0.40 m max prototype spillway depth)
  const depthCm = ((clampedPct / 100.0) * 40.0).toFixed(1);
  const depthM = (parseFloat(depthCm) / 100.0).toFixed(2);

  // Scaled real dam height (3.00 m full supply level)
  const realDamM = ((clampedPct / 100.0) * 3.00).toFixed(2);
  const realDamCm = Math.round((clampedPct / 100.0) * 300);

  // Gradient colors based on alert state
  const getGradientColors = () => {
    switch (status) {
      case 'DANGER':
        return { start: '#EF4444', end: '#B91C1C' };
      case 'CLEAR_AREA':
        return { start: '#F97316', end: '#C2410C' };
      case 'PRE_WARNING':
        return { start: '#FACC15', end: '#CA8A04' };
      default:
        return { start: '#10B981', end: '#047857' };
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

        {/* Outer subtle glow track */}
        <Circle
          cx={center}
          cy={center}
          r={radius + 4}
          stroke={isStale ? '#451A03' : 'rgba(30, 41, 59, 0.4)'}
          strokeWidth={1}
          fill="none"
        />

        {/* Background track circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#1E293B"
          strokeWidth={strokeWidth}
          fill="#0B132B"
        />

        {/* Active Animated Progress Arc */}
        <G rotation="-90" origin={`${center}, ${center}`}>
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={isStale ? '#B45309' : 'url(#gaugeGradient)'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>

      {/* Centered Gauge Telemetry Overlay */}
      <View style={styles.centerContent}>
        {isStale ? (
          <View style={styles.staleTag}>
            <Text style={styles.staleTagText}>PAUSED</Text>
          </View>
        ) : (
          <View style={[styles.liveDotRow]}>
            <View style={[styles.liveDot, { backgroundColor: statusColor }]} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}

        <Text style={[styles.bigPercent, { color: isStale ? '#F59E0B' : '#F8FAFC' }]}>
          {clampedPct.toFixed(1)}%
        </Text>

        <Text style={styles.capacityLabel}>RESERVOIR CAPACITY</Text>

        <Text style={styles.depthText}>
          Level: <Text style={styles.depthNumber}>{realDamM} m ({realDamCm} cm)</Text> / 3.00 m
        </Text>
        <Text style={styles.subDepthText}>
          Scale: {depthM} m ({depthCm} cm) / 0.40 m
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center'
  },
  liveDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5
  },
  liveText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1
  },
  staleTag: {
    backgroundColor: '#78350F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2
  },
  staleTagText: {
    color: '#FDE68A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  bigPercent: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -0.5
  },
  capacityLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2
  },
  depthText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4
  },
  subDepthText: {
    color: '#475569',
    fontSize: 9,
    marginTop: 2
  },
  depthNumber: {
    color: '#38BDF8',
    fontWeight: '700'
  }
});
