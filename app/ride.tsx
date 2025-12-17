import React, { useEffect, useState } from 'react';
import { View, SafeAreaView, ScrollView, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { TripPulseChart } from '../components/TripPulseChart';
import { useTripStats } from '../hooks/useTripStats';
// useTripIngestion 已不再需要
import { BusPlannerService } from '../components/busPlanner';
import { FavoriteRoute, favoriteRoutesService } from '../components/favoriteRoutes';

// 建立 Singleton Service 實例
const busPlanner = new BusPlannerService();

export default function SearchResultScreen() {
  const params = useLocalSearchParams<{ start: string, end: string }>();
  
  // 管理當前選中的路線 (優先使用參數，否則使用預設值)
  const [currentRoute, setCurrentRoute] = useState({ 
    start: params.start || "師大分部", 
    end: params.end || "師大" 
  });
  
  // 從 State 解構出 start 和 end 供後續 Hooks 使用
  const { start, end } = currentRoute;

  const [viewMode, setViewMode] = useState<'weekday' | 'weekend'>('weekday');
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);

  // 載入常用路線
  useEffect(() => {
    favoriteRoutesService.getAllRoutes().then(setFavoriteRoutes);
  }, []);

  // 如果 URL 參數改變 (例如從外部連結進入)，同步更新 State
  useEffect(() => {
    if (params.start && params.end) {
      setCurrentRoute({ start: params.start, end: params.end });
    }
  }, [params.start, params.end]);

  // 1. 讀取歷史統計資料 (依賴 State 中的 start/end)
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
  const isGlobalLoading = statsLoading || isRefreshing;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {/* Favorite Routes Selector */}
        {favoriteRoutes.length > 0 && (
          <View style={styles.quickRouteContainer}>
            <Text style={styles.sectionTitle}>Favorite Routes</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickRouteScrollContent}
            >
              {favoriteRoutes.map((route, index) => {
                const isActive = route.fromStop === start && route.toStop === end;
                return (
                  <TouchableOpacity
                    key={route.id || index}
                    style={[styles.quickRouteButton, isActive && styles.quickRouteButtonActive]}
                    onPress={() => setCurrentRoute({ start: route.fromStop, end: route.toStop })}
                  >
                    {route.pinned && <Text style={styles.pinIcon}>📌</Text>}
                    {route.displayName ? (
                      <Text style={[styles.quickRouteText, isActive && styles.quickRouteTextActive]}>
                        {route.displayName}
                      </Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                         <Text style={[styles.quickRouteText, isActive && styles.quickRouteTextActive]}>
                           {route.fromStop}
                         </Text>
                         <Text style={[styles.quickRouteArrow, isActive && styles.quickRouteTextActive]}>→</Text>
                         <Text style={[styles.quickRouteText, isActive && styles.quickRouteTextActive]}>
                           {route.toStop}
                         </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, viewMode === 'weekday' && styles.tabActive]} 
            onPress={() => setViewMode('weekday')}
          >
            <Text style={[styles.tabText, viewMode === 'weekday' && styles.tabTextActive]}>
              Weekday
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, viewMode === 'weekend' && styles.tabActive]} 
            onPress={() => setViewMode('weekend')}
          >
            <Text style={[styles.tabText, viewMode === 'weekend' && styles.tabTextActive]}>
              Weekend
            </Text>
          </TouchableOpacity>
        </View>

        {/* Chart Component */}

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
  // [Fix] Restore status bar padding to prevent overlap (matching index.tsx)
  container: { 
    flex: 1, 
    backgroundColor: '#152021', 
    paddingTop: Platform.OS === 'ios' ? 50 : 28 
  },
  scrollContainer: { paddingBottom: 40 },
  
  // Tab Switcher (Styled like iOS Segmented Control but Dark)
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2b3435',
    marginHorizontal: 20, // [Fix] Align with other elements (was 16)
    marginTop: 16,
    marginBottom: 16,
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
    backgroundColor: '#3a4243', // Slightly lighter than bg
  },
  tabText: { fontSize: 13, fontWeight: '500', color: '#6f7a78' },
  tabTextActive: { color: '#fff', fontWeight: '600' },

  // Favorites Section Styles
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginLeft: 20,
    marginBottom: 8,
    marginTop: 12,
  },
  quickRouteContainer: {
    marginBottom: 12,
  },
  quickRouteScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  quickRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2b3435', // Dark card bg
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 0, // Removed border for cleaner dark look
  },
  quickRouteButtonActive: {
    backgroundColor: '#6F73F8', // Theme Accent Color
  },
  quickRouteText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  quickRouteTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  quickRouteArrow: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 4,
  },
  pinIcon: {
    fontSize: 10,
    marginRight: -2,
  },

  syncContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6
  },
  syncText: { fontSize: 12, color: '#6f7a78' }
});