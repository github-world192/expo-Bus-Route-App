import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import RoutePlanScreen from './src/screens/RoutePlanScreen';
import SearchScreen from './src/screens/SearchScreen';
import StatusScreen from './src/screens/StatusScreen';
import StopsNearbyScreen from './src/screens/StopsNearbyScreen';
import SmartNotificationScreen from './src/screens/SmartNotificationScreen';

const Stack = createStackNavigator();

export default function App() {
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
                            cardStyleInterpolator: ({ current }) => ({
                                cardStyle: {
                                    opacity: current.progress,
                                },
                            }),
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
        </SafeAreaProvider >
    );
}
