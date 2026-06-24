import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Theme definitions
const themes = {
    // Original themes
    light: {
        name: 'Light',
        bg: '#F3F4F6',
        board: '#FFFFFF',
        p1: '#E63946',
        p2: '#457B9D',
        king: '#FFD700',
        text: '#1D3557',
        highlight: '#E5E7EB',
        accent: '#1D3557',
        boardBorder: '#FFFFFF',
        cell: '#FFFFFF',
    },
    dark: {
        name: 'Dark',
        bg: '#111827',
        board: '#1F2937',
        p1: '#FF6B6B',
        p2: '#4AA3D9',
        king: '#FFD700',
        text: '#F3F4F6',
        highlight: '#374151',
        accent: '#60A5FA',
        boardBorder: '#374151',
        cell: '#1F2937',
    },
    // Vibrant themes
    ocean: {
        name: 'Ocean',
        bg: '#E0F7FA',
        board: '#FFFFFF',
        p1: '#00ACC1',
        p2: '#006064',
        king: '#FFD700',
        text: '#004D40',
        highlight: '#B2EBF2',
        accent: '#0097A7',
        boardBorder: '#00ACC1',
        cell: '#E0F7FA',
    },
    sunset: {
        name: 'Sunset',
        bg: '#FFF3E0',
        board: '#FFFFFF',
        p1: '#D32F2F',
        p2: '#FF8F00',
        king: '#FFD700',
        text: '#BF360C',
        highlight: '#FFE0B2',
        accent: '#E64A19',
        boardBorder: '#FF5722',
        cell: '#FFF3E0',
    },
    forest: {
        name: 'Forest',
        bg: '#E8F5E9',
        board: '#FFFFFF',
        p1: '#1B5E20',
        p2: '#8D6E63',
        king: '#FFD700',
        text: '#1B5E20',
        highlight: '#C8E6C9',
        accent: '#43A047',
        boardBorder: '#2E7D32',
        cell: '#E8F5E9',
    },
    lavender: {
        name: 'Lavender',
        bg: '#F3E5F5',
        board: '#FFFFFF',
        p1: '#6A1B9A',
        p2: '#00838F',
        king: '#FFD700',
        text: '#4A148C',
        highlight: '#E1BEE7',
        accent: '#7B1FA2',
        boardBorder: '#8E24AA',
        cell: '#F3E5F5',
    },
    // Bold themes
    midnight: {
        name: 'Midnight',
        bg: '#0D1B2A',
        board: '#1B263B',
        p1: '#E63946',
        p2: '#415A77',
        king: '#FFD700',
        text: '#E0E1DD',
        highlight: '#2D3E50',
        accent: '#778DA9',
        boardBorder: '#415A77',
        cell: '#1B263B',
    },
    cherry: {
        name: 'Cherry Blossom',
        bg: '#FCE4EC',
        board: '#FFFFFF',
        p1: '#AD1457',
        p2: '#00695C',
        king: '#FFD700',
        text: '#880E4F',
        highlight: '#F8BBD9',
        accent: '#D81B60',
        boardBorder: '#C2185B',
        cell: '#FCE4EC',
    },
    mint: {
        name: 'Mint',
        bg: '#E0F2F1',
        board: '#FFFFFF',
        p1: '#00695C',
        p2: '#E65100',
        king: '#FFD700',
        text: '#004D40',
        highlight: '#B2DFDB',
        accent: '#009688',
        boardBorder: '#00897B',
        cell: '#E0F2F1',
    },
    // High contrast themes
    monochrome: {
        name: 'Monochrome',
        bg: '#FFFFFF',
        board: '#F5F5F5',
        p1: '#000000',
        p2: '#424242',
        king: '#FFD700',
        text: '#000000',
        highlight: '#E0E0E0',
        accent: '#616161',
        boardBorder: '#000000',
        cell: '#FFFFFF',
    },
    contrast: {
        name: 'High Contrast',
        bg: '#000000',
        board: '#000000',
        p1: '#FFFF00',
        p2: '#00FFFF',
        king: '#FF00FF',
        text: '#FFFFFF',
        highlight: '#333333',
        accent: '#FFFFFF',
        boardBorder: '#FFFFFF',
        cell: '#111111',
    },
    // Fun themes
    candy: {
        name: 'Candy',
        bg: '#FFF8E1',
        board: '#FFFFFF',
        p1: '#F06292',
        p2: '#BA68C8',
        king: '#FFD700',
        text: '#6A1B9A',
        highlight: '#FCE4EC',
        accent: '#E91E63',
        boardBorder: '#F06292',
        cell: '#FFF8E1',
    },
    neon: {
        name: 'Neon',
        bg: '#0A0A0A',
        board: '#1A1A1A',
        p1: '#FF0055',
        p2: '#00FFFF',
        king: '#FFFF00',
        text: '#FFFFFF',
        highlight: '#2A2A2A',
        accent: '#FF00FF',
        boardBorder: '#FF0055',
        cell: '#1A1A1A',
    },
    retro: {
        name: 'Retro',
        bg: '#FFF8E1',
        board: '#FFECB3',
        p1: '#D84315',
        p2: '#1565C0',
        king: '#FFD700',
        text: '#3E2723',
        highlight: '#FFE082',
        accent: '#FF6F00',
        boardBorder: '#8D6E63',
        cell: '#FFF8E1',
    },
    nordic: {
        name: 'Nordic',
        bg: '#ECEFF4',
        board: '#E5E9F0',
        p1: '#BF616A',
        p2: '#5E81AC',
        king: '#EBCB8B',
        text: '#2E3440',
        highlight: '#D8DEE9',
        accent: '#88C0D0',
        boardBorder: '#4C566A',
        cell: '#E5E9F0',
    },
    dracula: {
        name: 'Dracula',
        bg: '#282A36',
        board: '#44475A',
        p1: '#FF5555',
        p2: '#BD93F9',
        king: '#F1FA8C',
        text: '#F8F8F2',
        highlight: '#44475A',
        accent: '#8BE9FD',
        boardBorder: '#6272A4',
        cell: '#44475A',
    },
};

type ThemeKey = keyof typeof themes;

interface ThemeContextType {
    currentTheme: ThemeKey;
    setTheme: (theme: ThemeKey) => void;
    theme: typeof themes.light;
    fontBold: string;
    fontRegular: string;
    allThemes: typeof themes;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'dam_theme';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [currentTheme, setCurrentTheme] = useState<ThemeKey>('light');

    // Load saved theme on mount
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
                if (savedTheme && savedTheme in themes) {
                    setCurrentTheme(savedTheme as ThemeKey);
                }
            } catch (e) {
                console.log('Failed to load theme', e);
            }
        };
        loadTheme();
    }, []);

    const setTheme = async (theme: ThemeKey) => {
        setCurrentTheme(theme);
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (e) {
            console.log('Failed to save theme', e);
        }
    };

    const value = {
        currentTheme,
        setTheme,
        theme: themes[currentTheme],
        fontBold: 'InterBold',
        fontRegular: 'Inter',
        allThemes: themes,
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within ThemeProvider');
    return context;
};

export type { ThemeKey };
