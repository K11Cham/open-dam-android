


import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GameSettings {
    soundEffects: boolean;
    hapticFeedback: boolean;
    showMoveHints: boolean;
    autoSave: boolean;
    confirmMoves: boolean;
    showTimer: boolean;
}

interface SettingsContextType {
    settings: GameSettings;
    updateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => Promise<void>;
    resetSettings: () => Promise<void>;
}

const defaultSettings: GameSettings = {
    soundEffects: true,
    hapticFeedback: true,
    showMoveHints: true,
    autoSave: true,
    confirmMoves: false,
    showTimer: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'dam_settings';

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const [settings, setSettings] = useState<GameSettings>(defaultSettings);

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
                if (savedSettings) {
                    setSettings(JSON.parse(savedSettings));
                }
            } catch (e) {
                console.log('Failed to load settings', e);
            }
        };
        loadSettings();
    }, []);

    const updateSetting = async <K extends keyof GameSettings>(
        key: K,
        value: GameSettings[K]
    ) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        try {
            await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
        } catch (e) {
            console.log('Failed to save settings', e);
        }
    };

    const resetSettings = async () => {
        setSettings(defaultSettings);
        try {
            await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaultSettings));
        } catch (e) {
            console.log('Failed to reset settings', e);
        }
    };

    const value = {
        settings,
        updateSetting,
        resetSettings,
    };

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within SettingsProvider');
    return context;
};