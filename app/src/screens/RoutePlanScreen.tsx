import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, FlatList, GestureResponderEvent, Keyboard, PanResponder, PanResponderGestureState, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BusInfo } from '../../../components/busPlanner';
import { BusPlannerService } from '../../../components/busPlanner';
import { theme } from '../../../constants/app-theme';
import stopMapRaw from '../../../databases/stop_id_map.json';

const { width, height } = Dimensions.get('window');

// 定義站牌資料結構
interface StopMap {
    by_name: Record<string, string[]>;
}

const stopData = stopMapRaw as StopMap;

export default function RoutePlanScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [departure, setDeparture] = useState('');
    const [destination, setDestination] = useState('');
    
    // 地圖相關狀態
    const [region, setRegion] = useState<any | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    
    // 路線規劃相關狀態
    const plannerRef = useRef(new BusPlannerService());
    const [serviceReady, setServiceReady] = useState(false);
    const [routeInfo, setRouteInfo] = useState<BusInfo[]>([]);
    const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
    const [isPlanningRoute, setIsPlanningRoute] = useState<boolean>(false);
    const mapRef = useRef<any>(null);
    const isAnimatingRef = useRef(false);
    const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // 搜尋相關狀態
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeInput, setActiveInput] = useState<'departure' | 'destination' | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 取得所有站名（用於搜尋）
    const allStops = useMemo(() => Object.keys(stopData.by_name), []);

    // Dynamic Constraints
    const SHEET_HEADER_HEIGHT = 140; // Approx height of handle + inputs
    const MIN_SHEET_HEIGHT = SHEET_HEADER_HEIGHT; // Keep header visible
    const MAX_SHEET_HEIGHT = height - (insets.top + 60); // Below top buttons
    const INITIAL_SHEET_HEIGHT = height * 0.5;

    // Animation for Sheet Height
    const sheetHeight = useRef(new Animated.Value(INITIAL_SHEET_HEIGHT)).current;

    // 預處理路線數據
    const processedRoutes = useMemo(() => {
        if (routeInfo.length === 0) return [];
        
        return routeInfo.map((route, index) => {
            const coordinates = route.path_stops
                .filter((stop: any) => stop.geo)
                .map((stop: any) => ({
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
    }, [routeInfo]);

    // 初始化位置權限和 BusPlannerService
    useEffect(() => {
        (async () => {
            try {
                // 先檢查當前權限狀態
                const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
                console.log('當前位置權限狀態:', currentStatus);
                
                let finalStatus = currentStatus;
                
                // 如果權限未授予，明確請求權限
                if (currentStatus !== 'granted') {
                    console.log('請求位置權限...');
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    finalStatus = status;
                    console.log('位置權限請求結果:', status);
                    setPermissionStatus(status);
                } else {
                    setPermissionStatus('granted');
                }
                
                // 默認使用台北市中心的座標（即使沒有權限也能顯示地圖）
                let lat = 25.0330; // 台北 101 附近
                let lon = 121.5654;
                
                if (finalStatus === 'granted') {
                    try {
                        console.log('獲取當前位置...');
                        const loc = await Location.getCurrentPositionAsync({ 
                            accuracy: Location.Accuracy.Balanced
                        });
                        lat = loc.coords.latitude;
                        lon = loc.coords.longitude;
                        setUserLocation({ lat, lon });
                        console.log('位置獲取成功:', lat, lon);
                    } catch (e) {
                        console.warn('獲取位置失敗，使用默認位置:', e);
                    }
                } else {
                    console.warn('位置權限未授予，使用默認位置（台北）');
                    if (finalStatus === 'denied') {
                        setPermissionStatus('denied');
                    }
                }
                
                // 無論如何都設置 region，這樣地圖就能顯示
                setRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.012, longitudeDelta: 0.012 });
                setLoading(false);
            } catch (e) {
                console.error('位置權限處理錯誤:', e);
                // 即使出錯也設置默認 region
                setRegion({ latitude: 25.0330, longitude: 121.5654, latitudeDelta: 0.012, longitudeDelta: 0.012 });
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        const initService = async () => {
            try {
                await plannerRef.current.initialize();
                setServiceReady(true);
            } catch (error) {
                console.error('BusPlannerService 初始化錯誤:', error);
            }
        };
        initService();
    }, []);

    // 搜尋站牌功能
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const q = searchQuery.trim().toLowerCase();
            if (!q) {
                setSuggestions([]);
                return;
            }
            setSuggestions(allStops.filter(s => s.toLowerCase().includes(q)).slice(0, 20));
        }, 250);
    }, [searchQuery, allStops]);

    // 路線規劃功能
    const planRoute = async () => {
        if (!departure || !destination || !serviceReady) return;
        
        setIsPlanningRoute(true);
        try {
            const routes = await plannerRef.current.plan(departure, destination);
            console.log('找到路線數量:', routes.length);
            if (routes.length > 0) {
                setRouteInfo(routes);
                setSelectedRouteIndex(0);
                // 自動調整地圖視角到第一條路線
                setTimeout(() => fitRouteToMap(0), 500);
            } else {
                setRouteInfo([]);
            }
        } catch (error) {
            console.error('路線規劃錯誤:', error);
            setRouteInfo([]);
        } finally {
            setIsPlanningRoute(false);
        }
    };

    // 當出發地和目的地都輸入時，自動規劃路線
    useEffect(() => {
        if (departure && destination && serviceReady) {
            planRoute();
        } else {
            setRouteInfo([]);
        }
    }, [departure, destination, serviceReady]);

    // 調整地圖視角以顯示選中的路線
    const fitRouteToMap = (routeIndex: number) => {
        if (!routeInfo[routeIndex] || !mapRef.current) {
            return;
        }
        
        if (isAnimatingRef.current) {
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
            return;
        }
        
        const route = routeInfo[routeIndex];
        const coordinates = route.path_stops
            .filter((stop: any) => stop.geo)
            .map((stop: any) => ({
                latitude: stop.geo!.lat,
                longitude: stop.geo!.lon
            }));
        
        if (coordinates.length === 0) return;
        
        const lats = coordinates.map((c: any) => c.latitude);
        const lons = coordinates.map((c: any) => c.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        
        const centerLat = (minLat + maxLat) / 2;
        const centerLon = (minLon + maxLon) / 2;
        const latDelta = (maxLat - minLat) * 1.3;
        const lonDelta = (maxLon - minLon) * 1.3;
        
        const targetRegion = {
            latitude: centerLat,
            longitude: centerLon,
            latitudeDelta: Math.max(latDelta, 0.01),
            longitudeDelta: Math.max(lonDelta, 0.01),
        };
        
        if (typeof mapRef.current.animateToRegion === 'function') {
            isAnimatingRef.current = true;
            mapRef.current.animateToRegion(targetRegion, 800);
            
            animationTimeoutRef.current = setTimeout(() => {
                isAnimatingRef.current = false;
            }, 850);
        }
    };

    const handleInputFocus = (inputType: 'departure' | 'destination') => {
        setActiveInput(inputType);
        setSearchQuery(inputType === 'departure' ? departure : destination);
        Animated.spring(sheetHeight, {
            toValue: MAX_SHEET_HEIGHT,
            useNativeDriver: false,
        }).start();
    };
    
    const handleSelectStop = (stopName: string) => {
        if (activeInput === 'departure') {
            setDeparture(stopName);
        } else if (activeInput === 'destination') {
            setDestination(stopName);
        }
        setSearchQuery('');
        setSuggestions([]);
        setActiveInput(null);
        Keyboard.dismiss();
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                Keyboard.dismiss();
                sheetHeight.extractOffset();
            },
            onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
                // sheetHeight is now relative to the offset (last position)
                // dy is negative for up.
                // We want height to increase when moving up.
                // So delta = -dy.

                // However, we can't easily clamp `Animated.Value` directly without a listener tracking the absolute value.
                // Let's add a listener to track current value for clamping? 
                // Or just use `setOffset` logic carefully.

                // Alternative: Just update a normal variable and call setValue?
                // Let's try the standard direct manipulation.

                const newHeight = (sheetHeight as any)._offset - gestureState.dy;

                if (newHeight >= MIN_SHEET_HEIGHT && newHeight <= MAX_SHEET_HEIGHT) {
                    sheetHeight.setValue(-gestureState.dy);
                } else {
                    // If out of bounds, we can apply resistance or just clamp.
                    // Clamping the *input* to setValue is tricky because of the offset.
                    // Easiest is to just limit the visual, but internal value might drift.

                    // Let's just set it to the limit relative to offset.
                    if (newHeight < MIN_SHEET_HEIGHT) {
                        sheetHeight.setValue(MIN_SHEET_HEIGHT - (sheetHeight as any)._offset);
                    } else if (newHeight > MAX_SHEET_HEIGHT) {
                        sheetHeight.setValue(MAX_SHEET_HEIGHT - (sheetHeight as any)._offset);
                    }
                }
            },
            onPanResponderRelease: () => {
                sheetHeight.flattenOffset(); // Merge offset so next gesture starts clean
                // Optional: Snap logic here
            },
        })
    ).current;

    // Layer 1: Header Actions
    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('Home' as never);
        }
    };
    const handleDone = () => {
        navigation.navigate('Home' as never);
    };

    const renderSearchResult = ({ item }: { item: string }) => (
        <TouchableOpacity 
            style={styles.resultItem}
            onPress={() => handleSelectStop(item)}
        >
            <View style={styles.resultIconContainer}>
                <Ionicons name="location-outline" size={24} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.resultTextContainer}>
                <Text style={styles.resultName}>{item}</Text>
            </View>
        </TouchableOpacity>
    );

    // 路線卡片（像 snack2 一樣）
    const renderRouteCard = ({ item, index }: { item: BusInfo; index: number }) => {
        const isSelected = index === selectedRouteIndex;

        return (
            <TouchableOpacity
                style={[
                    styles.routeCard,
                    isSelected && styles.routeCardSelected
                ]}
                onPress={() => {
                    setSelectedRouteIndex(index);
                    fitRouteToMap(index);
                }}
                activeOpacity={0.7}
            >
                <View style={styles.routeCardHeader}>
                    <View style={styles.routeCardTitleRow}>
                        <Text style={styles.routeCardNumber}>{item.route_name}</Text>
                        <Text style={styles.routeCardDirection}>{item.direction_text}</Text>
                    </View>
                    {isSelected && (
                        <Text style={styles.routeCardCheck}>✓</Text>
                    )}
                </View>

                <View style={styles.routeCardInfo}>
                    <Text style={styles.routeCardTime}>⏱ {item.arrival_time_text}</Text>
                    <Text style={styles.routeCardStops}>🚏 途經 {item.stop_count} 站</Text>
                </View>
            </TouchableOpacity>
        );
    };

    // 清理函數
    useEffect(() => {
        return () => {
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    if (permissionStatus === 'denied') {
        return (
            <View style={styles.container}>
                <View style={styles.messageContainer}>
                    <Text style={styles.messageTitle}>📍 需要位置權限</Text>
                    <Text style={styles.messageText}>
                        請在系統設定中允許定位，以查看地圖
                    </Text>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Text style={styles.backButtonText}>返回</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (loading || !region) {
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
            {/* Layer 0: Map */}
            <MapView
                ref={mapRef}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={region}
                onRegionChangeComplete={(newRegion) => {
                    setRegion(newRegion);
                }}
                showsUserLocation={true}
                showsMyLocationButton={false}
                mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
                onMapReady={() => {
                    console.log('Map is ready, region:', region);
                }}
            >
                {/* 繪製路線 */}
                {processedRoutes.length > 0 && (
                    <>
                        {/* 未選中的路線（灰色虛線） */}
                        {processedRoutes.map(({ route, index, coordinates, routeKey }) => {
                            const isSelected = index === selectedRouteIndex;
                            if (isSelected || !coordinates || coordinates.length < 2) return null;

                            return (
                                <Polyline
                                    key={`unselected-${routeKey}`}
                                    coordinates={coordinates}
                                    strokeColor="#888888"
                                    strokeWidth={3}
                                    lineDashPattern={[10, 5]}
                                    tappable={true}
                                    onPress={() => {
                                        if (!isAnimatingRef.current) {
                                            setSelectedRouteIndex(index);
                                            fitRouteToMap(index);
                                        }
                                    }}
                                />
                            );
                        })}

                        {/* 選中的路線（紅色實線）和站牌標記 */}
                        {processedRoutes.map(({ route, index, coordinates, routeKey }) => {
                            const isSelected = index === selectedRouteIndex;
                            if (!isSelected || !coordinates || coordinates.length < 2) return null;

                            return (
                                <React.Fragment key={`selected-${routeKey}`}>
                                    <Polyline
                                        coordinates={coordinates}
                                        strokeColor="#FF6B6B"
                                        strokeWidth={5}
                                        lineDashPattern={[0]}
                                    />
                                    {route.path_stops.filter((stop: any) => stop.geo).map((stop: any, stopIndex: number) => (
                                        <Marker
                                            key={`route-stop-${routeKey}-${stopIndex}`}
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
                                            <Callout>
                                                <View style={styles.calloutContainer}>
                                                    <Text style={styles.calloutTitle}>{stop.name}</Text>
                                                    <Text style={styles.calloutSubtitle}>
                                                        {stopIndex === 0 ? "起點" : 
                                                         stopIndex === route.path_stops.length - 1 ? "終點" :
                                                         `第 ${stopIndex + 1} 站`}
                                                    </Text>
                </View>
                                            </Callout>
                                        </Marker>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </>
                )}
            </MapView>

            {/* Layer 1: Top Buttons */}
            <View style={[styles.layer1, { paddingTop: insets.top }]}>
                <TouchableOpacity onPress={handleBack} style={styles.circleButton}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDone} style={[styles.circleButton, styles.doneButton]}>
                    <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            {/* Layer 2: Bottom Sheet */}
            <Animated.View style={[styles.layer2, { height: sheetHeight }]}>
                {/* Search Results List */}
                {suggestions.length > 0 && (
                <FlatList
                        data={suggestions}
                    renderItem={renderSearchResult}
                        keyExtractor={(item) => item}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    />
                )}
                
                {/* 路線規劃中指示器 */}
                {isPlanningRoute && (
                    <View style={styles.planningIndicator}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                        <Text style={styles.planningText}>規劃路線中...</Text>
                    </View>
                )}
                
                {/* 路線卡片列表（多條路線） */}
                {routeInfo.length > 0 && !isPlanningRoute && (
                    <>
                        <View style={styles.resultsHeader}>
                            <Text style={styles.resultsTitle}>
                                找到 {routeInfo.length} 條路線
                            </Text>
                        </View>
                        <FlatList
                            data={routeInfo}
                            keyExtractor={(_, index) => `route-${index}`}
                            renderItem={renderRouteCard}
                            contentContainerStyle={styles.routeList}
                            showsVerticalScrollIndicator={false}
                        />
                    </>
                )}

                {/* Floating Input Area with Blur */}
                <BlurView intensity={90} tint="light" style={styles.inputContainerWrapper}>
                    {/* Drag Handle Area - Attach PanResponder here */}
                    <View
                        style={styles.dragHandleContainer}
                        {...panResponder.panHandlers}
                    >
                        <View style={styles.dragHandle} />
                    </View>

                    {/* Inputs */}
                    <View style={styles.inputsContainer}>
                        <View style={styles.inputRow}>
                            <Ionicons name="ellipse-outline" size={12} color={theme.colors.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="出發地"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={activeInput === 'departure' ? searchQuery : departure}
                                onChangeText={(text) => {
                                    if (activeInput === 'departure') {
                                        setSearchQuery(text);
                                    } else {
                                        setDeparture(text);
                                    }
                                }}
                                onFocus={() => handleInputFocus('departure')}
                                onBlur={() => {
                                    if (activeInput === 'departure') {
                                        setActiveInput(null);
                                        setSearchQuery('');
                                        setSuggestions([]);
                                    }
                                }}
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inputRow}>
                            <Ionicons name="location-sharp" size={12} color={theme.colors.primary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="目的地"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={activeInput === 'destination' ? searchQuery : destination}
                                onChangeText={(text) => {
                                    if (activeInput === 'destination') {
                                        setSearchQuery(text);
                                    } else {
                                        setDestination(text);
                                    }
                                }}
                                onFocus={() => handleInputFocus('destination')}
                                onBlur={() => {
                                    if (activeInput === 'destination') {
                                        setActiveInput(null);
                                        setSearchQuery('');
                                        setSuggestions([]);
                                    }
                                }}
                            />
                        </View>
                    </View>
                </BlurView>
            </Animated.View>
        </View>
    );
}

const SHEET_HEADER_HEIGHT = 140; // Approx height of handle + inputs

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EFEFF4',
    },
    // Layer 0 - Map
    map: {
        flex: 1,
    },
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
        left: 0,
        right: 0,
        zIndex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    circleButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    doneButton: {
        backgroundColor: theme.colors.primary,
    },
    // Layer 2
    layer2: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        // height is controlled by Animation
        backgroundColor: '#FFFFFF',
        zIndex: 2,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    inputContainerWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingBottom: 10,
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    dragHandleContainer: {
        alignItems: 'center',
        paddingVertical: 10,
        height: 30, // Increase touch area
        justifyContent: 'center',
    },
    dragHandle: {
        width: 40,
        height: 5,
        backgroundColor: '#C7C7CC',
        borderRadius: 3,
    },
    inputsContainer: {
        marginHorizontal: 16,
        backgroundColor: '#F2F2F7',
        borderRadius: 10,
        paddingVertical: 4,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: 40,
    },
    inputIcon: {
        marginRight: 10,
        width: 20,
        textAlign: 'center',
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
        height: '100%',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E5EA',
        marginLeft: 42,
    },
    // List
    listContent: {
        paddingTop: SHEET_HEADER_HEIGHT,
        paddingBottom: 40,
        backgroundColor: '#FFFFFF',
        minHeight: '100%',
    },
    resultItem: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        alignItems: 'center',
    },
    resultIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F2F2F7',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    resultTextContainer: {
        flex: 1,
    },
    resultName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#000',
    },
    planningIndicator: {
        position: 'absolute',
        top: SHEET_HEADER_HEIGHT + 20,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        zIndex: 5,
    },
    planningText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#666',
    },
    // 路線卡片列表
    resultsHeader: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        backgroundColor: '#fff',
    },
    resultsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    routeList: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 8,
    },
    routeCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#e0e0e0',
    },
    routeCardSelected: {
        borderColor: theme.colors.primary,
        backgroundColor: '#f8f8ff',
    },
    routeCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    routeCardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    routeCardNumber: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    routeCardDirection: {
        fontSize: 12,
        color: '#666',
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    routeCardCheck: {
        fontSize: 24,
        color: theme.colors.primary,
        fontWeight: '700',
    },
    routeCardInfo: {
        flexDirection: 'row',
        gap: 16,
    },
    routeCardTime: {
        fontSize: 13,
        color: '#FF6B6B',
        fontWeight: '600',
    },
    routeCardStops: {
        fontSize: 13,
        color: '#666',
    },
    calloutContainer: {
        minWidth: 120,
        padding: 8,
    },
    calloutTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    calloutSubtitle: {
        fontSize: 12,
        color: '#666',
    },
});
