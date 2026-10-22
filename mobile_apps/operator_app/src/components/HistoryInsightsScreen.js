import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  SafeAreaView
} from 'react-native';
import Svg, {
  Path,
  Line,
  Circle,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Rect
} from 'react-native-svg';
import { ArrowLeftIcon } from '../Icons';
import { supabase } from '../supabaseClient';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 200;

export default function HistoryInsightsScreen({ onBack }) {
  const [activeRange, setActiveRange] = useState('TODAY'); // 'TODAY', '7DAYS', '30DAYS'

  // Time-series telemetry points
  const points = [
    { time: '12 AM', levelM: 0.95, pct: 32 },
    { time: '6 AM', levelM: 1.25, pct: 42 },
    { time: '12 PM', levelM: 1.85, pct: 62 },
    { time: '6 PM', levelM: 2.04, pct: 68 }, // Current point
    { time: '12 AM', levelM: 1.65, pct: 55 }
  ];

  // Current stats matching design mockup Screen 4
  const currentLevelM = 2.04;
  const currentPct = 68;
  const highestLevelM = 2.65;
  const highestPct = 88;
  const lowestLevelM = 0.92;
  const lowestPct = 31;

  // Chart coordinates
  const paddingLeft = 32;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;
  const graphWidth = CHART_WIDTH - paddingLeft - paddingRight;
  const graphHeight = CHART_HEIGHT - paddingTop - paddingBottom;

  const maxVal = 3.0; // 3.00 m full supply level
  const minVal = 0.0;

  const getX = (index) => paddingLeft + (index / (points.length - 1)) * graphWidth;
  const getY = (val) => paddingTop + graphHeight - ((val - minVal) / (maxVal - minVal)) * graphHeight;

  // Generate SVG smooth curve path
  const pathD = points.reduce((acc, p, i) => {
    const x = getX(i);
    const y = getY(p.levelM);
    if (i === 0) return `M ${x} ${y}`;
    const prevX = getX(i - 1);
    const prevY = getY(points[i - 1].levelM);
    const cx1 = prevX + (x - prevX) / 2;
    const cy1 = prevY;
    const cx2 = prevX + (x - prevX) / 2;
    const cy2 = y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x} ${y}`;
  }, '');

  // Fill path under the curve
  const fillD = `${pathD} L ${getX(points.length - 1)} ${paddingTop + graphHeight} L ${getX(0)} ${paddingTop + graphHeight} Z`;

  // Highlight Current point (index 3: 6 PM, 2.04 m)
  const currentX = getX(3);
  const currentY = getY(currentLevelM);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <ArrowLeftIcon size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.headerTitle}>Water Level History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Time Range Filter Pills */}
        <View style={styles.pillRow}>
          <TouchableOpacity
            style={[styles.rangePill, activeRange === 'TODAY' && styles.rangePillActive]}
            onPress={() => setActiveRange('TODAY')}
            activeOpacity={0.8}
          >
            <Text style={[styles.rangePillText, activeRange === 'TODAY' && styles.rangePillTextActive]}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rangePill, activeRange === '7DAYS' && styles.rangePillActive]}
            onPress={() => setActiveRange('7DAYS')}
            activeOpacity={0.8}
          >
            <Text style={[styles.rangePillText, activeRange === '7DAYS' && styles.rangePillTextActive]}>
              7 Days
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rangePill, activeRange === '30DAYS' && styles.rangePillActive]}
            onPress={() => setActiveRange('30DAYS')}
            activeOpacity={0.8}
          >
            <Text style={[styles.rangePillText, activeRange === '30DAYS' && styles.rangePillTextActive]}>
              30 Days
            </Text>
          </TouchableOpacity>
        </View>

        {/* Chart Card */}
        <View style={styles.chartCard}>
          <Text style={styles.chartAxisLabel}>Level (m)</Text>

          <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#0284C7" stopOpacity="0.45" />
                <Stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Horizontal Grid lines */}
            {[0, 1, 2, 3].map((level) => {
              const y = getY(level);
              return (
                <React.Fragment key={level}>
                  <Line
                    x1={paddingLeft}
                    y1={y}
                    x2={CHART_WIDTH - paddingRight}
                    y2={y}
                    stroke="#1E293B"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <SvgText
                    x={paddingLeft - 8}
                    y={y + 4}
                    fill="#64748B"
                    fontSize="10"
                    textAnchor="end"
                  >
                    {level.toFixed(1)}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {/* Area Fill */}
            <Path d={fillD} fill="url(#chartGrad)" />

            {/* Main Blue Curve */}
            <Path d={pathD} stroke="#0284C7" strokeWidth="3" fill="none" />

            {/* Data Points */}
            {points.map((p, i) => (
              <Circle
                key={i}
                cx={getX(i)}
                cy={getY(p.levelM)}
                r={i === 3 ? 5 : 3.5}
                fill={i === 3 ? '#00F0FF' : '#0284C7'}
                stroke="#0B132B"
                strokeWidth={2}
              />
            ))}

            {/* Active Tooltip above 2.04 m */}
            <Rect
              x={currentX - 26}
              y={currentY - 26}
              width={52}
              height={20}
              rx={6}
              fill="#0284C7"
            />
            <SvgText
              x={currentX}
              y={currentY - 12}
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
            >
              2.04 m
            </SvgText>

            {/* X-Axis Time Labels */}
            {points.map((p, i) => (
              <SvgText
                key={i}
                x={getX(i)}
                y={CHART_HEIGHT - 6}
                fill="#64748B"
                fontSize="10"
                textAnchor="middle"
              >
                {p.time}
              </SvgText>
            ))}
          </Svg>
        </View>

        {/* 3 Summary Statistics Cards */}
        <View style={styles.statsContainer}>
          {/* Current Level */}
          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>Current Level</Text>
              <Text style={styles.summarySub}>Live Hydrometric Reading</Text>
            </View>
            <Text style={[styles.summaryValue, { color: '#00F0FF' }]}>
              {currentLevelM.toFixed(2)} m <Text style={styles.summaryPct}>({currentPct}%)</Text>
            </Text>
          </View>

          {/* Highest Level */}
          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>Highest Level</Text>
              <Text style={styles.summarySub}>Peak Rainfall Surge Inflow</Text>
            </View>
            <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
              {highestLevelM.toFixed(2)} m <Text style={styles.summaryPct}>({highestPct}%)</Text>
            </Text>
          </View>

          {/* Lowest Level */}
          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>Lowest Level</Text>
              <Text style={styles.summarySub}>Base Dry Weather Baseline</Text>
            </View>
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>
              {lowestLevelM.toFixed(2)} m <Text style={styles.summaryPct}>({lowestPct}%)</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B132B'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0B132B',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  container: {
    flex: 1
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40
  },
  pillRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20
  },
  rangePill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12
  },
  rangePillActive: {
    backgroundColor: '#0284C7'
  },
  rangePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8'
  },
  rangePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  chartCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20
  },
  chartAxisLabel: {
    fontSize: 11,
    color: '#64748B',
    paddingLeft: 12,
    marginBottom: 6,
    fontWeight: '600'
  },
  statsContainer: {
    gap: 12
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#334155'
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  summarySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '800'
  },
  summaryPct: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8'
  }
});
