import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import {
    formatDistance,
    getNearbyStopsWithLocation,
    type StopEntry,
} from '../components/locationService';

const DEFAULT_RADIUS_METERS = 800;

export default function Map() {
  const router = useRouter();
  const [nearbyStops, setNearbyStops] = useState<StopEntry[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [radiusMeters] = useState<number>(DEFAULT_RADIUS_METERS);

  useEffect(() => {
    (async () => {
      try {
        const result = await getNearbyStopsWithLocation(radiusMeters, 50);
        
        if (result.success) {
          setNearbyStops(result.stops);
          setPermissionStatus('granted');
        } else {
          setPermissionStatus(result.error === '位置權限被拒絕' ? 'denied' : 'error');
        }
      } catch (e) {
        console.warn('Location error', e);
        setPermissionStatus('error');
      } finally {
        setLoading(false);
      }
    })();
  }, [radiusMeters]);

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

  if (loading) {
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
              <Text style={styles.distanceText}>{formatDistance(item.distance)}</Text>
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
