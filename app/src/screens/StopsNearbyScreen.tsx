import * as Location from 'expo-location';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../constants/app-theme';
import SidebarLayout, { useSidebar } from '../components/SidebarLayout';
import stopsRaw from '../../../databases/stops.json';

type StopEntry = { name: string; sid: string; lat: number; lon: number; distance: number };
const DEFAULT_RADIUS_METERS = 800;

// 計算兩點間距離（Haversine 公式）
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000; // 地球半徑（公尺）
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function StopsNearbyContent() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { toggleMenu } = useSidebar();
    
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [radiusMeters] = useState<number>(DEFAULT_RADIUS_METERS);

    // 從 stops.json 載入所有站牌資料
    const stopsList: StopEntry[] = useMemo(() => {
        const out: StopEntry[] = [];
        const raw: any = stopsRaw;
        Object.entries(raw).forEach(([name, obj]: any) => {
            if (!obj || typeof obj !== 'object') return;
            Object.entries(obj).forEach(([sid, coords]: any) => {
                const lat = Number(coords.lat);
                const lon = Number(coords.lon);
                if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                    out.push({ name, sid, lat, lon, distance: 0 });
                }
            });
        });
        return out;
    }, []);

    // 計算附近站牌
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

    // 請求位置權限並取得位置
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

    const handleStopPress = (stop: StopEntry) => {
        (navigation as any).navigate('Status', { stopName: stop.name });
    };

    const renderStopItem = ({ item }: { item: StopEntry }) => (
        <TouchableOpacity style={styles.stopItem} onPress={() => handleStopPress(item)}>
            <View style={styles.stopInfo}>
                <Text style={styles.stopName}>{item.name}</Text>
            </View>
            <View style={styles.distanceContainer}>
                <Ionicons name="location-sharp" size={16} color={theme.colors.primary} />
                <Text style={styles.distanceText}>{Math.round(item.distance)}m</Text>
            </View>
        </TouchableOpacity>
    );

    // 權限被拒絕
    if (permissionStatus === 'denied') {
        return (
            <SidebarLayout>
                <View style={[styles.container, { paddingTop: insets.top }]}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
                            <Ionicons name="menu" size={28} color={theme.colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>附近站牌</Text>
                    </View>
                    <View style={styles.messageContainer}>
                        <Text style={styles.messageTitle}>📍 需要位置權限</Text>
                        <Text style={styles.messageText}>
                            請在系統設定中允許定位，以查看附近站牌
                        </Text>
                    </View>
                </View>
            </SidebarLayout>
        );
    }

    // 載入中
    if (loading) {
        return (
            <SidebarLayout>
                <View style={[styles.container, { paddingTop: insets.top }]}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
                            <Ionicons name="menu" size={28} color={theme.colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>附近站牌</Text>
                    </View>
                    <View style={styles.messageContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={styles.messageText}>取得位置中…</Text>
                    </View>
                </View>
            </SidebarLayout>
        );
    }

    // 無法取得位置
    if (!userLocation) {
        return (
            <SidebarLayout>
                <View style={[styles.container, { paddingTop: insets.top }]}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
                            <Ionicons name="menu" size={28} color={theme.colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>附近站牌</Text>
                    </View>
                    <View style={styles.messageContainer}>
                        <Text style={styles.messageTitle}>❌ 無法取得位置</Text>
                        <Text style={styles.messageText}>請確認已開啟定位服務</Text>
                    </View>
                </View>
            </SidebarLayout>
        );
    }

    return (
        <SidebarLayout>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
                        <Ionicons name="menu" size={28} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>附近站牌</Text>
                        <Text style={styles.headerSubtitle}>
                            半徑 {radiusMeters}m · {nearbyStops.length} 個站牌
                        </Text>
                    </View>
                </View>

                {/* List */}
                <FlatList
                    data={nearbyStops}
                    renderItem={renderStopItem}
                    keyExtractor={(item, index) => `${item.sid}-${index}`}
                    contentContainerStyle={nearbyStops.length === 0 ? styles.emptyList : styles.listContent}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>附近沒有找到站牌</Text>
                            <Text style={styles.emptyHint}>請嘗試移動到其他位置</Text>
                        </View>
                    }
                />
            </View>
        </SidebarLayout>
    );
}

export default function StopsNearbyScreen() {
    return (
        <SidebarLayout>
            <StopsNearbyContent />
        </SidebarLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    menuButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTextContainer: {
        flex: 1,
        marginLeft: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    messageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    messageTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.colors.textPrimary,
        marginBottom: 12,
    },
    messageText: {
        fontSize: 16,
        textAlign: 'center',
        color: theme.colors.textSecondary,
        marginTop: 8,
    },
    listContent: {
        paddingVertical: 8,
    },
    emptyList: {
        flexGrow: 1,
    },
    stopItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    stopInfo: {
        flex: 1,
        marginRight: 16,
    },
    stopName: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.textPrimary,
    },
    distanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    distanceText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.primary,
        marginLeft: 4,
    },
    separator: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginLeft: 20,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        marginBottom: 8,
    },
    emptyHint: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
});
