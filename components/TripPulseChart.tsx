import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { PulseDataPoint } from '../hooks/useTripStats';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COL_WIDTH = 12;
const COL_GAP = 2;
const STEP_SIZE = COL_WIDTH + COL_GAP; // 14
const SIDE_PADDING = (SCREEN_WIDTH - STEP_SIZE) / 2; // Padding to center the first item

const MAX_BAR_HEIGHT = 80;
const CLAMP_SCORE = 4.0;

interface TripPulseChartProps {
  startName: string;
  endName: string;
  totalDays?: number;
  routeCount?: number;
  data: PulseDataPoint[];
  isLoading: boolean;
}

export const TripPulseChart: React.FC<TripPulseChartProps> = ({
  startName,
  endName,
  totalDays = 0,
  routeCount = 0,
  data,
  isLoading
}) => {
  const stats = data;
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedMinute, setSelectedMinute] = useState<number | null>(null);
  const hasScrolledRef = useRef(false);

  // Calculate "Now" Index
  const currentBucketIndex = useMemo(() => {
    const now = new Date();
    const mod = now.getHours() * 60 + now.getMinutes();
    return Math.floor(mod / 5);
  }, []);

  // Helper: Format Time Range
  const getLabelText = () => {
    if (selectedMinute !== null) {
      const h = Math.floor(selectedMinute / 60);
      const m = selectedMinute % 60;
      const endMin = selectedMinute + 5;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      const fmt = (v: number) => v.toString().padStart(2, '0');
      return `${fmt(h)}:${fmt(m)} ~ ${fmt(endH)}:${fmt(endM)}`;
    }
    return routeCount > 0 
      ? `${routeCount} routes • ${totalDays} day history` 
      : `${totalDays} day history`;
  };

  // Helper: Logic for Color
  const getBarColor = (score: number, isLowConf: boolean) => {
    // Using more vivid colors for better contrast in dark mode
    if (score >= 3.0) return '#32E875'; // Brighter Green
    if (score >= 1.0) return '#FFDD33'; // More Vivid Yellow
    return '#FF3B30'; // Sharper Red
  };

  // Auto-Scroll Effect
  // Auto-Scroll Logic
  const performScroll = () => {
    if (stats && stats.length > 0 && scrollViewRef.current && !hasScrolledRef.current) {
      const offset = currentBucketIndex * STEP_SIZE;
      // Android needs a slight delay or relies on content size change
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: offset, animated: true });
        hasScrolledRef.current = true;
      }, 100);
    }
  };

  // Trigger scroll when loading finishes and we have data
  useEffect(() => {
    if (!isLoading && stats.length > 0) {
      // Reset scroll flag if the route changed significantly (optional logic)
      // For now, we trust onContentSizeChange to handle the initial scroll
    }
  }, [isLoading, stats]);

  // If loading AND no data, show full loading state.
  // If loading BUT we have data (refreshing), show chart with spinner overlay.
  const showFullLoading = isLoading && (!stats || stats.length === 0);
  
  if (showFullLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.loadingText}>Analyzing Trip Pulse...</Text>
      </View>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>No historical data available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.title}>{startName} ➔ {endName}</Text>
          {isLoading && <ActivityIndicator size="small" color="#6F73F8" />}
        </View>
        <Text style={[styles.subtitle, selectedMinute !== null && { color: '#6F73F8', fontWeight: '600' }]}>
          {getLabelText()}
        </Text>
      </View>

      <View style={styles.chartContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          snapToInterval={STEP_SIZE * 6}
          onContentSizeChange={(w, h) => {
             // Reliable scroll trigger for Android
             if (w > 0 && !hasScrolledRef.current) {
                performScroll();
             }
          }}
        >
          {stats.map((point, index) => {
            const normalizedScore = Math.min(point.score, CLAMP_SCORE);
            
            // Height represents Data Volume (Score)
            // Even if 0 (Red), give it 15% height so it's visible as a "Red Bar"
            const heightPercent = Math.max(15, (normalizedScore / CLAMP_SCORE) * 100);
            
            const isNow = index === currentBucketIndex;
            const isHourMarker = (point.minute % 60) === 0;
            const hourLabel = Math.floor(point.minute / 60);
            
            // Interaction State
            const isSelected = selectedMinute === point.minute;
            const isAnySelected = selectedMinute !== null;

            // Visual Logic
            const barColor = getBarColor(point.score, point.isLowConfidence);
            
            // Focus Effect: Dim others
            let opacity = 1;
            if (isAnySelected) {
              opacity = isSelected ? 1 : 0.2; // Dim unselected more aggressively
            } else {
              // If low confidence, native dim
              opacity = point.isLowConfidence ? 0.4 : 1;
            }

            return (
              <TouchableOpacity 
                key={point.minute} 
                style={styles.columnContainer}
                activeOpacity={0.8}
                onPress={() => setSelectedMinute(point.minute === selectedMinute ? null : point.minute)}
              >
                {/* Track Container */}
                <View style={styles.barTrack}>
                  
                  {/* Visual Gray Track & Colored Bar */}
                  <View style={styles.visualTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${heightPercent}%`,
                          backgroundColor: barColor,
                          opacity: opacity,
                          // Add border if selected
                          borderWidth: isSelected ? 2 : 0,
                          borderColor: '#fff',
                        }
                      ]}
                    />
                  </View>

                  {/* Now Indicator (Dot) - Outside visual track to avoid clipping */}
                  {isNow && (
                    <View style={[
                      styles.nowIndicator, 
                      { bottom: `${heightPercent}%`, marginBottom: 4 }
                    ]} />
                  )}
                  
                </View>

                {/* Label Area */}
                <View style={styles.labelContainer}>
                  {isHourMarker && (
                    <Text style={styles.timeLabel}>{hourLabel}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 12,
    marginHorizontal: 20, // [Fix] Increased to align with main UI grid
    backgroundColor: '#1f2627', 
    borderRadius: 20,
    padding: 20,
  },
  header: { marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#9aa6a6', marginTop: 4, fontWeight: '500' },
  
  chartContainer: {
    height: 120, 
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: (Dimensions.get('window').width / 2) - 6,
    alignItems: 'flex-end',
  },
  
  columnContainer: {
    width: 12, 
    height: '100%', 
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginRight: 2, 
  },
  
  // Track area (the vertical lane wrapper)
  barTrack: {
    flex: 1, 
    width: '100%', // Allow full width so dot isn't clipped
    justifyContent: 'flex-end', 
    alignItems: 'center',
  },

  // The actual gray track line
  visualTrack: {
    width: 6,
    height: '100%',
    backgroundColor: '#2b3435',
    borderRadius: 3,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  
  bar: {
    width: '100%', 
    borderRadius: 3,
  },
  
  nowIndicator: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF453A',
    borderWidth: 1.5,
    borderColor: '#1f2627', // Ring matches card bg
    zIndex: 99,
    elevation: 10, // Ensure it sits on top on Android
  },

  labelContainer: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30, 
    marginTop: 4,
  },
  timeLabel: {
    fontSize: 10,
    color: '#6f7a78',
    fontWeight: '600',
    textAlign: 'center',
  },

  loadingText: { textAlign: 'center', color: '#9aa6a6', padding: 20 },
  emptyText: { textAlign: 'center', color: '#9aa6a6', padding: 20, fontStyle: 'italic' },
});