import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// 動態導入 expo-notifications，避免在未安裝時報錯
let Notifications: any = null;
try {
    Notifications = require('expo-notifications');
} catch (error) {
    console.warn('expo-notifications 未安裝，通知功能將無法使用');
}

// 設定通知處理行為（如果 Notifications 可用）
if (Notifications) {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        }),
    });
}

interface NotificationPermission {
    granted: boolean;
    denied: boolean;
    canAskAgain: boolean;
}

export default function useLocalNotification() {
    const [permission, setPermission] = useState<NotificationPermission>({
        granted: false,
        denied: false,
        canAskAgain: true,
    });
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const notificationListener = useRef<Notifications.Subscription>();
    const responseListener = useRef<Notifications.Subscription>();

    useEffect(() => {
        if (!Notifications) {
            console.warn('expo-notifications 未安裝，通知功能無法使用');
            return;
        }

        // 註冊推送通知 token
        registerForPushNotificationsAsync().then(token => {
            if (token) {
                setExpoPushToken(token);
            }
        });

        // 監聽通知接收
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log('通知已接收:', notification);
        });

        // 監聽通知點擊
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('通知被點擊:', response);
        });

        // 檢查權限狀態
        checkPermissionStatus();

        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, []);

    const checkPermissionStatus = async () => {
        if (!Notifications) return;
        try {
            const { status } = await Notifications.getPermissionsAsync();
            setPermission({
                granted: status === 'granted',
                denied: status === 'denied',
                canAskAgain: status !== 'denied',
            });
        } catch (error) {
            console.error('檢查通知權限失敗:', error);
        }
    };

    const requestPermission = async (): Promise<boolean> => {
        if (!Notifications) {
            console.warn('expo-notifications 未安裝');
            return false;
        }
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            setPermission({
                granted: finalStatus === 'granted',
                denied: finalStatus === 'denied',
                canAskAgain: finalStatus !== 'denied',
            });

            return finalStatus === 'granted';
        } catch (error) {
            console.error('請求通知權限失敗:', error);
            return false;
        }
    };

    const scheduleNotification = async (
        title: string,
        body: string,
        seconds: number,
        data?: any
    ): Promise<string | null> => {
        if (!Notifications) {
            console.warn('expo-notifications 未安裝');
            return null;
        }
        try {
            if (!permission.granted) {
                const granted = await requestPermission();
                if (!granted) {
                    console.warn('通知權限未授予，無法發送通知');
                    return null;
                }
            }

            const identifier = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: data || {},
                    sound: true,
                },
                trigger: {
                    seconds,
                },
            });

            return identifier;
        } catch (error) {
            console.error('排程通知失敗:', error);
            return null;
        }
    };

    const scheduleNotificationAtTime = async (
        title: string,
        body: string,
        date: Date,
        data?: any
    ): Promise<string | null> => {
        if (!Notifications) {
            console.warn('expo-notifications 未安裝');
            return null;
        }
        try {
            if (!permission.granted) {
                const granted = await requestPermission();
                if (!granted) {
                    console.warn('通知權限未授予，無法發送通知');
                    return null;
                }
            }

            const identifier = await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: data || {},
                    sound: true,
                },
                trigger: date,
            });

            return identifier;
        } catch (error) {
            console.error('排程通知失敗:', error);
            return null;
        }
    };

    const cancelNotification = async (identifier: string): Promise<void> => {
        if (!Notifications) return;
        try {
            await Notifications.cancelScheduledNotificationAsync(identifier);
        } catch (error) {
            console.error('取消通知失敗:', error);
        }
    };

    const cancelAllNotifications = async (): Promise<void> => {
        if (!Notifications) return;
        try {
            await Notifications.cancelAllScheduledNotificationsAsync();
        } catch (error) {
            console.error('取消所有通知失敗:', error);
        }
    };

    const getAllScheduledNotifications = async (): Promise<any[]> => {
        if (!Notifications) return [];
        try {
            return await Notifications.getAllScheduledNotificationsAsync();
        } catch (error) {
            console.error('獲取已排程通知失敗:', error);
            return [];
        }
    };

    return {
        permission,
        expoPushToken,
        requestPermission,
        scheduleNotification,
        scheduleNotificationAtTime,
        cancelNotification,
        cancelAllNotifications,
        getAllScheduledNotifications,
    };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
    if (!Notifications) {
        return null;
    }
    
    let token: string | null = null;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Platform.OS !== 'web') {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('通知權限未授予');
            return null;
        }
        token = (await Notifications.getExpoPushTokenAsync()).data;
    }

    return token;
}

