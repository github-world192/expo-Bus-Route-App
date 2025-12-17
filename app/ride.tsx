import React, { useEffect, useState } from 'react';
import { View, SafeAreaView, ScrollView, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { TripPulseChart } from '../components/TripPulseChart';
import { useTripStats } from '../hooks/useTripStats';
// useTripIngestion 已不再需要
import { BusPlannerService } from '../components/busPlanner';

// 建立 Singleton Service 實例
const busPlanner = new BusPlannerService();

export default function SearchResultScreen() {
  const { start = "台電宿舍", end = "捷運淡水站" } = useLocalSearchParams<{ start: string, end: string }>();
  const [viewMode, setViewMode] = useState<'weekday' | 'weekend'>('weekday');
  
  // 1. 讀取歷史統計資料
  const { stats, metadata, loading: statsLoading, refreshStats } = useTripStats(start, end);
  
  // 狀態僅用於 UI 顯示，資料邏輯已封裝
  const [isRefreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!start || !end) return;

      try {
        setRefreshing(true);
        console.log(`[Ride] Fetching: ${start} -> ${end}`);

        // Planner 現在會自動在背景處理 Ingestion
        await busPlanner.plan(start, end);
        
        if (!isMounted) return;

        // 雖然 Plan 完成了，但背景寫入可能還在跑。
        // 我們延遲一下再刷新統計圖表，讓剛寫入的資料有機會被讀出來
        setTimeout(() => {
             refreshStats(); 
        }, 1000); 

      } catch (e) {
        console.error("[Ride] Error:", e);
      } finally {
        if (isMounted) setRefreshing(false);
      }
    };

    fetchData();

    return () => { isMounted = false; };
  }, [start, end, refreshStats]);

  // 決定目前的顯示數據
  const currentStats = stats[viewMode] || [];
  const currentMetaDays = viewMode === 'weekday' ? metadata.daysWeekday : metadata.daysWeekend;
  
  // 只要正在攝入且尚未有資料，就顯示 Loading (若已有歷史資料則讓使用者先看)
  const isGlobalLoading = statsLoading || (isRefreshing && currentStats.length === 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, viewMode === 'weekday' && styles.tabActive]} 
            onPress={() => setViewMode('weekday')}
          >
            <Text style={[styles.tabText, viewMode === 'weekday' && styles.tabTextActive]}>Weekday</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, viewMode === 'weekend' && styles.tabActive]} 
            onPress={() => setViewMode('weekend')}
          >
            <Text style={[styles.tabText, viewMode === 'weekend' && styles.tabTextActive]}>Weekend</Text>
          </TouchableOpacity>
        </View>

        {/* Real-time Status Indicator */}
        {isRefreshing && !isGlobalLoading && (
           <View style={styles.syncContainer}>
             <ActivityIndicator size="small" color="#8E8E93" />
             <Text style={styles.syncText}>Updating live traffic...</Text>
           </View>
        )}

        {/* Chart Component */}
        <TripPulseChart 
          startName={start} 
          endName={end} 
          totalDays={currentMetaDays}
          routeCount={metadata.routeCount}
          data={currentStats}
          isLoading={isGlobalLoading}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  scrollContainer: { paddingBottom: 40 },
  
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    margin: 16,
    borderRadius: 8,
    padding: 2,
    height: 36,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: '#8E8E93' },
  tabTextActive: { color: '#000', fontWeight: '600' },

  syncContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6
  },
  syncText: { fontSize: 12, color: '#8E8E93' }
});