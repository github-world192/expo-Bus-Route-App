import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import stopsRaw from '../databases/stops.json';

type StopEntry = { name: string; sid: string; lat: number; lon: number; distance: number };
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

export default function Map() {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [radiusMeters] = useState<number>(DEFAULT_RADIUS_METERS);

  const stopsList: StopEntry[] = useMemo(() => {
    const out: StopEntry[] = [];
    const raw: any = stopsRaw;
    Object.entries(raw).forEach(([name, obj]: any) => {
      if (!obj || typeof obj !== 'object') return;
      Object.entries(obj).forEach(([sid, coords]: any) => {
        const lat = Number(coords.lat);
        const lon = Number(coords.lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) out.push({ name, sid, lat, lon, distance: 0 });
      });
    });
    return out;
  }, []);

  const nearbyStops = useMemo(() => {
    if (!userLocation) return [] as StopEntry[];
    
    // 計算所有站牌的距離
    const stopsWithDistance = stopsList
      .map((s) => {
        const d = haversineMeters(userLocation.lat, userLocation.lon, s.lat, s.lon);
        return { ...s, distance: d };
      })
      .filter((x) => x.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance);
    
    // 去重：只保留每個站名最近的那個站牌
    const seenNames = new Set<string>();
    const uniqueStops: StopEntry[] = [];
    
    for (const stop of stopsWithDistance) {
      if (!seenNames.has(stop.name)) {
        seenNames.add(stop.name);
        uniqueStops.push(stop);
      }
    }
    
    // 限制數量
    return uniqueStops.slice(0, 50);
  }, [stopsList, userLocation, radiusMeters]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status);
        if (status !== 'granted') {
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ 
          accuracy: Location.Accuracy.Balanced 
        });
        setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
        setLoading(false);
      } catch (e) {
        console.warn('Location error', e);
        setLoading(false);
      }
    })();
  }, []);

  const onCancel = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const navigateToStop = (stopName: string) => {
    router.push({ pathname: '/stop', params: { name: stopName } });
  };

  if (permissionStatus === 'denied') {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.title}>📍 需要位置權限</Text>
          <Text style={styles.message}>
            請在系統設定中允許定位，以查看附近站牌
          </Text>
          <TouchableOpacity onPress={onCancel} style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <ActivityIndicator size="large" color="#6F73F8" />
          <Text style={styles.hint}>取得位置中…</Text>
        </View>
      </View>
    );
  }

  if (!userLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.title}>❌ 無法取得位置</Text>
          <Text style={styles.message}>請確認已開啟定位服務</Text>
          <TouchableOpacity onPress={onCancel} style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>附近站牌</Text>
        <Text style={styles.headerSubtitle}>
          半徑 {radiusMeters}m · {nearbyStops.length} 個站牌
        </Text>
      </View>

      <FlatList
        data={nearbyStops}
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
              <Text style={styles.distanceText}>{Math.round(item.distance)}m</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>附近沒有找到站牌</Text>
            <Text style={styles.emptyHint}>請嘗試移動到其他位置</Text>
          </View>
        }
        contentContainerStyle={nearbyStops.length === 0 ? styles.emptyList : undefined}
      />

      <TouchableOpacity onPress={onCancel} style={styles.floatingBackButton} activeOpacity={0.7}>
        <Text style={styles.backButtonText}>返回</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 16,
    color: '#333',
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginBottom: 8,
    lineHeight: 26,
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    color: '#999',
    marginTop: 12,
  },
  backButton: {
    backgroundColor: '#6F73F8',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
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
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
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
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
  },
  floatingBackButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    backgroundColor: '#6F73F8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.3)',
    elevation: 6,
  },
});
