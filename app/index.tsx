import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BusArrival, TaipeiBusAPI } from '../components/bus-api';
import stopMapping from '../databases/stop_to_slid.json';

export default function StopScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();

  const apiRef = useRef(new TaipeiBusAPI(stopMapping as Record<string, string>));
  const [selectedStop, setSelectedStop] = useState<string>(name || '師大分部');
  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 載入參數站名
  useEffect(() => {
    if (name && typeof name === 'string') {
      setSelectedStop(name);
    }
  }, [name]);

  // 抓資料
  const fetchBusData = async (stopName = selectedStop) => {
    try {
      if (!stopName) return;
      setLoading(prev => prev && !refreshing);
      const { arrivals: got, lastUpdate: lu } = await apiRef.current.getStopEstimates(stopName);
      setArrivals(got || []);
      setLastUpdate(lu || '');
    } catch (e) {
      console.error('fetchBusData error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 自動更新每 30 秒
  useEffect(() => {
    fetchBusData(selectedStop);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchBusData(selectedStop), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedStop]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBusData(selectedStop);
  };

  // 狀態徽章
  const renderBadge = (text: string) => {
    const t = (text || '').toString();
    let style = styles.badgeGray;
    if (t.includes('將到') || t.includes('進站') || parseInt(t) === 0) style = styles.badgeRed;
    else if (t.includes('分')) style = styles.badgeBlue;
    else if (t.includes('未發') || t.includes('末班') || t.includes('未營運')) style = styles.badgeGray;
    return (
      <View style={[styles.badgeBase, style]}>
        <Text style={styles.badgeText}>{t}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: BusArrival }) => (
    <TouchableOpacity
 
      
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.route}>{item.route}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>{renderBadge(item.estimatedTime)}</View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 搜尋框（點擊導向搜尋頁） */}
      <View style={styles.searchBox}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/search')}>
          <View pointerEvents="none">
            <TextInput
              placeholder="搜尋站牌"
              placeholderTextColor="#bdbdbd"
              style={styles.searchInput}
              editable={false}
              value={selectedStop}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* 站牌標題 */}
      <View style={styles.directionBar}>
        <Text style={styles.directionBarText}>{selectedStop}</Text>
      </View>

      {/* 公車列表 */}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
          <Text style={{ color: '#999', marginTop: 8 }}>載入中...</Text>
        </View>
      ) : (
        <FlatList
          data={arrivals}
          renderItem={renderItem}
          keyExtractor={(item, idx) => `${item.route}-${idx}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>目前無公車資訊</Text>
              <Text style={styles.hintText}>顯示出發站的完整動態</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}

      {/* 更新時間 */}
      <View style={styles.footer}>
        <Text style={styles.updateText}>更新時間：{lastUpdate || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#152021', paddingTop: 28 },
  searchBox: { paddingHorizontal: 20, paddingBottom: 8 },
  searchInput: {
    height: 46,
    borderRadius: 24,
    backgroundColor: '#3a4243',
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
  },
  directionBar: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3435',
  },
  directionBarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#263133',
  },
  route: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  badgeBase: {
    minWidth: 68,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  badgeRed: { backgroundColor: '#E74C3C' },
  badgeBlue: { backgroundColor: '#6F73F8' },
  badgeGray: { backgroundColor: '#7f8686' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { marginTop: 40, alignItems: 'center' },
  emptyText: { color: '#9aa6a6', fontSize: 18, fontWeight: '700' },
  hintText: { color: '#6d746f', marginTop: 18 },
  footer: { position: 'absolute', bottom: 18, left: 0, right: 0, alignItems: 'center' },
  updateText: { color: '#6f7a78', fontSize: 12 },
});
