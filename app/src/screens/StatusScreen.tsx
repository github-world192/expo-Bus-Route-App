import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    GestureResponderEvent,
    PanResponder,
    PanResponderGestureState,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BusPlannerService } from '../../../components/busPlanner';
import { theme } from '../../../constants/app-theme';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const SHEET_HEADER_HEIGHT = 160; // Height of the sheet header (handle + title + tabs)
const MIN_SHEET_HEIGHT = SHEET_HEADER_HEIGHT;
const MAX_SHEET_HEIGHT = screenHeight * 0.85;

interface BusArrival {
    route: string;
    estimatedTime: string;
    key: string;
    rid: string;
    sid: string;
    raw_time: number;
}

interface DirectionGroup {
    destination: string;
    buses: BusArrival[];
}

export default function StatusScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const insets = useSafeAreaInsets();
    const routeParams = route.params as { stopName?: string } | undefined;
    const stopName = routeParams?.stopName || '台北車站 (忠孝)';
    
    const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
    const [directionGroups, setDirectionGroups] = useState<DirectionGroup[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    const horizontalScrollRef = useRef<any>(null);
    const plannerRef = useRef(new BusPlannerService());
    const [serviceReady, setServiceReady] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ===== 地圖 / 定位相關狀態（從 RoutePlanScreen 移植過來，簡化版） =====
    const [region, setRegion] = useState<any | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
    const [mapLoading, setMapLoading] = useState<boolean>(true);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        (async () => {
            try {
                // 先檢查當前權限狀態
                const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
                let finalStatus = currentStatus;

                if (currentStatus !== 'granted') {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    finalStatus = status;
                    setPermissionStatus(status);
                } else {
                    setPermissionStatus('granted');
                }

                // 預設台北市中心
                let lat = 25.0330;
                let lon = 121.5654;

                if (finalStatus === 'granted') {
                    try {
                        const loc = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                        });
                        lat = loc.coords.latitude;
                        lon = loc.coords.longitude;
                        setUserLocation({ lat, lon });
                    } catch (e) {
                        console.warn('獲取位置失敗，使用默認位置:', e);
                    }
                } else {
                    if (finalStatus === 'denied') {
                        setPermissionStatus('denied');
                    }
                }

                setRegion({
                    latitude: lat,
                    longitude: lon,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                });
                setMapLoading(false);
            } catch (e) {
                console.error('位置權限處理錯誤:', e);
                setRegion({
                    latitude: 25.0330,
                    longitude: 121.5654,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                });
                setMapLoading(false);
            }
        })();
    }, []);

    // ===== Bottom Sheet 動畫（原本就有，保留） =====
    const sheetHeight = useRef(new Animated.Value(screenHeight * 0.5)).current;
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                sheetHeight.extractOffset();
            },
            onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
                const newHeight = (sheetHeight as any)._offset - gestureState.dy;
                if (newHeight >= MIN_SHEET_HEIGHT && newHeight <= MAX_SHEET_HEIGHT) {
                    sheetHeight.setValue(-gestureState.dy);
                } else {
                    if (newHeight < MIN_SHEET_HEIGHT) {
                        sheetHeight.setValue(MIN_SHEET_HEIGHT - (sheetHeight as any)._offset);
                    } else if (newHeight > MAX_SHEET_HEIGHT) {
                        sheetHeight.setValue(MAX_SHEET_HEIGHT - (sheetHeight as any)._offset);
                    }
                }
            },
            onPanResponderRelease: () => {
                sheetHeight.flattenOffset();
            },
        })
    ).current;

    const handleTabPress = (index: number) => {
        setActiveTabIndex(index);
        horizontalScrollRef.current?.scrollTo({
            x: index * screenWidth,
            animated: true,
        });
    };

    const handleMomentumScrollEnd = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / screenWidth);
        if (index >= 0 && index < directionGroups.length) {
            setActiveTabIndex(index);
        }
    };

    // 初始化 BusPlannerService
    useEffect(() => {
        const initService = async () => {
            try {
                await plannerRef.current.initialize();
                setServiceReady(true);
            } catch (e) {
                console.error('StatusScreen BusPlanner 初始化失敗:', e);
            }
        };
        initService();
    }, []);

    // 抓取公車資料並按方向分組
    const fetchBusData = async () => {
        try {
            if (!serviceReady) return;
            if (!refreshing) {
                setLoading(true);
            }

            const sids = plannerRef.current.getRepresentativeSids(stopName);
            if (sids.length === 0) {
                console.warn(`查無站牌 ID: ${stopName}`);
                setDirectionGroups([]);
                setLoading(false);
                return;
            }

            // 取得所有公車
            const results = await plannerRef.current.fetchBusesAtSid(sids[0]);
            const allBuses = results.flat();

            // 為每個路線取得詳細資訊以確定方向
            const busesWithDirection: Array<any & { destination: string }> = [];
            const routeDetailCache: { [key: string]: any } = {};

            for (const bus of allBuses) {
                try {
                    let routeDetail = routeDetailCache[bus.rid];
                    if (!routeDetail) {
                        routeDetail = await plannerRef.current.getRouteDetail(bus.rid);
                        routeDetailCache[bus.rid] = routeDetail;
                    }

                    // 取得當前站牌的 SLID
                    const currentSlid = plannerRef.current.getSlidBySid(bus.sid);
                    
                    // 判斷方向並取得終點站
                    let destination = '未知';
                    const goStops = routeDetail.go_stops || [];
                    const backStops = routeDetail.back_stops || [];

                    // 檢查去程
                    const goIndex = goStops.findIndex((s: any) => {
                        const stopSids = plannerRef.current.getSidsByName(s.name);
                        return stopSids.includes(bus.sid);
                    });

                    if (goIndex !== -1 && goStops.length > 0) {
                        destination = goStops[goStops.length - 1]?.name || '未知';
                    } else {
                        // 檢查返程
                        const backIndex = backStops.findIndex((s: any) => {
                            const stopSids = plannerRef.current.getSidsByName(s.name);
                            return stopSids.includes(bus.sid);
                        });
                        if (backIndex !== -1 && backStops.length > 0) {
                            destination = backStops[backStops.length - 1]?.name || '未知';
                        }
                    }

                    busesWithDirection.push({
                        ...bus,
                        destination,
                    });
                } catch (e) {
                    console.warn(`無法取得路線 ${bus.route} 的方向資訊:`, e);
                    busesWithDirection.push({
                        ...bus,
                        destination: '未知',
                    });
                }
            }

            // 按目的地分組
            const grouped: { [key: string]: BusArrival[] } = {};
            busesWithDirection.forEach((bus: any) => {
                if (!grouped[bus.destination]) {
                    grouped[bus.destination] = [];
                }
                grouped[bus.destination].push({
                    route: bus.route,
                    estimatedTime: bus.time_text,
                    key: `${bus.rid}-${bus.sid}-${bus.destination}`,
                    rid: bus.rid,
                    sid: bus.sid,
                    raw_time: bus.raw_time,
                });
            });

            // 轉換為陣列並排序（按到站時間）
            const groups: DirectionGroup[] = Object.keys(grouped).map((dest) => ({
                destination: dest,
                buses: grouped[dest].sort((a, b) => a.raw_time - b.raw_time),
            }));

            // 按第一個公車的到站時間排序各組
            groups.sort((a, b) => {
                const aTime = a.buses[0]?.raw_time || 99999;
                const bTime = b.buses[0]?.raw_time || 99999;
                return aTime - bTime;
            });

            setDirectionGroups(groups);
            if (groups.length > 0 && activeTabIndex >= groups.length) {
                setActiveTabIndex(0);
            }
        } catch (e) {
            console.error('StatusScreen fetchBusData error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Service 準備好後啟動輪詢
    useEffect(() => {
        if (!serviceReady) return;
        fetchBusData();
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(fetchBusData, 30000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [serviceReady, stopName]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchBusData();
    };

    const handleBack = () => navigation.goBack();
    const handleLocate = () => {
        if (userLocation && mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
            mapRef.current.animateToRegion(
                {
                    latitude: userLocation.lat,
                    longitude: userLocation.lon,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                },
                600
            );
        }
    };
    const handleRoutePlan = () => navigation.navigate('RoutePlan' as never);

    const getStatusStyle = (status: string) => {
        if (status === '即將進站' || status === '將到站') {
            return { backgroundColor: '#FF3B30', color: '#FFFFFF' };
        } else if (status.includes('分')) {
            return { backgroundColor: '#5856D6', color: '#FFFFFF' };
        } else {
            return { backgroundColor: '#E5E5EA', color: '#8E8E93' }; // Default/Not departed
        }
    };

    const renderTimeItem = ({ item }: { item: BusArrival }) => {
        const statusStyle = getStatusStyle(item.estimatedTime);
        return (
            <View style={styles.timeItem}>
                <Text style={styles.busName}>{item.route}</Text>
                <View style={[styles.statusPill, { backgroundColor: statusStyle.backgroundColor }]}>
                    <Text style={[styles.statusText, { color: statusStyle.color }]}>
                        {item.estimatedTime || '未發車'}
                    </Text>
                </View>
            </View>
        );
    };

    // ===== 權限被拒絕 / 載入中狀態 =====
    if (permissionStatus === 'denied') {
        return (
            <View style={styles.container}>
                <View style={styles.messageContainer}>
                    <Text style={styles.messageTitle}>📍 需要位置權限</Text>
                    <Text style={styles.messageText}>請在系統設定中允許定位，以查看地圖</Text>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Text style={styles.backButtonText}>返回</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (mapLoading || !region) {
        return (
            <View style={styles.container}>
                <View style={styles.messageContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.messageText}>載入中…</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Layer 0: 真地圖 MapView */}
            <MapView
                ref={mapRef}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                style={styles.layer0}
                initialRegion={region}
                onRegionChangeComplete={(newRegion) => setRegion(newRegion)}
                showsUserLocation={true}
                showsMyLocationButton={false}
                mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
                onMapReady={() => {
                    console.log('Map ready in StatusScreen, region:', region);
                }}
            />

            {/* Layer 1: Floating Buttons */}
            <View style={[styles.layer1, { paddingTop: insets.top }]}>
                {/* Back Button */}
                <TouchableOpacity onPress={handleBack} style={styles.circleButton}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>

                {/* Capsule Button Group */}
                <View style={styles.capsuleContainer}>
                    <TouchableOpacity onPress={handleLocate} style={styles.capsuleButtonTop}>
                        <Ionicons name="navigate" size={20} color="#000000" />
                    </TouchableOpacity>
                    <View style={styles.capsuleDivider} />
                    <TouchableOpacity onPress={handleRoutePlan} style={styles.capsuleButtonBottom}>
                        <MaterialCommunityIcons name="map-marker-path" size={22} color="#000000" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Layer 2: Draggable Sheet */}
            <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
                {/* Drag Handle */}
                <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
                    <View style={styles.dragHandle} />
                </View>

                {/* Sheet Header */}
                <View style={styles.sheetHeader}>
                    <Text style={styles.stopName}>{stopName}</Text>

                    {/* Tabs */}
                    {directionGroups.length > 0 ? (
                        <View style={styles.tabsContainer}>
                            <View style={styles.tabsScrollContainer}>
                                {directionGroups.map((group, index) => (
                                    <TouchableOpacity
                                        key={group.destination}
                                        style={styles.tabItem}
                                        onPress={() => handleTabPress(index)}
                                    >
                                        <Text style={[styles.tabText, activeTabIndex === index && styles.activeTabText]}>
                                            往 {group.destination}
                                        </Text>
                                        {activeTabIndex === index && <View style={styles.activeIndicator} />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        !loading && (
                            <View style={styles.tabsContainer}>
                                <Text style={styles.noDataText}>目前無公車資訊</Text>
                            </View>
                        )
                    )}
                </View>

                {/* Sheet Content */}
                <View style={styles.sheetContent}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.colors.primary} />
                            <Text style={styles.loadingText}>載入公車資訊中…</Text>
                        </View>
                    ) : directionGroups.length > 0 ? (
                        <Animated.ScrollView
                            ref={horizontalScrollRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={handleMomentumScrollEnd}
                        >
                            {directionGroups.map((group) => (
                                <View key={group.destination} style={{ width: screenWidth }}>
                                    <FlatList
                                        data={group.buses}
                                        renderItem={renderTimeItem}
                                        keyExtractor={(item) => item.key}
                                        contentContainerStyle={styles.listContent}
                                        refreshing={refreshing}
                                        onRefresh={onRefresh}
                                    />
                                </View>
                            ))}
                        </Animated.ScrollView>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>目前無公車資訊</Text>
                        </View>
                    )}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    // Layer 0 - Map
    layer0: {
        flex: 1,
        backgroundColor: '#E0E0E0',
    },

    // 載入 / 權限提示
    messageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#EFEFF4',
    },
    messageTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#000',
        marginBottom: 12,
    },
    messageText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
    backButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    // Layer 1
    layer1: {
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    circleButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        marginBottom: 16,
    },
    capsuleContainer: {
        width: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    capsuleButtonTop: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    capsuleButtonBottom: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    capsuleDivider: {
        height: 1,
        backgroundColor: '#EEEEEE',
        width: '80%',
        alignSelf: 'center',
    },

    // Layer 2: Sheet
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 20,
        overflow: 'hidden',
    },
    dragHandleArea: {
        width: '100%',
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#DDDDDD',
        borderRadius: 2,
    },
    sheetHeader: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
        zIndex: 1,
    },
    stopName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginBottom: 16,
        textAlign: 'center',
    },
    tabsContainer: {
        flexDirection: 'row',
    },
    tabsScrollContainer: {
        flexDirection: 'row',
        flex: 1,
    },
    noDataText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        paddingVertical: 12,
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 8,
        color: theme.colors.textSecondary,
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        position: 'relative',
    },
    tabText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
    activeTabText: {
        color: theme.colors.primary,
        fontWeight: 'bold',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        left: '25%',
        width: '50%',
        height: 3,
        backgroundColor: theme.colors.primary,
        borderRadius: 1.5,
    },
    sheetContent: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    listContent: {
        paddingBottom: 20,
    },
    timeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        backgroundColor: '#FFFFFF',
    },
    busName: {
        fontSize: 20,
        fontWeight: '500',
        color: theme.colors.textPrimary,
    },
    statusPill: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 16,
        minWidth: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});
