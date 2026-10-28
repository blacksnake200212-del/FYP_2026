import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Animated
} from 'react-native';
import { SUPABASE_CONFIG, supabase } from './supabaseClient';

export default function AlertsTimeline({ currentStage = 'NORMAL' }) {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('ALL'); // ALL, DANGER, CLEAR_AREA, PRE_WARNING
  const [isLoading, setIsLoading] = useState(false);

  // Fetch alerts from Supabase (Strictly REAL alerts)
  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const endpoint = `${SUPABASE_CONFIG.URL}/rest/v1/alerts?select=*&order=created_at.desc&limit=25`;
      const res = await fetch(endpoint, {
        headers: {
          apikey: SUPABASE_CONFIG.PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_CONFIG.PUBLISHABLE_KEY}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAlerts(data);
        }
      }
    } catch (err) {
      console.warn('[SDAS AlertsTimeline] Fetch error:', err.message);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAlerts();

    // Supabase Realtime Subscription: Listen to new alerts inserted
    const channel = supabase
      .channel('sdas_alerts_timeline_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          if (payload.new) {
            console.log('[SDAS AlertsTimeline] New alert event:', payload.new);
            setAlerts((prev) => [payload.new, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Format timestamp helper
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Recent';
    }
  };

  const getStageTheme = (stg) => {
    switch (stg) {
      case 'DANGER':
        return { color: '#EF4444', icon: '🚨', label: 'CRITICAL DANGER' };
      case 'CLEAR_AREA':
        return { color: '#F97316', icon: '📢', label: 'CLEAR AREA' };
      case 'PRE_WARNING':
        return { color: '#EAB308', icon: '⚠️', label: 'PRE-WARNING' };
      default:
        return { color: '#10B981', icon: '🟢', label: 'NORMAL' };
    }
  };

  const filteredAlerts = alerts.filter((item) => {
    if (filter === 'ALL') return true;
    return item.stage === filter;
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Alerts Timeline</Text>
          <Text style={styles.headerSubtitle}>Tabbowa Dam Warning Event History</Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={fetchAlerts} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#38BDF8" />
          ) : (
            <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {['ALL', 'DANGER', 'CLEAR_AREA', 'PRE_WARNING'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterBtn, filter === tab && styles.filterBtnActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterBtnText, filter === tab && styles.filterBtnTextActive]}>
              {tab === 'CLEAR_AREA' ? 'CLEAR' : tab === 'PRE_WARNING' ? 'PRE-WARN' : tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timeline Stream */}
      {filteredAlerts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🛡️</Text>
          <Text style={styles.emptyTitle}>No Active Flood Advisories</Text>
          <Text style={styles.emptyText}>
            Reservoir telemetry streaming live from ESP32 node. No emergency flood alerts logged in database.
          </Text>
        </View>
      ) : (
        <View style={styles.timelineList}>
          {filteredAlerts.map((item, index) => {
            const theme = getStageTheme(item.stage);
            const isLatest = index === 0;

            return (
              <View key={item.id || index} style={styles.timelineItem}>
                {/* Left Column: Milestone Node & Spine */}
                <View style={styles.spineColumn}>
                  <View style={[styles.dot, { backgroundColor: theme.color }]}>
                    {isLatest && <View style={[styles.pulseRing, { borderColor: theme.color }]} />}
                  </View>
                  {index < filteredAlerts.length - 1 && <View style={styles.spineLine} />}
                </View>

                {/* Right Column: Alert Event Card */}
                <View style={[styles.alertCard, { borderLeftColor: theme.color }]}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.stageBadge, { backgroundColor: theme.color }]}>
                      <Text style={styles.stageBadgeText}>
                        {theme.icon} {theme.label}
                      </Text>
                    </View>

                    <View style={styles.sourceBadge}>
                      <Text style={styles.sourceBadgeText}>
                        {item.source === 'MANUAL' ? '👨‍💼 OPERATOR' : '🤖 AUTO'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.timeText}>⏱️ {formatTime(item.created_at)}</Text>

                  <Text style={styles.messageText}>{item.message}</Text>

                  {/* Telemetry Snapshot at Trigger Moment */}
                  <View style={styles.telemetrySnapshot}>
                    <Text style={styles.telemetryTag}>
                      Level: <Text style={styles.telemetryVal}>{Number(item.water_level_pct || 0).toFixed(1)}%</Text>
                    </Text>
                    <Text style={styles.telemetryTag}>
                      Gate: <Text style={styles.telemetryVal}>{item.gate_percent ?? 0}% OPEN</Text>
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    backgroundColor: '#0A1327',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#1E2F54'
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 6
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16
  },
  container: {
    backgroundColor: '#111C36',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2F54'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800'
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2
  },
  refreshBtn: {
    backgroundColor: '#16223F',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  refreshBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700'
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#0A1327',
    borderRadius: 8,
    padding: 3,
    marginBottom: 14,
    gap: 4
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6
  },
  filterBtnActive: {
    backgroundColor: '#1E2F54'
  },
  filterBtnText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700'
  },
  filterBtnTextActive: {
    color: '#38BDF8',
    fontWeight: '800'
  },
  timelineList: {
    marginTop: 4
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 14
  },
  spineColumn: {
    width: 24,
    alignItems: 'center',
    marginRight: 10
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pulseRing: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    opacity: 0.6
  },
  spineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#1E2F54',
    marginTop: 4
  },
  alertCard: {
    flex: 1,
    backgroundColor: '#0A1327',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#1E2F54'
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  stageBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  },
  sourceBadge: {
    backgroundColor: '#16223F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  sourceBadgeText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700'
  },
  timeText: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 6
  },
  messageText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8
  },
  telemetrySnapshot: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#111C36',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  telemetryTag: {
    color: '#94A3B8',
    fontSize: 11
  },
  telemetryVal: {
    color: '#38BDF8',
    fontWeight: '700'
  }
});
