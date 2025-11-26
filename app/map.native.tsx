import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import stopsRaw from '../databases/stops.json';

type StopEntry = { name: string; sid: string; lat: number; lon: number };
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
    return stopsList
      .map((s) => ({ s, d: haversineMeters(userLocation.lat, userLocation.lon, s.lat, s.lon) }))
      .filter((x) => x.d <= radiusMeters)
      .sort((a, b) => a.d - b.d)
      .map((x) => x.s)
      .slice(0, 200);
  }, [stopsList, userLocation, radiusMeters]);

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
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        onRegionChangeComplete={(r) => setRegion(r)}
        showsUserLocation={true}
        showsMyLocationButton={true}
        mapType='standard'
      >
        {/* {userLocation && (
          <Marker coordinate={{ latitude: userLocation.lat, longitude: userLocation.lon }} title="你的位置" pinColor="#6F73F8" />
        )} */}

        {nearbyStops.map((s) => (
          <Marker key={`${s.sid}-${s.lat}-${s.lon}`} coordinate={{ latitude: s.lat, longitude: s.lon }} title={s.name} description={`SID: ${s.sid}`} />
        ))}
      </MapView>

      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.button} onPress={recenter}>
          <Text style={styles.buttonText}>重新定位</Text>
        </TouchableOpacity>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>半徑：{Math.round(radiusMeters)} m</Text>
          <Text style={styles.infoText}>顯示 {nearbyStops.length} 個站牌</Text>
        </View>
      </View>
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
  },
  button: { backgroundColor: '#6F73F8', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  infoBox: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  infoText: { color: '#fff', fontSize: 12 },
});
