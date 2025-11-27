import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

import type { BusInfo } from '../components/busPlanner';
import { BusPlannerService } from '../components/busPlanner';
import stopsRaw from '../databases/stops.json';

type StopEntry = { name: string; sid: string; lat: number; lon: number; distance?: number };
const DEFAULT_RADIUS_METERS = 800;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapNative() {
  const [region, setRegion] = useState<any | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [radiusMeters] = useState<number>(DEFAULT_RADIUS_METERS);
  const [showListModal, setShowListModal] = useState<boolean>(false);
  const [currentZoom, setCurrentZoom] = useState<number>(0.012); // 追蹤當前縮放級別
  const [routeInfo, setRouteInfo] = useState<BusInfo[]>([]); // 路線資訊
  const [showRoute, setShowRoute] = useState<boolean>(false); // 是否顯示路線
  const [showRouteMenu, setShowRouteMenu] = useState<boolean>(false); // 是否顯示路線選單
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0); // 選中的路線索引
  const [renderKey, setRenderKey] = useState<number>(0); // 強制重新渲染的 key
  const router = useRouter();
  const plannerRef = useRef(new BusPlannerService());
  const isAnimatingRef = useRef(false); // 防止動畫衝突
  const animationTimeoutRef = useRef<any>(null);

  const stopsList: StopEntry[] = useMemo(() => {
    const out: StopEntry[] = [];
    const raw: any = stopsRaw;
    Object.entries(raw).forEach(([name, obj]: any) => {
      if (!obj || typeof obj !== 'object') return;
      Object.entries(obj).forEach(([sid, coords]: any) => {
        const lat = Number(coords.lat);
        const lon = Number(coords.lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) out.push({ name, sid, lat, lon });
      });
    });
    return out;
  }, []);

  const nearbyStops = useMemo(() => {
    if (!userLocation) return [] as StopEntry[];
    
    // 計算所有站牌的距離
    const stopsWithDistance = stopsList
      .map((s) => ({
        ...s,
        distance: haversineMeters(userLocation.lat, userLocation.lon, s.lat, s.lon)
      }))
      .filter((x) => x.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance);
    
    return stopsWithDistance.slice(0, 200);
  }, [stopsList, userLocation, radiusMeters]);

  // 根據縮放級別過濾要顯示的站牌
  const visibleStops = useMemo(() => {
    // latitudeDelta 越大表示地圖拉得越遠
    const zoomLevel = currentZoom;
    let stopsToShow = nearbyStops;
    
    // 縮放級別 >= 0.021 時，對同站名進行去重
    if (zoomLevel >= 0.021) {
      const seenNames = new Set<string>();
      const uniqueStops: StopEntry[] = [];
      
      for (const stop of nearbyStops) {
        if (!seenNames.has(stop.name)) {
          seenNames.add(stop.name);
          uniqueStops.push(stop);
        }
      }
      stopsToShow = uniqueStops;
    }
    
    // 定義縮放閾值
    if (zoomLevel > 0.1) {
      // 非常遠，不顯示任何站牌
      return [];
    } else if (zoomLevel > 0.05) {
      // 很遠，只顯示最近的 10 個（已去重）
      return stopsToShow.slice(0, 10);
    } else if (zoomLevel > 0.04) {
      // 較遠，顯示 20 個（已去重）
      return stopsToShow.slice(0, 20);
    } else if (zoomLevel >= 0.021) {
      // 中等距離，顯示 30 個（已去重）
      return stopsToShow.slice(0, 30);
    } else if (zoomLevel > 0.015) {
      // 較近，顯示 60 個（不去重，開始顯示同站名）
      return stopsToShow.slice(0, 60);
    } else {
      // 很近，顯示全部（最多 200 個，不去重）
      return stopsToShow;
    }
  }, [nearbyStops, currentZoom]);

  // 去重的站牌列表（用於列表視圖）
  const uniqueNearbyStops = useMemo(() => {
    const seenNames = new Set<string>();
    const unique: StopEntry[] = [];
    
    for (const stop of nearbyStops) {
      if (!seenNames.has(stop.name)) {
        seenNames.add(stop.name);
        unique.push(stop);
      }
    }
    
    return unique.slice(0, 50);
  }, [nearbyStops]);

  // 預處理路線數據，避免在渲染時重複計算
  const processedRoutes = useMemo(() => {
    if (routeInfo.length === 0) return [];
    
    return routeInfo.map((route, index) => {
      const coordinates = route.path_stops
        .filter(stop => stop.geo)
        .map(stop => ({
          latitude: stop.geo!.lat,
          longitude: stop.geo!.lon
        }));
      
      return {
        route,
        index,
        coordinates,
        isValid: coordinates.length >= 2,
        routeKey: `route-${route.route_name}-${route.direction_text}-${index}`
      };
    }).filter(r => r.isValid);
  }, [routeInfo]); // 移除 showRoute 依賴，只依賴 routeInfo

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status);
        if (status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = loc.coords.latitude;
        const lon = loc.coords.longitude;
        setUserLocation({ lat, lon });
        setRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.012, longitudeDelta: 0.012 });
      } catch (e) {
        console.warn('Location error', e);
      }
    })();
  }, []);

  // 初始化 BusPlannerService 並查詢測試路線
  useEffect(() => {
    (async () => {
      try {
        await plannerRef.current.initialize();
        console.log('BusPlannerService 初始化完成');
        
        // 測試：查詢「師大分部」到「師大」的路線
        const routes = await plannerRef.current.plan('師大分部', '師大');
        console.log('找到路線數量:', routes.length);
        if (routes.length > 0) {
          console.log('第一條路線:', routes[0].route_name, routes[0].direction_text);
          setRouteInfo(routes);
        }
      } catch (error) {
        console.error('路線規劃初始化錯誤:', error);
      }
    })();
  }, []);

  // 清理函數
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  // 確保 selectedRouteIndex 始終有效
  useEffect(() => {
    if (routeInfo.length > 0 && selectedRouteIndex >= routeInfo.length) {
      console.log('修正無效的 selectedRouteIndex:', selectedRouteIndex, '-> 0');
      setSelectedRouteIndex(0);
    }
  }, [routeInfo, selectedRouteIndex]);

  // 調試：追蹤 processedRoutes 的變化
  useEffect(() => {
    console.log('processedRoutes 更新:', {
      count: processedRoutes.length,
      showRoute,
      routeInfoLength: routeInfo.length,
      selectedIndex: selectedRouteIndex
    });
  }, [processedRoutes, showRoute, routeInfo.length, selectedRouteIndex]);

  const mapRef = useRef<any>(null);

  // 調整地圖視角以顯示選中的路線
  const fitRouteToMap = (routeIndex: number) => {
    if (!routeInfo[routeIndex] || !mapRef.current) {
      console.warn('fitRouteToMap: 無效的路線索引或 mapRef', routeIndex);
      return;
    }
    
    // 防止動畫衝突
    if (isAnimatingRef.current) {
      console.log('fitRouteToMap: 動畫進行中，跳過');
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      return;
    }
    
    const route = routeInfo[routeIndex];
    const coordinates = route.path_stops
      .filter(stop => stop.geo)
      .map(stop => ({
        latitude: stop.geo!.lat,
        longitude: stop.geo!.lon
      }));
    
    if (coordinates.length === 0) {
      console.warn('fitRouteToMap: 路線沒有有效座標');
      return;
    }
    
    // 計算路線的邊界
    const lats = coordinates.map(c => c.latitude);
    const lons = coordinates.map(c => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    
    // 計算中心點和範圍，並添加一些邊距
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    const latDelta = (maxLat - minLat) * 1.3; // 添加 30% 邊距
    const lonDelta = (maxLon - minLon) * 1.3;
    
    const targetRegion = {
      latitude: centerLat,
      longitude: centerLon,
      latitudeDelta: Math.max(latDelta, 0.01), // 最小縮放級別
      longitudeDelta: Math.max(lonDelta, 0.01),
    };
    
    console.log('fitRouteToMap: 調整視角到路線', routeIndex, route.route_name);
    
    // 使用動畫過渡到新視角
    if (typeof mapRef.current.animateToRegion === 'function') {
      isAnimatingRef.current = true;
      mapRef.current.animateToRegion(targetRegion, 800);
      
      // 動畫結束後重置標記
      animationTimeoutRef.current = setTimeout(() => {
        isAnimatingRef.current = false;
        console.log('fitRouteToMap: 動畫完成');
      }, 850);
    }
  };

  const recenter = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;
      setUserLocation({ lat, lon });

      const targetRegion = {
        latitude: lat,
        longitude: lon,
        latitudeDelta: region?.latitudeDelta ?? 0.012,
        longitudeDelta: region?.longitudeDelta ?? 0.012,
      };

      // 如果 MapView 有 animateToRegion，使用動畫移動；否則回退為直接 setRegion
      if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
        // 500ms 平滑過渡
        mapRef.current.animateToRegion(targetRegion, 500);
      } else {
        setRegion((r: any) => ({ ...(r || {}), ...targetRegion }));
      }
    } catch (e) {
      console.warn('Recenter failed', e);
    }
  };

  const back = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const navigateToStop = (stopName: string) => {
    setShowListModal(false);
    router.push({ pathname: '/stop', params: { name: stopName } });
  };

  if (permissionStatus === 'denied') {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>位置權限未授權，請在系統設定中允許定位。</Text>
      </View>
    );
  }

  if (!region) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>取得位置中…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={(newRegion) => {
          setCurrentZoom(newRegion.latitudeDelta);
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
      >
        {/* 只在未顯示路線時顯示附近站牌 */}
        {!showRoute && visibleStops.map((s) => (
          <Marker 
            key={`${s.sid}-${s.lat}-${s.lon}`} 
            coordinate={{ latitude: s.lat, longitude: s.lon }}
          >
            <Callout onPress={() => navigateToStop(s.name)}>
              <View style={styles.calloutContainer}>
                <View style={styles.calloutTitleRow}>
                  <Text style={styles.calloutTitle}>{s.name}</Text>
                </View>
                <Text style={styles.calloutSubtitle}>點擊查看站牌動態</Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* 繪製路線 - 分兩階段渲染確保選中路線在最上層 */}
        {showRoute && processedRoutes.length > 0 && (
          <React.Fragment key={`routes-${renderKey}`}>
            {/* 第一階段：渲染所有未選中的路線（灰色虛線） */}
            {processedRoutes.map(({ route, index, coordinates, routeKey }) => {
              const isSelected = index === selectedRouteIndex;
              
              // 只渲染未選中的路線
              if (isSelected) return null;

              // 確保座標有效
              if (!coordinates || coordinates.length < 2) {
                console.warn('跳過無效路線:', routeKey, coordinates?.length);
                return null;
              }

              return (
                <Polyline
                  key={`unselected-${routeKey}`}
                  coordinates={coordinates}
                  strokeColor="#888888"
                  strokeWidth={3}
                  lineDashPattern={[10, 5]}
                  lineDashPhase={0}
                  tappable={true}
                  onPress={() => {
                    if (!isAnimatingRef.current) {
                      console.log('切換到路線:', index, route.route_name);
                      setSelectedRouteIndex(index);
                      setRenderKey(prev => prev + 1); // 強制重新渲染
                      requestAnimationFrame(() => {
                        fitRouteToMap(index);
                      });
                    }
                  }}
                />
              );
            })}

            {/* 第二階段：渲染選中的路線（紅色實線）和其站點標記 */}
            {processedRoutes.map(({ route, index, coordinates, routeKey }) => {
              const isSelected = index === selectedRouteIndex;
              
              // 只渲染選中的路線
              if (!isSelected) return null;

              // 確保座標有效
              if (!coordinates || coordinates.length < 2) {
                console.warn('跳過無效的選中路線:', routeKey, coordinates?.length);
                return null;
              }

              return (
                <React.Fragment key={`selected-${routeKey}`}>
                  {/* 選中的路線線條 */}
                  <Polyline
                    key={`polyline-selected-${routeKey}`}
                    coordinates={coordinates}
                    strokeColor="#FF6B6B"
                    strokeWidth={5}
                    lineDashPattern={[0]}
                    tappable={false}
                  />
                  
                  {/* 選中路線的站牌標記 */}
                  {route.path_stops.filter(stop => stop.geo).map((stop, stopIndex) => {
                    const markerKey = `route-stop-${routeKey}-${stop.name}-${stopIndex}`;
                    return (
                      <Marker
                        key={markerKey}
                        coordinate={{
                          latitude: stop.geo!.lat,
                          longitude: stop.geo!.lon
                        }}
                        pinColor={
                          stopIndex === 0 ? "green" :
                          stopIndex === route.path_stops.length - 1 ? "red" :
                          "orange"
                        }
                      >
                        <Callout onPress={() => navigateToStop(stop.name)}>
                          <View style={styles.calloutContainer}>
                            <View style={styles.calloutTitleRow}>
                              <Text style={styles.calloutTitle}>{stop.name}</Text>
                            </View>
                            <Text style={styles.calloutSubtitle}>
                              {stopIndex === 0 ? "起點" : 
                               stopIndex === route.path_stops.length - 1 ? "終點" :
                               `第 ${stopIndex + 1} 站`}
                            </Text>
                          </View>
                        </Callout>
                      </Marker>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        )}
      </MapView>

      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.button} onPress={back}>
          <Text style={styles.buttonText}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={recenter}>
          <Text style={styles.buttonText}>重新定位</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, showRoute && styles.buttonActive]} 
          onPress={() => {
            if (routeInfo.length > 0) {
              if (showRoute) {
                setShowRoute(false);
              } else {
                setShowRoute(true);
                setShowRouteMenu(true);
              }
            }
          }}
          disabled={routeInfo.length === 0}
        >
          <Text style={styles.buttonText}>
            {routeInfo.length === 0 ? '無路線' : showRoute ? '隱藏路線' : '選擇路線'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => setShowListModal(true)}>
          <Text style={styles.buttonText}>附近站牌</Text>
        </TouchableOpacity>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>半徑：{Math.round(radiusMeters)} m</Text>
          <Text style={styles.infoText}>顯示 {visibleStops.length}/{nearbyStops.length} 個站牌</Text>
          {showRoute && routeInfo.length > 0 && (
            <Text style={styles.infoText}>路線: {routeInfo[selectedRouteIndex].route_name} ({routeInfo[selectedRouteIndex].direction_text})</Text>
          )}
        </View>
      </View>

      {/* 路線選單模態 */}
      <Modal
        visible={showRouteMenu}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRouteMenu(false)}
      >
        <View style={styles.routeMenuOverlay}>
          <View style={styles.routeMenuContainer}>
            <View style={styles.routeMenuHeader}>
              <Text style={styles.routeMenuTitle}>選擇路線</Text>
              <TouchableOpacity onPress={() => setShowRouteMenu(false)}>
                <Text style={styles.routeMenuClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={routeInfo}
              keyExtractor={(item, index) => `route-option-${index}`}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.routeMenuItem,
                    index === selectedRouteIndex && styles.routeMenuItemSelected
                  ]}
                  onPress={() => {
                    setSelectedRouteIndex(index);
                    setRenderKey(prev => prev + 1); // 強制重新渲染
                    setShowRouteMenu(false);
                    // 延遲一點點讓選單先關閉，視覺效果更好
                    setTimeout(() => fitRouteToMap(index), 100);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.routeMenuItemContent}>
                    <View style={styles.routeMenuItemHeader}>
                      <Text style={styles.routeMenuItemTitle}>{item.route_name}</Text>
                      <Text style={styles.routeMenuItemDirection}>{item.direction_text}</Text>
                    </View>
                    <Text style={styles.routeMenuItemDetail}>
                      途經 {item.stop_count} 站 · 約 {item.arrival_time_text}
                    </Text>
                    <Text style={styles.routeMenuItemStops} numberOfLines={1}>
                      {item.path_stops[0]?.name} → {item.path_stops[item.path_stops.length - 1]?.name}
                    </Text>
                  </View>
                  {index === selectedRouteIndex && (
                    <Text style={styles.routeMenuItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* 列表模態視圖 */}
      <Modal
        visible={showListModal}
        animationType="slide"
        onRequestClose={() => setShowListModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>附近站牌</Text>
            <Text style={styles.modalSubtitle}>
              半徑 {radiusMeters}m · {uniqueNearbyStops.length} 個站牌
            </Text>
          </View>

          <FlatList
            data={uniqueNearbyStops}
            keyExtractor={(item, index) => `${item.sid}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.stopItem}
                onPress={() => navigateToStop(item.name)}
                activeOpacity={0.7}
              >
                <View style={styles.stopInfo}>
                  <Text style={styles.stopName}>{item.name}</Text>
                  <Text style={styles.stopSid}>站牌 ID: {item.sid}</Text>
                </View>
                <View style={styles.distanceContainer}>
                  <Text style={styles.distanceText}>{Math.round(item.distance || 0)}m</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>附近沒有找到站牌</Text>
              </View>
            }
            contentContainerStyle={uniqueNearbyStops.length === 0 ? styles.emptyList : undefined}
          />

          <TouchableOpacity 
            onPress={() => setShowListModal(false)} 
            style={styles.modalCloseButton}
            activeOpacity={0.7}
          >
            <Text style={styles.modalCloseButtonText}>關閉</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#888', marginTop: 8 },
  controlRow: {
    position: 'absolute',
    top: 16,
    right: 12,
    left: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  button: { backgroundColor: '#6F73F8', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  buttonActive: { backgroundColor: '#FF6B6B' },
  buttonText: { color: '#fff', fontWeight: '700' },
  infoBox: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  infoText: { color: '#fff', fontSize: 12 },
  // 模態視圖樣式
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  stopItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stopSid: {
    fontSize: 13,
    color: '#999',
  },
  distanceContainer: {
    backgroundColor: '#6F73F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  modalCloseButton: {
    backgroundColor: '#6F73F8',
    margin: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  // Callout 樣式
  calloutContainer: {
    minWidth: 4,
    padding: 0,
    borderRadius: 12,
  },
  calloutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  infoIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#6F73F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  calloutSubtitle: {
    fontSize: 12,
    color: '#6F73F8',
    fontWeight: '500',
  },
  // 路線選單樣式
  routeMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  routeMenuContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  routeMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  routeMenuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  routeMenuClose: {
    fontSize: 28,
    color: '#666',
    fontWeight: '300',
  },
  routeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  routeMenuItemSelected: {
    backgroundColor: '#f8f8ff',
  },
  routeMenuItemContent: {
    flex: 1,
  },
  routeMenuItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  routeMenuItemTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginRight: 8,
  },
  routeMenuItemDirection: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  routeMenuItemDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  routeMenuItemStops: {
    fontSize: 12,
    color: '#999',
  },
  routeMenuItemCheck: {
    fontSize: 24,
    color: '#FF6B6B',
    fontWeight: '700',
    marginLeft: 12,
  },
});
