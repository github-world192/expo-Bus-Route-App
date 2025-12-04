import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../constants/app-theme';

// Mock Data
const MOCK_HISTORY = [
    { id: 'h1', name: '台北車站', address: '台北市中正區' },
    { id: 'h2', name: '市政府', address: '台北市信義區' },
    { id: 'h3', name: '西門町', address: '台北市萬華區' },
];

const MOCK_RESULTS = Array.from({ length: 10 }, (_, i) => ({
    id: `r${i}`,
    name: `搜尋結果 ${i + 1}`,
    address: `測試地址 ${i + 1} 號`,
}));

export default function SearchScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const [searchText, setSearchText] = useState('');
    const [history, setHistory] = useState(MOCK_HISTORY);

    const isSearching = searchText.length > 0;
    const dataToShow = isSearching ? MOCK_RESULTS : history;

    const handleBack = () => navigation.goBack();

    const handleClearHistory = () => {
        setHistory([]);
    };

    const handleItemPress = (item: any) => {
        // Navigate to StatusScreen with stop name
        navigation.navigate('Status' as never, { stopName: item.name } as never);
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.item} onPress={() => handleItemPress(item)}>
            <View style={styles.iconContainer}>
                <Ionicons
                    name={isSearching ? "location-outline" : "time-outline"}
                    size={24}
                    color={theme.colors.textSecondary}
                />
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemAddress}>{item.address}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.searchBarContainer}>
                    <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="搜尋站牌"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={searchText}
                        onChangeText={setSearchText}
                        autoFocus
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {/* Header for History/Results */}
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>
                        {isSearching ? '搜尋結果' : '搜尋紀錄'}
                    </Text>
                    {!isSearching && history.length > 0 && (
                        <TouchableOpacity onPress={handleClearHistory} style={styles.clearButton}>
                            <Text style={styles.clearButtonText}>清除搜尋紀錄</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <FlatList
                    data={dataToShow}
                    renderItem={renderItem}
                    keyExtractor={(item: any) => item.id}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                />
            </View>
        </View>
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
        paddingBottom: 10,
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    searchBarContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 40,
    },
    searchIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
        height: '100%',
    },
    content: {
        flex: 1,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    listTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.textSecondary,
    },
    clearButton: {
        padding: 4,
    },
    clearButtonText: {
        fontSize: 12,
        color: theme.colors.primary,
    },
    listContent: {
        paddingBottom: 20,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F2F2F7',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#000',
        marginBottom: 4,
    },
    itemAddress: {
        fontSize: 14,
        color: '#8E8E93',
    },
});
