import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Animated, PanResponder, FlatList, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

const { height: screenHeight } = Dimensions.get('window');
const SHEET_HEADER_HEIGHT = 160; // Height of the sheet header (handle + title + tabs)
const MIN_SHEET_HEIGHT = SHEET_HEADER_HEIGHT;
const MAX_SHEET_HEIGHT = screenHeight * 0.85;

// Mock Data for Stop Times
const MOCK_TIMES_GO = Array.from({ length: 15 }, (_, i) => ({
    id: `go-${i}`,
    time: `${10 + i}:00`,
    status: i === 0 ? '即將進站' : `${i * 5} 分`,
    bus: '307',
}));

const MOCK_TIMES_BACK = Array.from({ length: 15 }, (_, i) => ({
    id: `back-${i}`,
    time: `${11 + i}:30`,
    status: `${10 + i * 8} 分`,
    bus: '307',
}));

export default function StatusScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<'go' | 'back'>('go');

    const horizontalScrollRef = useRef<ScrollView>(null);
    const { width: screenWidth } = Dimensions.get('window');

    const handleTabPress = (tab: 'go' | 'back') => {
        setActiveTab(tab);
        horizontalScrollRef.current?.scrollTo({
            x: tab === 'go' ? 0 : screenWidth,
            animated: true
        });
    };

    const handleMomentumScrollEnd = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / screenWidth);
        setActiveTab(index === 0 ? 'go' : 'back');
    };

    // Sheet Animation
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

    const handleBack = () => navigation.goBack();
    const handleLocate = () => console.log('Locate pressed');
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
            {/* Layer 0: Map Placeholder */}
            <ScrollView style={styles.layer0} contentContainerStyle={styles.mapContent}>
                <View style={styles.mapGrid}>
                    <Text style={styles.mapText}>Map Area</Text>
                </View>
            </ScrollView>

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

                {/* Sheet Header (Layer 1 of Sheet) */}
                <View style={styles.sheetHeader}>
                    <Text style={styles.stopName}>台北車站 (忠孝)</Text>

                    {/* Tabs */}
                    <View style={styles.tabsContainer}>
                        <TouchableOpacity
                            style={styles.tabItem}
                            onPress={() => handleTabPress('go')}
                        >
                            <Text style={[styles.tabText, activeTab === 'go' && styles.activeTabText]}>
                                往 板橋
                            </Text>
                            {activeTab === 'go' && <View style={styles.activeIndicator} />}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.tabItem}
                            onPress={() => handleTabPress('back')}
                        >
                            <Text style={[styles.tabText, activeTab === 'back' && styles.activeTabText]}>
                                往 南港
                            </Text>
                            {activeTab === 'back' && <View style={styles.activeIndicator} />}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Sheet Content (Layer 0 of Sheet) */}
                <View style={styles.sheetContent}>
                    <ScrollView
                        ref={horizontalScrollRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={handleMomentumScrollEnd}
                    >
                        <View style={{ width: screenWidth }}>
                            <FlatList
                                data={MOCK_TIMES_GO}
                                renderItem={renderTimeItem}
                                keyExtractor={(item: any) => item.id}
                                contentContainerStyle={styles.listContent}
                            />
                        </View>
                        <View style={{ width: screenWidth }}>
                            <FlatList
                                data={MOCK_TIMES_BACK}
                                renderItem={renderTimeItem}
                                keyExtractor={(item: any) => item.id}
                                contentContainerStyle={styles.listContent}
                            />
                        </View>
                    </ScrollView>
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
    // Layer 0
    layer0: {
        flex: 1,
        backgroundColor: '#E0E0E0', // Placeholder map color
    },
    mapContent: {
        height: 1000,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapGrid: {
        width: '100%',
        height: '100%',
        borderWidth: 1,
        borderColor: '#CCCCCC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapText: {
        color: '#888888',
    },

    // Layer 1
    layer1: {
        position: 'absolute',
        top: 0,
        left: 16,
        zIndex: 10,
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
        backgroundColor: '#FFFFFF', // White background
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
        backgroundColor: '#EEEEEE', // Darker divider for white background
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
        height: 32, // Increased from 24
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
        zIndex: 1, // Ensure header stays on top of list
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
        left: '25%', // Center the indicator (approx)
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
