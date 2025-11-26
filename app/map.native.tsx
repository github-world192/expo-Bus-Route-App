import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

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
  const router = useRouter();

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

  const mapRef = useRef<any>(null);

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
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={(newRegion) => {
          setCurrentZoom(newRegion.latitudeDelta);
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
      >
        {visibleStops.map((s) => (
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
      </MapView>

      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.button} onPress={back}>
          <Text style={styles.buttonText}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={recenter}>
          <Text style={styles.buttonText}>重新定位</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => setShowListModal(true)}>
          <Text style={styles.buttonText}>附近站牌</Text>
        </TouchableOpacity>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>半徑：{Math.round(radiusMeters)} m</Text>
          <Text style={styles.infoText}>縮放級別：{currentZoom.toFixed(3)}</Text>
          <Text style={styles.infoText}>顯示 {visibleStops.length}/{nearbyStops.length} 個站牌</Text>
        </View>
      </View>

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
    padding: 5,
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
    fontSize: 13,
    color: '#6F73F8',
    fontWeight: '500',
  },
});
