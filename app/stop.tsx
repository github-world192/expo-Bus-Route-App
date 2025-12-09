import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// 引入新版 Service
import { BusPlannerService } from '../components/busPlanner';

interface UIArrival {
  route: string;
  estimatedTime: string;
  key: string;
}

export default function StopDetailScreen() {
  const router = useRouter();
  // [修改] 接收 slid 參數
  const { name, slid } = useLocalSearchParams<{ name?: string; slid?: string }>();
  
  const stopName = name || '捷運公館站';

  const [arrivals, setArrivals] = useState<UIArrival[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // 注意：因為 fetchBusesAtSid 不回傳方向，暫時移除 Tabs 的過濾功能
  // const [selectedTab, setSelectedTab] = useState<'去' | '回'>('去');
  
  const plannerRef = useRef(new BusPlannerService());
  const [serviceReady, setServiceReady] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
      // 即使新版 Service 在 constructor 載入資料，保留此結構以便未來擴充
      setServiceReady(true);
    }, []);

  const fetchBusData = async () => {
    try {
      if (!serviceReady) return;
      
      let results: any[] = [];

      // [修改] 優先使用 SLID 查詢
      if (slid) {
        console.log(`正在查詢 SLID: ${slid}`);
        // 呼叫 Service 的新方法
        results = await plannerRef.current.getArrivalsBySlid(slid, stopName);
      } else {
        console.log(`正在查詢站名: ${stopName}`);
        results = await plannerRef.current.getStopArrivals(stopName);
      }

      // 轉換為 UI 所需格式
      const uiArrivals: UIArrival[] = results.map((bus, idx) => ({
          route: bus.route || bus.route_name || '未知',
          estimatedTime: bus.time_text || bus.arrivalTimeText || '更新中',
          key: `${bus.rid}-${idx}` // 注意：若有重複資料可考慮加 random 或更詳細 key
        }));

      setArrivals(uiArrivals);
      setLastUpdate(new Date().toLocaleTimeString());

    } catch (error) {
      console.error('🚨 Failed to fetch bus data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (serviceReady) {
      fetchBusData();
      intervalRef.current = setInterval(fetchBusData, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [stopName, slid, serviceReady]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBusData();
  };

  const renderBusItem = ({ item }: { item: UIArrival }) => {
    const timeText = item.estimatedTime || '未發車';
    let badgeColor = '#7f8686';
    if (timeText.includes('將到') || timeText.includes('進站')) badgeColor = '#E74C3C';
    else if (timeText.includes('分')) badgeColor = '#6F73F8';

    return (
      <View style={styles.row}>
        <Text style={styles.route}>{item.route}</Text>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{timeText}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 上方標題 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{stopName}</Text>
      </View>

      {/* NOTE: 因為新 API fetchBusesAtSid 暫時不提供方向資訊，
        這裡隱藏了原本的「去/回」Tabs，改為顯示所有經過的公車。
      */}
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderText}>所有經過路線</Text>
      </View>

      {/* 列表 */}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#6F73F8" />
          <Text style={{ color: '#999', marginTop: 8 }}>載入中...</Text>
        </View>
      ) : (
        <FlatList
          data={arrivals}
          renderItem={renderBusItem}
          keyExtractor={(item) => item.key}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {lastUpdate === '無法識別站牌名稱'
                  ? '查無此站牌，請確認名稱'
                  : '目前無公車資訊'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#152021', paddingTop: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backArrow: { color: '#fff', fontSize: 26, marginRight: 10 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },

  subHeader: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomColor: '#2b3435',
    borderBottomWidth: 1,
  },
  subHeaderText: { color: '#aaa', fontSize: 14 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#263133',
  },
  route: { color: '#fff', fontSize: 18, fontWeight: '700' },
  badge: {
    borderRadius: 18,
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { marginTop: 40, alignItems: 'center' },
  emptyText: { color: '#9aa6a6', fontSize: 18, fontWeight: '700' },
});