import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, Dimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, ThemeKey } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import AnimatedButton from '../components/ui/AnimatedButton';

interface Props {
    onBack: () => void;
    onClearData: () => void;
}

const { width } = Dimensions.get('window');

export default function SettingsScreen({ onBack, onClearData }: Props) {
    const { theme, fontBold, fontRegular, currentTheme, setTheme, allThemes } = useTheme();
    const { settings, updateSetting, resetSettings } = useSettings();
    const insets = useSafeAreaInsets();
    const [showThemeModal, setShowThemeModal] = useState(false);

    const handleClearData = () => {
        Alert.alert(
            "Clear All Data",
            "This will delete all saved games and reset your settings. This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                        await onClearData();
                        await resetSettings();
                        setTheme('light');
                    }
                }
            ]
        );
    };

    const themeKeys = Object.keys(allThemes) as ThemeKey[];

    const renderSettingItem = (
        icon: string,
        label: string,
        description: string,
        value?: boolean,
        onToggle?: () => void,
        isAction?: boolean,
        actionColor?: string
    ) => (
        <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme.highlight }]}
            onPress={isAction ? onToggle : undefined}
            disabled={!isAction}
            activeOpacity={isAction ? 0.7 : 1}
        >
            <View style={[styles.settingIcon, { backgroundColor: isAction ? actionColor || theme.accent : theme.bg }]}>
                <MaterialIcons name={icon as any} size={22} color={isAction ? '#FFFFFF' : theme.text} />
            </View>
            <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: theme.text, fontFamily: fontBold }]}>
                    {label}
                </Text>
                <Text style={[styles.settingDesc, { color: theme.text, fontFamily: fontRegular }]}>
                    {description}
                </Text>
            </View>
            {value !== undefined && !isAction && (
                <Switch
                    value={value}
                    onValueChange={onToggle}
                    trackColor={{ false: '#767577', true: theme.p1 }}
                    thumbColor={value ? '#FFFFFF' : '#f4f3f4'}
                />
            )}
            {isAction && (
                <MaterialIcons name="chevron-right" size={24} color={theme.text} />
            )}
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            {/* Status Bar Spacer */}
            <View style={{ height: insets.top, backgroundColor: theme.bg }} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.highlight }]}>
                <AnimatedButton onPress={onBack} style={styles.iconBtn}>
                    <MaterialIcons name="arrow-back" size={28} color={theme.text} />
                </AnimatedButton>
                <Text style={[styles.headerTitle, { color: theme.text, fontFamily: fontBold }]}>
                    Settings
                </Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Theme Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: fontBold }]}>
                        APPEARANCE
                    </Text>

                    <TouchableOpacity
                        style={[styles.settingItem, { backgroundColor: theme.highlight }]}
                        onPress={() => setShowThemeModal(true)}
                    >
                        <View style={[styles.settingIcon, { backgroundColor: theme.p1 }]}>
                            <MaterialIcons name="palette" size={22} color="#FFFFFF" />
                        </View>
                        <View style={styles.settingContent}>
                            <Text style={[styles.settingLabel, { color: theme.text, fontFamily: fontBold }]}>
                                Theme
                            </Text>
                            <Text style={[styles.settingDesc, { color: theme.text, fontFamily: fontRegular }]}>
                                {allThemes[currentTheme].name}
                            </Text>
                        </View>
                        <View style={[styles.themePreview, { backgroundColor: theme.bg, borderColor: theme.text }]}>
                            <View style={[styles.themeDot, { backgroundColor: theme.p1 }]} />
                            <View style={[styles.themeDot, { backgroundColor: theme.p2 }]} />
                            <View style={[styles.themeDot, { backgroundColor: theme.accent }]} />
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>

                {/* Gameplay Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: fontBold }]}>
                        GAMEPLAY
                    </Text>

                    {renderSettingItem(
                        'lightbulb-outline',
                        'Show Move Hints',
                        'Highlight valid moves when selecting a piece',
                        settings.showMoveHints,
                        () => updateSetting('showMoveHints', !settings.showMoveHints)
                    )}

                    {renderSettingItem(
                        'done-all',
                        'Confirm Moves',
                        'Require tap confirmation before executing moves',
                        settings.confirmMoves,
                        () => updateSetting('confirmMoves', !settings.confirmMoves)
                    )}

                    {renderSettingItem(
                        'timer',
                        'Show Game Timer',
                        'Display elapsed time during gameplay',
                        settings.showTimer,
                        () => updateSetting('showTimer', !settings.showTimer)
                    )}
                </View>

                {/* Feedback Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: fontBold }]}>
                        FEEDBACK
                    </Text>

                    {renderSettingItem(
                        'volume-up',
                        'Sound Effects',
                        'Play sounds for moves and captures',
                        settings.soundEffects,
                        () => updateSetting('soundEffects', !settings.soundEffects)
                    )}

                    {renderSettingItem(
                        'vibration',
                        'Haptic Feedback',
                        'Vibrate on interactions and events',
                        settings.hapticFeedback,
                        () => updateSetting('hapticFeedback', !settings.hapticFeedback)
                    )}
                </View>

                {/* Data Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: fontBold }]}>
                        DATA
                    </Text>

                    {renderSettingItem(
                        'save',
                        'Auto-Save',
                        'Automatically save game progress',
                        settings.autoSave,
                        () => updateSetting('autoSave', !settings.autoSave)
                    )}

                    {renderSettingItem(
                        'delete-forever',
                        'Clear All Data',
                        'Delete all saved games and settings',
                        undefined,
                        handleClearData,
                        true,
                        theme.p1
                    )}
                </View>

                {/* About Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: fontBold }]}>
                        ABOUT
                    </Text>

                    <View style={[styles.aboutCard, { backgroundColor: theme.highlight }]}>
                        <View style={[styles.aboutIcon, { backgroundColor: theme.p1 }]}>
                            <MaterialIcons name="grid-on" size={32} color="#FFFFFF" />
                        </View>
                        <Text style={[styles.appName, { color: theme.text, fontFamily: fontBold }]}>
                            DAM
                        </Text>
                        <Text style={[styles.appVersion, { color: theme.text, fontFamily: fontRegular }]}>
                            Version 1.0.0
                        </Text>
                        <Text style={[styles.appDesc, { color: theme.text, fontFamily: fontRegular }]}>
                            A strategic board game with orthogonal movement
                        </Text>
                        <View style={styles.creditsContainer}>
                            <Text style={[styles.creditsText, { color: theme.text, fontFamily: fontRegular }]}>
                                Powered by DamFish AI
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Extra padding at bottom */}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Bottom Safe Area */}
            <View style={{ height: insets.bottom }} />

            {/* Theme Selection Modal */}
            <Modal
                visible={showThemeModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowThemeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.themeModal, { backgroundColor: theme.bg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text, fontFamily: fontBold }]}>
                                Choose Theme
                            </Text>
                            <TouchableOpacity onPress={() => setShowThemeModal(false)}>
                                <MaterialIcons name="close" size={28} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.themeGrid}>
                                {themeKeys.map((themeKey) => {
                                    const t = allThemes[themeKey];
                                    const isSelected = currentTheme === themeKey;
                                    return (
                                        <TouchableOpacity
                                            key={themeKey}
                                            style={[
                                                styles.themeButton,
                                                { backgroundColor: t.highlight },
                                                isSelected && { borderColor: t.p1, borderWidth: 3 }
                                            ]}
                                            onPress={() => {
                                                setTheme(themeKey);
                                                setShowThemeModal(false);
                                            }}
                                        >
                                            <View style={styles.themeColorRow}>
                                                <View style={[styles.themeColorDot, { backgroundColor: t.p1 }]} />
                                                <View style={[styles.themeColorDot, { backgroundColor: t.p2 }]} />
                                                <View style={[styles.themeColorDot, { backgroundColor: t.accent }]} />
                                            </View>
                                            <Text style={[styles.themeName, { color: t.text, fontFamily: fontBold }]}>
                                                {t.name}
                                            </Text>
                                            {isSelected && (
                                                <View style={[styles.checkMark, { backgroundColor: t.p1 }]}>
                                                    <MaterialIcons name="check" size={14} color="#FFFFFF" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    iconBtn: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
    },
    scrollContent: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 12,
        letterSpacing: 1.5,
        marginBottom: 12,
        opacity: 0.6,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        marginBottom: 8,
    },
    settingIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    settingContent: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 16,
    },
    settingDesc: {
        fontSize: 12,
        opacity: 0.6,
        marginTop: 2,
    },
    themePreview: {
        flexDirection: 'row',
        padding: 6,
        borderRadius: 8,
        borderWidth: 1,
        marginRight: 8,
    },
    themeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginHorizontal: 2,
    },
    aboutCard: {
        alignItems: 'center',
        padding: 24,
        borderRadius: 16,
    },
    aboutIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    appName: {
        fontSize: 28,
        letterSpacing: 4,
    },
    appVersion: {
        fontSize: 14,
        opacity: 0.6,
        marginTop: 4,
    },
    appDesc: {
        fontSize: 14,
        opacity: 0.7,
        marginTop: 12,
        textAlign: 'center',
    },
    creditsContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    creditsText: {
        fontSize: 12,
        opacity: 0.5,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    themeModal: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
    },
    themeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    themeButton: {
        width: (width - 72) / 3,
        padding: 12,
        borderRadius: 16,
        alignItems: 'center',
        position: 'relative',
    },
    themeColorRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    themeColorDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginHorizontal: 2,
    },
    themeName: {
        fontSize: 12,
        textAlign: 'center',
    },
    checkMark: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
});