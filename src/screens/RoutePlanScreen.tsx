import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Dimensions, ScrollView, Animated, PanResponder, GestureResponderEvent, PanResponderGestureState, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { theme } from '../constants/theme';

const { width, height } = Dimensions.get('window');

// Mock Data for Search Results
const MOCK_SEARCH_RESULTS = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    name: `搜尋結果地點 ${i + 1}`,
    address: `台北市某某路 ${i + 1} 號`,
}));

export default function RoutePlanScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [departure, setDeparture] = useState('');
    const [destination, setDestination] = useState('');

    // Dynamic Constraints
    const SHEET_HEADER_HEIGHT = 140; // Approx height of handle + inputs
    const MIN_SHEET_HEIGHT = SHEET_HEADER_HEIGHT; // Keep header visible
    const MAX_SHEET_HEIGHT = height - (insets.top + 60); // Below top buttons
    const INITIAL_SHEET_HEIGHT = height * 0.5;

    // Animation for Sheet Height
    const sheetHeight = useRef(new Animated.Value(INITIAL_SHEET_HEIGHT)).current;

    const handleInputFocus = () => {
        Animated.spring(sheetHeight, {
            toValue: MAX_SHEET_HEIGHT,
            useNativeDriver: false,
        }).start();
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
    const handleBack = () => navigation.goBack();
    const handleDone = () => {
        navigation.navigate('Home' as never);
    };

    const renderSearchResult = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.resultItem}>
            <View style={styles.resultIconContainer}>
                <Ionicons name="location-outline" size={24} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.resultTextContainer}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultAddress}>{item.address}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Layer 0: Map Placeholder (Scrollable) */}
            <ScrollView
                style={styles.layer0}
                contentContainerStyle={styles.mapContent}
                scrollEventThrottle={16}
            >
                <View style={styles.mapGrid}>
                    <Text style={styles.mapText}>Map Area (Scrollable)</Text>
                </View>
            </ScrollView>

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
                <FlatList
                    data={MOCK_SEARCH_RESULTS}
                    renderItem={renderSearchResult}
                    keyExtractor={(item: any) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />

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
                                value={departure}
                                onChangeText={setDeparture}
                                onFocus={handleInputFocus}
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.inputRow}>
                            <Ionicons name="location-sharp" size={12} color={theme.colors.primary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="目的地"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={destination}
                                onChangeText={setDestination}
                                onFocus={handleInputFocus}
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
    // Layer 0
    layer0: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    mapContent: {
        width: width * 1.5,
        height: height * 1.5,
        backgroundColor: '#E1E1E1',
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
        color: '#999999',
        fontSize: 24,
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
        marginBottom: 4,
    },
    resultAddress: {
        fontSize: 14,
        color: '#8E8E93',
    },
});
