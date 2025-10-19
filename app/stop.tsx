// app/HomeScreen.tsx
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
import { BusArrival, TaipeiBusAPI } from '../components/bus-api';
import stopMapping from '../databases/stop_to_slid.json';

export default function HomeScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>(); // 讀取 ?name=參數
  const stopName = name || '師大分部'; // 預設值

  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<'去' | '回'>('去');
  const apiRef = useRef(new TaipeiBusAPI(stopMapping));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBusData = async () => {
    try {
      // 檢查 stopMapping 是否有該站名
      if (!stopMapping[stopName]) {
        console.warn(`❗ 找不到站牌：「${stopName}」於 stop_to_slid.json`);
        setArrivals([]);
        setLastUpdate('無法識別站牌名稱');
        setLoading(false);
        return;
      }

      const { arrivals, lastUpdate } = await apiRef.current.getStopEstimates(stopName);
      setArrivals(arrivals || []);
      setLastUpdate(lastUpdate || '');
    } catch (error) {
      console.error('🚨 Failed to fetch bus data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBusData();
    intervalRef.current = setInterval(fetchBusData, 30000);
    return () => intervalRef.current && clearInterval(intervalRef.current);
  }, [stopName]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBusData();
  };

  // 篩選方向（去／回）
  const filteredArrivals = arrivals.filter(a => {
    const dir =
      a.direction === 0 ||
      a.direction === '去程' ||
      a.direction === 'Outbound' ||
      (typeof a.direction === 'string' && a.direction.includes('去'))
        ? '去'
        : '回';
    return dir === selectedTab;
  });

  const renderBusItem = ({ item }: { item: BusArrival }) => {
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
        <TouchableOpacity onPress={() => router.push('/')}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{stopName}</Text>
      </View>

      {/* 分頁 */}
      <View style={styles.tabs}>
        {['去', '回'].map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setSelectedTab(tab as '去' | '回')}
            style={[styles.tabItem, selectedTab === tab && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === tab && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 列表 */}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#6F73F8" />
          <Text style={{ color: '#999', marginTop: 8 }}>載入中...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredArrivals}
          renderItem={renderBusItem}
          keyExtractor={(item, idx) => `${item.route}-${idx}`}
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

  tabs: {
    flexDirection: 'row',
    borderBottomColor: '#2b3435',
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#6F73F8',
  },
  tabText: { color: '#aaa', fontSize: 18 },
  tabTextActive: { color: '#fff', fontWeight: '700' },

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
