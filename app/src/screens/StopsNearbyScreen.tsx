import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../constants/app-theme';
import SidebarLayout, { useSidebar } from '../components/SidebarLayout';

// Mock Data for Nearby Stops
const MOCK_NEARBY_STOPS = [
    { id: '1', name: '台北車站 (忠孝)', distance: '50m', routes: '307, 262, 652' },
    { id: '2', name: '捷運台大醫院站', distance: '150m', routes: '20, 222, 651' },
    { id: '3', name: '博物館 (襄陽)', distance: '300m', routes: '20, 222' },
    { id: '4', name: '二二八和平公園', distance: '450m', routes: '18, 20, 222' },
    { id: '5', name: '衡陽路', distance: '600m', routes: '235, 663' },
];

function StopsNearbyContent() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { toggleMenu } = useSidebar();

    const handleStopPress = (stop: any) => {
        // Navigate to StatusScreen, passing stop info (though StatusScreen currently uses mock data)
        navigation.navigate('Status' as never, { stopId: stop.id, stopName: stop.name } as never);
    };

    const renderStopItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.stopItem} onPress={() => handleStopPress(item)}>
            <View style={styles.stopInfo}>
                <Text style={styles.stopName}>{item.name}</Text>
                <Text style={styles.routesText}>{item.routes}</Text>
            </View>
            <View style={styles.distanceContainer}>
                <Ionicons name="location-sharp" size={16} color={theme.colors.primary} />
                <Text style={styles.distanceText}>{item.distance}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
                    <Ionicons name="menu" size={28} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>附近站牌</Text>
            </View>

            {/* List */}
            <FlatList
                data={MOCK_NEARBY_STOPS}
                renderItem={renderStopItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
        </View>
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
        justifyContent: 'flex-start', // Changed from space-between
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
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginLeft: 8, // Added margin
    },
    listContent: {
        paddingVertical: 8,
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
        marginBottom: 4,
    },
    routesText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
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
});
