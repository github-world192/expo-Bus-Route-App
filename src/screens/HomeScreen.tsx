
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import SidebarLayout, { useSidebar } from '../components/SidebarLayout';

const { width } = Dimensions.get('window');

// Mock data for routes
const MOCK_ROUTES = [
    { id: '1', name: '師大分部 → 師大' },
    { id: '2', name: '捷運公館站 → 臺大醫院' },
    { id: '3', name: '台北車站 → 陽明山' },
];

// Mock Data for Stop Times (Synced with StatusScreen)
const MOCK_TIMES = Array.from({ length: 15 }, (_, i) => ({
    id: `stop - ${i} `,
    time: `${10 + i}:00`,
    status: i === 0 ? '即將進站' : `${i * 5} 分`,
    bus: '307',
}));

function HomeScreenContent() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { toggleMenu } = useSidebar();
    const [activeTab, setActiveTab] = useState(MOCK_ROUTES[0].id);
    const flatListRef = useRef<FlatList>(null);
    const tabsScrollViewRef = useRef<ScrollView>(null);
    const tabMeasurements = useRef<{ [key: string]: { x: number, width: number } }>({});

    // Scroll tabs to center active tab
    useEffect(() => {
        const measure = tabMeasurements.current[activeTab];
        if (measure) {
            // Estimate ScrollView width (Screen width - Add Button width approx 64)
            const scrollViewWidth = width - 64;
            const scrollX = measure.x - (scrollViewWidth / 2) + (measure.width / 2);
            tabsScrollViewRef.current?.scrollTo({ x: scrollX, animated: true });
        }
    }, [activeTab]);

    // Sync Tab selection with Horizontal Scroll
    const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / width);
        const route = MOCK_ROUTES[index];
        if (route && route.id !== activeTab) {
            setActiveTab(route.id);
        }
    };

    // Sync Scroll with Tab selection
    const onTabPress = (index: number, routeId: string) => {
        setActiveTab(routeId);
        flatListRef.current?.scrollToIndex({ index, animated: true });
    };

    // Calculate top padding for Layer 0 content based on Layer 1 height + Insets
    // Layer 1 content height approx: 50 (TopBar) + 50 (Tabs) + 10 (Padding) = 110
    // Plus insets.top
    const contentPaddingTop = 120 + insets.top;

    const handleSearchPress = () => {
        navigation.navigate('Search' as never);
    };

    const getStatusStyle = (status: string) => {
        if (status === '即將進站' || status === '將到站') {
            return { backgroundColor: '#FF3B30', color: '#FFFFFF' };
        } else if (status.includes('分')) {
            return { backgroundColor: '#5856D6', color: '#FFFFFF' };
        } else {
            return { backgroundColor: '#E5E5EA', color: '#8E8E93' }; // Default/Not departed
        }
    };

    const renderTimeItem = ({ item }: { item: any }) => {
        const statusStyle = getStatusStyle(item.status);
        return (
            <View style={styles.timeItem}>
                <Text style={styles.busName}>{item.bus}</Text>
                <View style={[styles.statusPill, { backgroundColor: statusStyle.backgroundColor }]}>
                    <Text style={[styles.statusText, { color: statusStyle.color }]}>
                        {item.status}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Layer 1: Top Layer (Controls) */}
            <View style={[styles.layer1, { paddingTop: insets.top }]}>
                {/* Top Bar: Menu + Search */}
                <View style={styles.topBar}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={toggleMenu}
                    >
                        <Ionicons name="menu" size={24} color={theme.colors.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.searchBar}
                        onPress={handleSearchPress}
                        activeOpacity={0.9}
                    >
                        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
                        <Text style={styles.searchText}>搜尋站牌</Text>
                    </TouchableOpacity>
                </View>

                {/* Tabs Row */}
                <View style={styles.tabsContainer}>
                    <ScrollView
                        ref={tabsScrollViewRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabsContent}
                        style={styles.tabsScrollView}
                    >
                        {MOCK_ROUTES.map((route, index) => (
                            <TouchableOpacity
                                key={route.id}
                                style={styles.tabItem}
                                onPress={() => onTabPress(index, route.id)}
                                onLayout={(event) => {
                                    const { x, width } = event.nativeEvent.layout;
                                    tabMeasurements.current[route.id] = { x, width };
                                }}
                            >
                                <Text style={[
                                    styles.tabText,
                                    activeTab === route.id && styles.activeTabText
                                ]}>
                                    {route.name}
                                </Text>
                                {activeTab === route.id && <View style={styles.activeIndicator} />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Add Route Button (Fixed to the right) */}
                    <TouchableOpacity
                        style={styles.addRouteButton}
                        onPress={() => navigation.navigate('RoutePlan' as never)}
                    >
                        <Ionicons name="add-circle" size={32} color={theme.colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Layer 0: Bottom Layer (Bus Dynamics) - Horizontal FlatList for Pages */}
            <FlatList
                ref={flatListRef}
                data={MOCK_ROUTES}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                style={styles.layer0}
                renderItem={({ item }) => (
                    <View style={{ width }}>
                        <FlatList
                            data={MOCK_TIMES}
                            renderItem={renderTimeItem}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={[styles.listContent, { paddingTop: contentPaddingTop }]}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                )}
            />

            {/* Floating Button for Full Dynamics */}
            <View style={styles.bottomButtonContainer}>
                <TouchableOpacity
                    style={styles.fullDynamicsButton}
                    onPress={() => {
                        navigation.navigate('Status' as never);
                    }}
                >
                    <Text style={styles.fullDynamicsButtonText}>顯示出發站的完整動態</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function HomeScreen() {
    return (
        <SidebarLayout>
            <HomeScreenContent />
        </SidebarLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    // Layer 0 Styles
    layer0: {
        flex: 1,
        zIndex: 0,
    },
    listContent: {
        paddingBottom: 100, // Space for bottom button
    },
    timeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
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
    bottomButtonContainer: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 2,
    },
    fullDynamicsButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    fullDynamicsButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    // Layer 1 Styles
    layer1: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        zIndex: 1,
        paddingBottom: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    menuButton: {
        marginRight: 12,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.searchBackground,
        height: 40,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchText: {
        color: theme.colors.textSecondary,
        fontSize: 16,
    },
    tabsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    tabsScrollView: {
        flex: 1,
    },
    tabsContent: {
        paddingRight: 16,
        alignItems: 'center',
    },
    tabItem: {
        marginRight: 24,
        paddingVertical: 12,
        position: 'relative',
    },
    tabText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
    activeTabText: {
        color: theme.colors.textPrimary,
        fontWeight: 'bold',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: theme.colors.tabIndicator,
        borderRadius: 1.5,
    },
    addRouteButton: {
        paddingHorizontal: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderLeftWidth: 1,
        borderLeftColor: '#EEEEEE',
        backgroundColor: theme.colors.background,
    },
});
