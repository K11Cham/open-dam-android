import React, { useState, useEffect, useRef } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Animated, StyleSheet, View, BackHandler } from 'react-native';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { SettingsProvider } from './src/contexts/SettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen, { GameSettings } from './src/screens/HomeScreen';
import GameScreen from './src/screens/GameScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HelpScreen from './src/screens/HelpScreen';

SplashScreen.preventAutoHideAsync();

type ViewType = 'home' | 'game' | 'settings' | 'help';

function AnimatedScreen({
    children,
    isActive
}: {
    children: React.ReactNode;
    isActive: boolean;
}) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateX = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        if (isActive) {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 10,
                }),
            ]).start();
        } else {
            opacity.setValue(0);
            translateX.setValue(50);
        }
    }, [isActive]);

    if (!isActive) return null;

    return (
        <Animated.View style={[styles.screenContainer, { opacity, transform: [{ translateX }] }]}>
            {children}
        </Animated.View>
    );
}

export default function App() {
    const [loaded, error] = useFonts({
        Inter: require("./assets/fonts/Inter-Regular.ttf"),
        InterBold: require("./assets/fonts/Inter-Bold.ttf"),
    });

    const [appReady, setAppReady] = useState(false);
    const [viewStack, setViewStack] = useState<ViewType[]>(['home']);
    const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
    const [gameMode, setGameMode] = useState<'new' | 'load'>('new');

    const currentView = viewStack[viewStack.length - 1];

    useEffect(() => {
        if (loaded || error) setAppReady(true);
    }, [loaded, error]);

    useEffect(() => {
        if (appReady) SplashScreen.hideAsync();
    }, [appReady]);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (viewStack.length > 1) {
                setViewStack(prev => prev.slice(0, -1));
                return true;
            }
            return false;
        });
        return () => backHandler.remove();
    }, [viewStack]);

    if (!appReady) return null;

    const clearData = async () => {
        await AsyncStorage.clear();
        setViewStack(['home']);
    };

    const startNewGame = (settings: GameSettings) => {
        setGameSettings(settings);
        setGameMode('new');
        pushView('game');
    };

    const loadGame = (slot: number) => {
        // For loaded games, use default settings (loaded game will override)
        setGameSettings({
            slot,
            boardSize: 5,
            vsAI: false,
            aiDifficulty: 'normal',
            playerSide: 1,
            undoAllowed: true,
        });
        setGameMode('load');
        pushView('game');
    };

    const pushView = (newView: ViewType) => {
        setViewStack(prev => [...prev, newView]);
    };

    const popView = () => {
        if (viewStack.length > 1) {
            setViewStack(prev => prev.slice(0, -1));
        }
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <SettingsProvider>
                        <View style={styles.container}>
                            <AnimatedScreen isActive={currentView === 'home'}>
                                <HomeScreen
                                    onNewGame={startNewGame}
                                    onLoadGame={loadGame}
                                    onSettings={() => pushView('settings')}
                                    onHelp={() => pushView('help')}
                                />
                            </AnimatedScreen>

                            <AnimatedScreen isActive={currentView === 'game'}>
                                {gameSettings && (
                                    <GameScreen
                                        settings={gameSettings}
                                        mode={gameMode}
                                        onMenu={popView}
                                    />
                                )}
                            </AnimatedScreen>

                            <AnimatedScreen isActive={currentView === 'settings'}>
                                <SettingsScreen
                                    onBack={popView}
                                    onClearData={clearData}
                                />
                            </AnimatedScreen>

                            <AnimatedScreen isActive={currentView === 'help'}>
                                <HelpScreen onBack={popView} />
                            </AnimatedScreen>
                        </View>
                    </SettingsProvider>
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    screenContainer: { ...StyleSheet.absoluteFillObject },
});