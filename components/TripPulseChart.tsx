import React, { useEffect, useMemo, useRef } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PulseDataPoint } from '../hooks/useTripStats';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BAR_WIDTH = 6;
const BAR_GAP = 4;
const STEP_SIZE = BAR_WIDTH + BAR_GAP;
const MAX_BAR_HEIGHT = 80;
const LABEL_HEIGHT = 20;
const CHART_TOTAL_HEIGHT = MAX_BAR_HEIGHT + LABEL_HEIGHT + 10; // Extra buffer
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

  // Calculate "Now" Index
  const currentBucketIndex = useMemo(() => {
    const now = new Date();
    const mod = now.getHours() * 60 + now.getMinutes();
    return Math.floor(mod / 5);
  }, []);

  // Auto-Scroll Effect
  useEffect(() => {
    if (!isLoading && stats && stats.length > 0 && scrollViewRef.current) {
      const offset = (currentBucketIndex * STEP_SIZE) - (SCREEN_WIDTH / 2) + (STEP_SIZE / 2);
      // Small delay to ensure layout is ready
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: Math.max(0, offset), animated: true });
      }, 500);
    }
  }, [isLoading, stats, currentBucketIndex]);

  if (isLoading) {
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
        <Text style={styles.title}>{startName} ➔ {endName}</Text>
        <Text style={styles.subtitle}>
          {routeCount > 0 ? `${routeCount} routes • ` : ''}{totalDays} day history
        </Text>
      </View>

      <View style={styles.chartContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          snapToInterval={STEP_SIZE * 6} // Snap every 30 mins roughly
        >
          {stats.map((point, index) => {
            const normalizedScore = Math.min(point.score, CLAMP_SCORE);
            const heightPercent = (normalizedScore / CLAMP_SCORE) * 100;
            
            const isNow = index === currentBucketIndex;
            // Only show labels on the hour (0, 60, 120...)
            const isHourMarker = (point.minute % 60) === 0;
            const hourLabel = Math.floor(point.minute / 60);

            // Dynamic Styling
            const barColor = isNow ? '#FF2D55' : point.isLowConfidence ? '#C7C7CC' : '#007AFF';
            const barHeight = Math.max(6, heightPercent); // Ensure min height for visibility

            return (
              <View key={point.minute} style={styles.columnContainer}>
                {/* Bar Area */}
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${barHeight}%`,
                        backgroundColor: barColor,
                        opacity: point.isLowConfidence && !isNow ? 0.6 : 1,
                      }
                    ]}
                  />
                  {isNow && <View style={styles.nowIndicator} />}
                </View>

                {/* Label Area */}
                <View style={styles.labelContainer}>
                  {isHourMarker && (
                    <Text style={styles.timeLabel}>{hourLabel}</Text>
                  )}
                </View>
              </View>
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
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    // Shadow for Android
    elevation: 3,
  },
  header: { marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '600', color: '#000' },
  subtitle: { fontSize: 13, color: '#8E8E93', marginTop: 4 },
  
  chartContainer: {
    height: CHART_TOTAL_HEIGHT,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: (SCREEN_WIDTH / 2) - STEP_SIZE, // Center start/end
    alignItems: 'flex-end',
  },
  
  // Column Layout
  columnContainer: {
    width: STEP_SIZE,
    height: '100%', 
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  
  // Bar Area
  barTrack: {
    flex: 1, // Takes up remaining height above labels
    width: '100%',
    justifyContent: 'flex-end', // Bars grow from bottom
    alignItems: 'center',
    paddingBottom: 4, // Gap between bar and label
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
    minHeight: BAR_WIDTH, // Ensure a perfect circle at 0 score
  },
  nowIndicator: {
    position: 'absolute',
    top: -6, // Float above the bar
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF2D55',
  },

  // Label Area
  labelContainer: {
    height: LABEL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30, // Wider than STEP_SIZE to allow text overflow centering
  },
  timeLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
    textAlign: 'center',
  },

  loadingText: { textAlign: 'center', color: '#8E8E93', padding: 20 },
  emptyText: { textAlign: 'center', color: '#8E8E93', padding: 20, fontStyle: 'italic' },
});