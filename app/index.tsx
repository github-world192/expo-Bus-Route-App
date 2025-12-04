import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// 假設 BusPlannerService 放在 services 資料夾，請依實際位置調整
import { BusPlannerService } from '../components/busPlanner';
import { FavoriteRoute, favoriteRoutesService } from '../components/favoriteRoutes';
import InstallPWA from '../components/InstallPWA';
import NotificationSettings from '../components/NotificationSettings';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';

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
  const intervalRef = useRef<any>(null);

  // 常用路線狀態
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  
  // 長按選單狀態
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [selectedRoute, setSelectedRoute] = useState<FavoriteRoute | null>(null);

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
      loadFavoriteRoutes();
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
        .sort((a, b) => a.raw_time - b.raw_time)
        .map((bus, idx) => ({
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

  // 載入常用路線
  const loadFavoriteRoutes = async () => {
    try {
      const routes = await favoriteRoutesService.getAllRoutes(true);
      setFavoriteRoutes(routes);
      console.log('已載入常用路線:', routes.length, '條');
    } catch (error) {
      console.error('載入常用路線失敗:', error);
    }
  };

  // 長按路線顯示選單
  const handleLongPress = (route: FavoriteRoute) => {
    setSelectedRoute(route);
    setMenuVisible(true);
  };

  // 重新命名路線
  const handleRename = () => {
    setMenuVisible(false);
    if (!selectedRoute) return;

    if (Platform.OS === 'web') {
      const newName = prompt('輸入新名稱（留空則清除自訂名稱）:', selectedRoute.displayName || '');
      if (newName !== null) {
        const trimmedName = newName.trim();
        favoriteRoutesService.updateRoute(
          selectedRoute.fromStop,
          selectedRoute.toStop,
          { displayName: trimmedName === '' ? undefined : trimmedName }
        ).then(() => {
          loadFavoriteRoutes();
        });
      }
    } else {
      Alert.prompt(
        '重新命名',
        '輸入新名稱（留空則清除自訂名稱）',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '確定',
            onPress: (newName?: string) => {
              const trimmedName = (newName || '').trim();
              favoriteRoutesService.updateRoute(
                selectedRoute.fromStop,
                selectedRoute.toStop,
                { displayName: trimmedName === '' ? undefined : trimmedName }
              ).then(() => {
                loadFavoriteRoutes();
              });
            },
          },
        ],
        'plain-text',
        selectedRoute.displayName || ''
      );
    }
  };

  // 切換置頂狀態
  const handleTogglePin = async () => {
    setMenuVisible(false);
    if (!selectedRoute) return;

    await favoriteRoutesService.updateRoute(
      selectedRoute.fromStop,
      selectedRoute.toStop,
      { pinned: !selectedRoute.pinned }
    );
    loadFavoriteRoutes();
  };

  // 刪除路線
  const handleDelete = () => {
    setMenuVisible(false);
    if (!selectedRoute) return;

    const routeName = selectedRoute.displayName || `${selectedRoute.fromStop} → ${selectedRoute.toStop}`;

    if (Platform.OS === 'web') {
      if (confirm(`確定要刪除「${routeName}」嗎？`)) {
        favoriteRoutesService.removeRoute(
          selectedRoute.fromStop,
          selectedRoute.toStop
        ).then(() => {
          loadFavoriteRoutes();
        });
      }
    } else {
      Alert.alert(
        '刪除常用路線',
        `確定要刪除「${routeName}」嗎？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '刪除',
            style: 'destructive',
            onPress: () => {
              favoriteRoutesService.removeRoute(
                selectedRoute.fromStop,
                selectedRoute.toStop
              ).then(() => {
                loadFavoriteRoutes();
              });
            },
          },
        ]
      );
    }
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
      {/* 搜尋框與路線規劃按鈕 */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/search')}>
            <View style={{ pointerEvents: 'none' }}>
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
        <TouchableOpacity 
          style={styles.routeButton}
          onPress={() => router.push('/route')}
          activeOpacity={0.8}
        >
          <Text style={styles.routeButtonText}>🗺️ 路線規劃</Text>
        </TouchableOpacity>
      </View>

      {/* 常用路線快捷按鈕 */}
      {favoriteRoutes.length > 0 && (
        <View style={styles.quickRouteContainer}>
          <Text style={styles.quickRouteTitle}>常用路線</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRouteScrollContent}
          >
            {favoriteRoutes.slice(0, 5).map((route) => (
              <TouchableOpacity
                key={route.id}
                style={styles.quickRouteButton}
                onPress={() => {
                  router.push(`/route?from=${encodeURIComponent(route.fromStop)}&to=${encodeURIComponent(route.toStop)}`);
                  favoriteRoutesService.recordUsage(route.fromStop, route.toStop);
                }}
                onLongPress={() => handleLongPress(route)}
                delayLongPress={Platform.OS === 'web' ? 300 : 500}
                activeOpacity={0.7}
              >
                {route.pinned && <Text style={styles.pinIcon}>📌</Text>}
                {route.displayName ? (
                  <Text style={styles.quickRouteDisplayName}>{route.displayName}</Text>
                ) : (
                  <>
                    <Text style={styles.quickRouteFrom}>{route.fromStop}</Text>
                    <Text style={styles.quickRouteArrow}>→</Text>
                    <Text style={styles.quickRouteTo}>{route.toStop}</Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 通知設定 */}
      {/* 移到 FlatList 的 ListHeaderComponent */}

      {/* 站牌標題與刷新按鈕 */}
      <View style={styles.directionBar}>
        <Text style={styles.directionBarText}>{selectedStop}</Text>
        {Platform.OS === 'web' && (
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={styles.refreshButton}
          >
            <Text style={styles.refreshButtonText}>
              {refreshing ? '更新中...' : '刷新'}
            </Text>
          </TouchableOpacity>
        )}
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
          ListHeaderComponent={<NotificationSettings />}
          refreshControl={
            Platform.OS !== 'web' ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
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

      {/* PWA 安裝提示 */}
      <InstallPWA />
      
      {/* Service Worker 註冊 */}
      <ServiceWorkerRegister />

      {/* 長按選單 Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>
                {selectedRoute?.displayName || `${selectedRoute?.fromStop} → ${selectedRoute?.toStop}`}
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleRename}
            >
              <Text style={styles.menuItemIcon}>✏️</Text>
              <Text style={styles.menuItemText}>重新命名</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleTogglePin}
            >
              <Text style={styles.menuItemIcon}>
                {selectedRoute?.pinned ? '📌' : '📍'}
              </Text>
              <Text style={styles.menuItemText}>
                {selectedRoute?.pinned ? '取消置頂' : '置頂'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={handleDelete}
            >
              <Text style={styles.menuItemIcon}>🗑️</Text>
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>刪除</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuCancelButton}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.menuCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3435',
  },
  quickRouteTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    paddingHorizontal: 20,
  },
  quickRouteScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  quickRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2b3435',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  pinIcon: {
    fontSize: 10,
    marginRight: -2,
  },
  quickRouteDisplayName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
  directionBarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  refreshButton: {
    backgroundColor: '#6F73F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { marginTop: 40, alignItems: 'center' },
  emptyText: { color: '#9aa6a6', fontSize: 18, fontWeight: '700' },
  hintText: { color: '#6d746f', marginTop: 18 },
  footer: { position: 'absolute', bottom: 18, left: 0, right: 0, alignItems: 'center' },
  updateText: { color: '#6f7a78', fontSize: 12 },
  // 選單樣式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#1f2627',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  menuHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3435',
  },
  menuTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  menuItemIcon: {
    fontSize: 20,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: '#2b3435',
  },
  menuItemTextDanger: {
    color: '#E74C3C',
  },
  menuCancelButton: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    backgroundColor: '#2b3435',
    borderRadius: 12,
    alignItems: 'center',
  },
  menuCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});