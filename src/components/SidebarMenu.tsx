import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

const { width } = Dimensions.get('window');
export const SIDEBAR_WIDTH = width * 0.75;

interface SidebarMenuProps {
    onNavigate?: () => void;
}

export default function SidebarMenu({ onNavigate }: SidebarMenuProps) {
    const navigation = useNavigation();

    const handleNavigation = (screen: string) => {
        const state = navigation.getState();
        const currentRouteName = state ? state.routes[state.index].name : '';

        if (currentRouteName === screen) {
            if (onNavigate) onNavigate();
            return;
        }

        // if (onNavigate) onNavigate(); // Removed to prevent double animation conflict

        navigation.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: screen }],
            })
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Stop togo</Text>
            </View>

            <View style={styles.menuItems}>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation('Home')}>
                    <Ionicons name="home-outline" size={24} color={theme.colors.textPrimary} />
                    <Text style={styles.menuText}>首頁</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation('StopsNearby')}>
                    <Ionicons name="location-outline" size={24} color={theme.colors.textPrimary} />
                    <Text style={styles.menuText}>附近站牌</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigation('SmartNotification')}>
                    <Ionicons name="notifications-outline" size={24} color={theme.colors.textPrimary} />
                    <Text style={styles.menuText}>乘車時間通知</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5', // Slightly different background to distinguish
        paddingTop: 50,
        paddingHorizontal: 20,
        width: '100%',
    },
    header: {
        marginBottom: 40,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    menuItems: {
        flex: 1,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
    },
    menuText: {
        fontSize: 18,
        marginLeft: 16,
        color: theme.colors.textPrimary,
        fontWeight: '500',
    },
});
