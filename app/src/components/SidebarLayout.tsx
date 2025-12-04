
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions, PanResponder, TouchableWithoutFeedback } from 'react-native';
import SidebarMenu, { SIDEBAR_WIDTH } from './SidebarMenu';

const { width } = Dimensions.get('window');

interface SidebarContextType {
    openMenu: () => void;
    closeMenu: () => void;
    toggleMenu: () => void;
    isMenuVisible: boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarLayout');
    }
    return context;
};

interface SidebarLayoutProps {
    children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    // If coming from sidebar, start at SIDEBAR_WIDTH (open position) and animate to 0 (closed)
    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: isMenuVisible ? SIDEBAR_WIDTH : 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [isMenuVisible, slideAnim]);

    const openMenu = () => setIsMenuVisible(true);
    const closeMenu = () => setIsMenuVisible(false);
    const toggleMenu = () => setIsMenuVisible(prev => !prev);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                const { dx } = gestureState;
                // If menu is closed, disable swipe to open (to allow native back swipe)
                if (!isMenuVisible) {
                    return false;
                }
                // If menu is open, allow swipe left to close
                return dx < -10;
            },
            onPanResponderRelease: (evt, gestureState) => {
                const { dx } = gestureState;
                if (!isMenuVisible && dx > 50) {
                    openMenu();
                } else if (isMenuVisible && dx < -50) {
                    closeMenu();
                }
            },
        })
    ).current;

    return (
        <SidebarContext.Provider value={{ openMenu, closeMenu, toggleMenu, isMenuVisible }}>
            <View style={styles.container} {...panResponder.panHandlers}>
                {/* Sidebar Menu (Behind Content) */}
                <View style={styles.sidebarContainer}>
                    <SidebarMenu onNavigate={closeMenu} />
                </View>

                {/* Main Content (Animated) */}
                <Animated.View style={[styles.mainContent, { transform: [{ translateX: slideAnim }] }]}>
                    {/* Overlay to close menu when open */}
                    {isMenuVisible && (
                        <TouchableWithoutFeedback onPress={closeMenu}>
                            <View style={styles.contentOverlay} />
                        </TouchableWithoutFeedback>
                    )}
                    {children}
                </Animated.View>
            </View>
        </SidebarContext.Provider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    sidebarContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: SIDEBAR_WIDTH,
        zIndex: 0,
    },
    mainContent: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        zIndex: 1,
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
    },
    contentOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        backgroundColor: 'transparent',
    },
});
