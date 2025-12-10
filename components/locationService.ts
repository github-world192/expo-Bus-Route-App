/**
 * 定位服務
 * 提供位置獲取和附近站牌計算功能
 */

import * as Location from 'expo-location';
import stopsRaw from '../databases/stops.json';

export interface StopEntry {
  name: string;
  slid: string; // 物理站牌 ID (Stop Location ID)
  lat: number;
  lon: number;
  distance: number;
}

export interface UserLocation {
  lat: number;
  lon: number;
}

/**
 * Haversine 公式計算兩點之間的距離（公尺）
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // 地球半徑（公尺）
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Haversine 公式計算兩點之間的距離（公里）
 */
export function haversineKilometers(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineMeters(lat1, lon1, lat2, lon2) / 1000;
}

/**
 * 載入所有站牌資料
 * 支援兩種資料格式：
 * 1. stops.json: { sid: { name, lat, lon, ... } }
 * 2. stops.json (舊格式): { name: { sid: { lat, lon } } }
 */
export function loadAllStops(): StopEntry[] {
  const out: StopEntry[] = [];
  const raw: any = stopsRaw;
  
  // 檢查資料格式
  const firstKey = Object.keys(raw)[0];
  const firstValue = raw[firstKey];
  
  // 如果第一層有 name 屬性，代表是新格式 { slid: { name, lat, lon } }
  if (firstValue?.name && firstValue?.lat !== undefined) {
    Object.entries(raw).forEach(([slid, data]: any) => {
      const lat = Number(data.lat);
      const lon = Number(data.lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        out.push({ name: data.name, slid, lat, lon, distance: 0 });
      }
    });
  } else {
    // 舊格式 { name: { slid: { lat, lon } } } (stops.json 實際儲存的是 SLID)
    Object.entries(raw).forEach(([name, obj]: any) => {
      if (!obj || typeof obj !== 'object') return;
      Object.entries(obj).forEach(([slid, coords]: any) => {
        const lat = Number(coords.lat);
        const lon = Number(coords.lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          out.push({ name, slid, lat, lon, distance: 0 });
        }
      });
    });
  }
  
  return out;
}

/**
 * 請求位置權限
 */
export async function requestLocationPermission(): Promise<{
  granted: boolean;
  status: string;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return {
      granted: status === 'granted',
      status,
    };
  } catch (error) {
    console.error('請求位置權限失敗:', error);
    return {
      granted: false,
      status: 'error',
    };
  }
}

/**
 * 獲取當前位置
 */
export async function getCurrentLocation(): Promise<UserLocation | null> {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
    };
  } catch (error) {
    console.error('獲取位置失敗:', error);
    return null;
  }
}

/**
 * 計算附近站牌（去重，按站名）
 * @param userLocation 使用者位置
 * @param radiusMeters 搜尋半徑（公尺），預設 800m
 * @param maxResults 最大結果數量，預設 50
 */
export function calculateNearbyStops(
  userLocation: UserLocation,
  radiusMeters: number = 800,
  maxResults: number = 50
): StopEntry[] {
  const allStops = loadAllStops();
  
  // 計算所有站牌的距離
  const stopsWithDistance = allStops
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
  return uniqueStops.slice(0, maxResults);
}

/**
 * 格式化距離顯示
 */
export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

/**
 * 完整的定位流程：請求權限 → 獲取位置 → 計算附近站牌
 */
export async function getNearbyStopsWithLocation(
  radiusMeters: number = 800,
  maxResults: number = 50
): Promise<{
  success: boolean;
  location: UserLocation | null;
  stops: StopEntry[];
  error?: string;
}> {
  // 請求權限
  const permission = await requestLocationPermission();
  if (!permission.granted) {
    return {
      success: false,
      location: null,
      stops: [],
      error: permission.status === 'denied' ? '位置權限被拒絕' : '無法獲取位置權限',
    };
  }
  
  // 獲取位置
  const location = await getCurrentLocation();
  if (!location) {
    return {
      success: false,
      location: null,
      stops: [],
      error: '無法獲取當前位置',
    };
  }
  
  // 計算附近站牌
  const stops = calculateNearbyStops(location, radiusMeters, maxResults);
  
  return {
    success: true,
    location,
    stops,
  };
}
