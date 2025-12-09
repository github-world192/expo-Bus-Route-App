import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// 請確認路徑正確指向您存放新版 BusPlannerService.ts 的位置
import { BusPlannerService } from '../components/busPlanner';
import InstallPWA from '../components/InstallPWA';
import NotificationSettings from '../components/NotificationSettings';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';

// 定義 UI 用的介面
interface UIArrival {
  route: string;
  estimatedTime: string;
  key: string;
  rawTime: number; // 用於排序或邏輯判斷
}

export default function StopScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();

  // 使用 useRef 保持 Service 實例
  const plannerRef = useRef(new BusPlannerService());
  // 若 BusPlannerService 的 constructor 是同步載入 JSON，這裡其實可以直接設為 true
  // 但為了保險起見 (或未來改為非同步)，保留 ready 狀態
  const [serviceReady, setServiceReady] = useState(false);

  const [selectedStop, setSelectedStop] = useState<string>(name || '捷運公館站');
  const [arrivals, setArrivals] = useState<UIArrival[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. 初始化 Service
  useEffect(() => {
    // 即使新版 Service 在 constructor 載入資料，保留此結構以便未來擴充
    setServiceReady(true);
  }, []);

  // 2. 請求位置權限 (維持原樣)
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('位置權限被拒絕');
        }
      } catch (error) {
        console.error('請求位置權限錯誤:', error);
      }
    })();
  }, []);

  // 3. 處理路由參數變更
  useEffect(() => {
    if (name && typeof name === 'string') {
      setSelectedStop(name);
    }
  }, [name]);

  // 4. 核心抓取邏輯 (適配新版 API)
  const fetchBusData = useCallback(async (stopName = selectedStop) => {
    if (!stopName || !serviceReady) return;
    
    // 如果不是下拉刷新，則顯示 Loading (避免自動更新時畫面閃爍)
    if (!refreshing) {
        // 只有第一次載入或切換站點時才顯示全屏 Loading
        if (arrivals.length === 0) setLoading(true);
    }

    try {
      console.log(`正在更新站牌: ${stopName}`);
      
      // ★ 呼叫新加入的 getStopArrivals 方法
      const results = await plannerRef.current.getStopArrivals(stopName);

      if (results.length === 0) {
        // 如果原本有資料但這次抓不到 (例如網路錯誤)，保持舊資料或清空視需求而定
        // 這裡選擇清空並顯示提示
        if (loading) setArrivals([]); 
      } else {
        // 轉換資料格式
        const uiArrivals: UIArrival[] = results.map((bus, idx) => ({
          route: bus.route || bus.route_name || '未知', // 相容不同命名
          estimatedTime: bus.time_text || bus.arrivalTimeText,
          rawTime: bus.raw_time ?? bus.rawTime,
          key: `${bus.rid}-${bus.sid}-${idx}`, // 確保 Key 唯一
        }));
        
        setArrivals(uiArrivals);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch (e) {
      console.error('fetchBusData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStop, serviceReady, refreshing, arrivals.length]);

  // 5. 設定自動更新 Timer
  useEffect(() => {
    if (serviceReady) {
      fetchBusData(); // 立即執行一次
      
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        // 自動更新時不觸發 loading 狀態
        fetchBusData();
      }, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedStop, serviceReady]); // 移除 fetchBusData 相依以避免迴圈，或使用 useCallback

  const onRefresh = () => {
    setRefreshing(true);
    fetchBusData(selectedStop);
  };

  // 狀態徽章樣式 (維持原樣)
  const renderBadge = (text: string) => {
    const t = (text || '').toString();
    let style = styles.badgeGray;
    
    if (t.includes('將到') || t.includes('進站') || t === '0') style = styles.badgeRed;
    else if (t.includes('分')) style = styles.badgeBlue;
    else if (t.includes('未發') || t.includes('末班') || t.includes('未營運') || t.includes('更新中')) style = styles.badgeGray;
    
    return (
      <View style={[styles.badgeBase, style]}>
        <Text style={styles.badgeText}>{t}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: UIArrival }) => (
    <TouchableOpacity activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.route}>{item.route}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {renderBadge(item.estimatedTime)}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 搜尋框與按鈕區 */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/search')}>
            <View style={{ pointerEvents: 'none' }}>
              <TextInput
                placeholder="搜尋站牌"
                placeholderTextColor="#bdbdbd"
                style={styles.searchInput}
                editable={false}
                value="" // 搜尋框保持空白，僅作按鈕用途
              />
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.routeButton}
          onPress={() => router.push('/route')}
          activeOpacity={0.8}
        >
          <Text style={styles.routeButtonText}>🗺️ 路線規劃</Text>
        </TouchableOpacity>
      </View>

      {/* 快速路線區 */}
      <View style={styles.quickRouteContainer}>
        <Text style={styles.quickRouteTitle}>快速路線</Text>
        <TouchableOpacity
          style={styles.quickRouteButton}
          onPress={() => router.push('/route?from=師大分部&to=師大')}
          activeOpacity={0.7}
        >
          <Text style={styles.quickRouteFrom}>師大分部</Text>
          <Text style={styles.quickRouteArrow}>→</Text>
          <Text style={styles.quickRouteTo}>師大</Text>
        </TouchableOpacity>
      </View>

      {/* 站牌資訊列 */}
      <View style={styles.directionBar}>
        <Text style={styles.directionBarText} numberOfLines={1}>{selectedStop}</Text>
        {Platform.OS === 'web' && (
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={styles.refreshButton}
          >
            <Text style={styles.refreshButtonText}>
              {refreshing ? '...' : '刷新'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 列表內容 */}
      {loading && !refreshing ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#6F73F8" />
          <Text style={{ color: '#999', marginTop: 8 }}>正在查詢公車動態...</Text>
        </View>
      ) : (
        <FlatList
          data={arrivals}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          ListHeaderComponent={<NotificationSettings />}
          refreshControl={
            Platform.OS !== 'web' ? (
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                tintColor="#fff"
              />
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>目前無公車資訊</Text>
              <Text style={styles.hintText}>
                {serviceReady ? "請確認站名是否正確或網路狀態" : "系統初始化中..."}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}

      {/* 底部資訊 */}
      <View style={styles.footer}>
        <Text style={styles.updateText}>
          最後更新：{lastUpdate || '—'}
        </Text>
      </View>

      <InstallPWA />
      <ServiceWorkerRegister />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#152021', paddingTop: 28 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  searchBox: { flex: 1 },
  searchInput: {
    height: 46,
    borderRadius: 24,
    backgroundColor: '#3a4243',
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
  },
  routeButton: {
    backgroundColor: '#6F73F8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 24,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  quickRouteContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3435',
  },
  quickRouteTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  quickRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2b3435',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
    gap: 6,
  },
  quickRouteFrom: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  quickRouteArrow: {
    color: '#6F73F8',
    fontSize: 12,
    fontWeight: '700',
  },
  quickRouteTo: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  directionBar: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3435',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  directionBarText: { color: '#fff', fontSize: 22, fontWeight: '700', flex: 1 },
  refreshButton: {
    backgroundColor: '#6F73F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
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
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 200 },
  empty: { marginTop: 40, alignItems: 'center' },
  emptyText: { color: '#9aa6a6', fontSize: 18, fontWeight: '700' },
  hintText: { color: '#6d746f', marginTop: 18 },
  footer: { position: 'absolute', bottom: 18, left: 0, right: 0, alignItems: 'center' },
  updateText: { color: '#6f7a78', fontSize: 12 },
});