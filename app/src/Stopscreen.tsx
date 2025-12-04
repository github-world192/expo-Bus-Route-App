import * as Location from 'expo-location';
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
// 假設 BusPlannerService 放在 services 資料夾，請依實際位置調整
import { BusPlannerService } from '../../components/busPlanner';

// 定義 UI 用的介面 (配合新 API 的回傳結構進行適配)
interface UIArrival {
  route: string;
  estimatedTime: string;
  key: string;
}

export default function StopScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();

  // 使用新版 Service
  const plannerRef = useRef(new BusPlannerService());
  const [serviceReady, setServiceReady] = useState(false);

  const [selectedStop, setSelectedStop] = useState<string>(name || '捷運公館站');
  const [arrivals, setArrivals] = useState<UIArrival[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 在應用啟動時請求位置權限
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          console.log('位置權限已授予');
        } else {
          console.log('位置權限被拒絕');
        }
      } catch (error) {
        console.error('請求位置權限時發生錯誤:', error);
      }
    })();
  }, []);

  // 初始化 Service
  useEffect(() => {
    const initService = async () => {
      await plannerRef.current.initialize();
      setServiceReady(true);
    };
    initService();
  }, []);

  // 載入參數站名
  useEffect(() => {
    if (name && typeof name === 'string') {
      setSelectedStop(name);
    }
  }, [name]);
  // 監聽站名或 Service 準備好後開始抓資料
  useEffect(() => {
    if (serviceReady) {
      fetchBusData(selectedStop);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => fetchBusData(selectedStop), 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedStop, serviceReady]);

  // 抓資料核心邏輯 (使用新 API)
  const fetchBusData = async (stopName = selectedStop) => {
    try {
      if (!stopName || !serviceReady) return;
      setLoading(prev => prev && !refreshing);

      // 1. 取得該站名的所有代表性 SID
      const sids = plannerRef.current.getRepresentativeSids(stopName);
      
      if (sids.length === 0) {
        console.warn(`查無站牌 ID: ${stopName}`);
        setArrivals([]);
        setLastUpdate(new Date().toLocaleTimeString());
        return;
      }

      // 2. 平行抓取所有 SID 的公車資料
      console.log('Fetching data for SIDs:', sids[0]);
      const results = await plannerRef.current.fetchBusesAtSid(sids[0]);
      
      // 3. 合併並轉換資料
      const allBuses = results.flat();
      
      // 轉換為 UI 格式並排序 (依據 raw_time，即到站秒數)
      const uiArrivals: UIArrival[] = allBuses
        .sort((a: any, b: any) => a.raw_time - b.raw_time)
        .map((bus: any, idx: number) => ({
          route: bus.route,
          estimatedTime: bus.time_text,
          key: `${bus.rid}-${idx}`, // 確保 key 唯一
        }));

      setArrivals(uiArrivals);
      setLastUpdate(new Date().toLocaleTimeString());

    } catch (e) {
      console.error('fetchBusData error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBusData(selectedStop);
  };

  // 狀態徽章
  const renderBadge = (text: string) => {
    const t = (text || '').toString();
    let style = styles.badgeGray;
    if (t.includes('將到') || t.includes('進站') || t === '0') style = styles.badgeRed;
    else if (t.includes('分')) style = styles.badgeBlue;
    else if (t.includes('未發') || t.includes('末班') || t.includes('未營運')) style = styles.badgeGray;
    
    return (
      <View style={[styles.badgeBase, style]}>
        <Text style={styles.badgeText}>{t}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: UIArrival }) => (
    <TouchableOpacity>
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
      {/* 搜尋框 */}
      <View style={styles.searchBox}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/search')}>
          <View pointerEvents="none">
            <TextInput
              placeholder="搜尋站牌"
              placeholderTextColor="#bdbdbd"
              style={styles.searchInput}
              editable={false}
              value=""
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
          keyExtractor={(item) => item.key}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>目前無公車資訊</Text>
              <Text style={styles.hintText}>或查無此站牌資料</Text>
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