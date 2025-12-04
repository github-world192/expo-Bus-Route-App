import { NavigationContainer } from '@react-navigation/native';
import { CardStyleInterpolators, createStackNavigator, StackCardStyleInterpolator } from '@react-navigation/stack';
import * as Location from 'expo-location';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './app/src/screens/HomeScreen';
import RoutePlanScreen from './app/src/screens/RoutePlanScreen';
import SearchScreen from './app/src/screens/SearchScreen';
import SmartNotificationScreen from './app/src/screens/SmartNotificationScreen';
import StatusScreen from './app/src/screens/StatusScreen';
import StopsNearbyScreen from './app/src/screens/StopsNearbyScreen';

const Stack = createStackNavigator();

export default function App() {
    // 在應用啟動時請求位置權限
    useEffect(() => {
        (async () => {
            try {
                // 先檢查當前權限狀態
                const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
                console.log('[App] 當前位置權限狀態:', currentStatus);
                
                // 如果權限未授予，明確請求權限
                if (currentStatus !== 'granted') {
                    console.log('[App] 請求位置權限...');
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    console.log('[App] 位置權限請求結果:', status);
                    
                    if (status === 'granted') {
                        console.log('[App] ✅ 位置權限已授予');
                    } else {
                        console.log('[App] ❌ 位置權限被拒絕:', status);
                    }
                } else {
                    console.log('[App] ✅ 位置權限已存在');
                }
            } catch (error) {
                console.error('[App] 請求位置權限時發生錯誤:', error);
            }
        })();
    }, []);

    return (
        <SafeAreaProvider>
            <NavigationContainer>
                <Stack.Navigator
                    screenOptions={{
                        headerShown: false,
                        animationTypeForReplace: 'push',
                        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                        gestureDirection: 'horizontal'
                    }}
                >
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen
                        name="Search"
                        component={SearchScreen}
                        options={{
                            cardStyleInterpolator: (({ current }) => ({
                                cardStyle: {
                                    opacity: current.progress,
                                },
                            })) as StackCardStyleInterpolator,
                            transitionSpec: {
                                open: { animation: 'timing', config: { duration: 200 } },
                                close: { animation: 'timing', config: { duration: 200 } },
                            }
                        }}
                    />
                    <Stack.Screen name="RoutePlan" component={RoutePlanScreen} />
                    <Stack.Screen name="Status" component={StatusScreen} />
                    <Stack.Screen name="StopsNearby" component={StopsNearbyScreen} />
                    <Stack.Screen name="SmartNotification" component={SmartNotificationScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}

