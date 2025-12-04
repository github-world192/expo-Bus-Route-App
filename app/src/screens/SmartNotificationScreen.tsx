import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, ScrollView, KeyboardAvoidingView, Platform, Modal, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../../../constants/app-theme';
import SidebarLayout, { useSidebar } from '../components/SidebarLayout';
import useLocalNotification from '../../../hooks/useLocalNotification';

function SmartNotificationContent() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { toggleMenu } = useSidebar();

    // 通知功能
    const {
        permission,
        requestPermission,
        scheduleNotification,
        cancelAllNotifications,
        getAllScheduledNotifications,
    } = useLocalNotification();

    // State
    const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [birthday, setBirthday] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isLinked, setIsLinked] = useState(false);
    const [scheduledCount, setScheduledCount] = useState(0);

    // 檢查通知權限狀態
    useEffect(() => {
        setIsNotificationEnabled(permission.granted);
        updateScheduledCount();
    }, [permission.granted]);

    const updateScheduledCount = async () => {
        const notifications = await getAllScheduledNotifications();
        setScheduledCount(notifications.length);
    };

    const toggleSwitch = async () => {
        if (!isNotificationEnabled) {
            // 開啟通知
            const granted = await requestPermission();
            if (granted) {
                setIsNotificationEnabled(true);
                // 發送測試通知
                await scheduleNotification(
                    '通知已啟用 ✅',
                    '您將收到公車到站提醒',
                    2
                );
                Alert.alert('成功', '通知功能已啟用！');
            } else {
                Alert.alert('權限被拒絕', '請在系統設定中允許通知權限');
            }
        } else {
            // 關閉通知 - 取消所有已排程的通知
            await cancelAllNotifications();
            setIsNotificationEnabled(false);
            setScheduledCount(0);
            Alert.alert('已關閉', '所有通知已取消');
        }
        updateScheduledCount();
    };

    const handleTestNotification = async () => {
        if (!permission.granted) {
            Alert.alert('需要權限', '請先啟用通知功能');
            return;
        }

        await scheduleNotification(
            '測試通知 🚌',
            '這是一則測試通知訊息',
            2
        );
        Alert.alert('已發送', '測試通知將在 2 秒後顯示');
    };

    const handleLinkCard = () => {
        if (cardNumber && birthday) {
            // Simulate API call
            setIsLinked(true);
        }
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
            if (event.type === 'set' && selectedDate) {
                setBirthday(selectedDate);
            }
        } else {
            // iOS
            if (selectedDate) {
                setBirthday(selectedDate);
            }
        }
    };

    const showDatepicker = () => {
        if (!isLinked) {
            setShowDatePicker(true);
        }
    };

    const formatDate = (date: Date) => {
        return `${date.getFullYear()} / ${String(date.getMonth() + 1).padStart(2, '0')} / ${String(date.getDate()).padStart(2, '0')}`;
    };

    const renderDatePicker = () => {
        if (!showDatePicker) return null;

        if (Platform.OS === 'ios') {
            return (
                <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showDatePicker}
                    onRequestClose={() => setShowDatePicker(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => {
                                    if (!birthday) setBirthday(new Date());
                                    setShowDatePicker(false);
                                }}>
                                    <Text style={styles.modalDoneText}>完成</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                testID="dateTimePicker"
                                value={birthday || new Date()}
                                mode="date"
                                display="spinner"
                                onChange={onDateChange}
                                maximumDate={new Date()}
                                locale="zh-TW"
                                themeVariant="light"
                            />
                        </View>
                    </View>
                </Modal>
            );
        }

        return (
            <DateTimePicker
                testID="dateTimePicker"
                value={birthday || new Date()}
                mode="date"
                display="default"
                onChange={onDateChange}
                maximumDate={new Date()}
                locale="zh-TW"
            />
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
                    <Ionicons name="menu" size={28} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>乘車時間通知</Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    {/* Section 1: Feature Toggle */}
                    <View style={styles.section}>
                        <View style={styles.toggleRow}>
                            <View style={styles.toggleTextContainer}>
                                <Text style={styles.sectionTitle}>乘車時間通知</Text>
                                <Text style={styles.sectionDescription}>
                                    開啟後，將於通勤時間自動推播公車動態
                                </Text>
                                {isNotificationEnabled && scheduledCount > 0 && (
                                    <Text style={styles.scheduledCountText}>
                                        已排程 {scheduledCount} 個通知
                                    </Text>
                                )}
                            </View>
                            <Switch
                                trackColor={{ false: '#767577', true: '#34C759' }}
                                thumbColor={'#f4f3f4'}
                                ios_backgroundColor="#3e3e3e"
                                onValueChange={toggleSwitch}
                                value={isNotificationEnabled}
                            />
                        </View>
                        {isNotificationEnabled && (
                            <TouchableOpacity
                                style={styles.testButton}
                                onPress={handleTestNotification}
                            >
                                <Text style={styles.testButtonText}>發送測試通知</Text>
                            </TouchableOpacity>
                        )}
                        {permission.denied && (
                            <View style={styles.warningContainer}>
                                <Text style={styles.warningText}>
                                    ⚠️ 通知權限已被拒絕，請在系統設定中重新啟用
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.divider} />

                    {/* Section 2: Transit Card Info */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>連結悠遊卡資料</Text>

                        {/* Input Fields */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>卡號</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="請輸入悠遊卡號"
                                placeholderTextColor="#999"
                                value={cardNumber}
                                onChangeText={setCardNumber}
                                keyboardType="numeric"
                                editable={!isLinked}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>生日</Text>
                            <TouchableOpacity onPress={showDatepicker} disabled={isLinked}>
                                <View style={styles.input}>
                                    <Text style={{ color: birthday ? theme.colors.textPrimary : '#999', fontSize: 16 }}>
                                        {birthday ? formatDate(birthday) : '請輸入使用者生日'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Link Button */}
                        <TouchableOpacity
                            style={[styles.linkButton, isLinked && styles.linkedButton]}
                            onPress={handleLinkCard}
                            disabled={isLinked}
                        >
                            <Text style={[styles.linkButtonText, isLinked && styles.linkedButtonText]}>
                                {isLinked ? '已連結' : '連結票卡'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Date Picker (Modal for iOS, Inline/Dialog for Android) */}
            {renderDatePicker()}
        </View>
    );
}

export default function SmartNotificationScreen() {
    return (
        <SidebarLayout>
            <SmartNotificationContent />
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
    content: {
        padding: 20,
        paddingBottom: 100, // Extra padding for scrolling
    },
    section: {
        marginBottom: 20,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    toggleTextContainer: {
        flex: 1,
        paddingRight: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.textPrimary,
        marginBottom: 4,
    },
    sectionDescription: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        lineHeight: 20,
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 20,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginBottom: 16,
    },
    // Input Styles
    inputContainer: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: theme.colors.textPrimary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F2F2F7',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 16,
        color: theme.colors.textPrimary,
    },
    // Button Styles
    linkButton: {
        backgroundColor: theme.colors.primary, // Blue
        borderRadius: 24,
        paddingVertical: 12,
        paddingHorizontal: 40, // Shorter pill
        alignSelf: 'center',   // Center the button
        alignItems: 'center',
        marginTop: 24,
    },
    linkButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    linkedButton: {
        backgroundColor: '#E5E5EA', // Gray
    },
    linkedButtonText: {
        color: '#8E8E93',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalDoneText: {
        fontSize: 16,
        color: theme.colors.primary,
        fontWeight: '600',
    },
    testButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
        marginTop: 12,
    },
    testButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    scheduledCountText: {
        fontSize: 12,
        color: theme.colors.primary,
        marginTop: 4,
        fontWeight: '500',
    },
    warningContainer: {
        backgroundColor: '#FFF3CD',
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#FFC107',
    },
    warningText: {
        fontSize: 14,
        color: '#856404',
        lineHeight: 20,
    },
});
