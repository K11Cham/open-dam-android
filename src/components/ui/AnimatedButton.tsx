import React, { useRef, useMemo } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

interface Props {
    onPress: () => void;
    style?: any;
    children: React.ReactNode;
    disabled?: boolean;
}

export default function AnimatedButton({ onPress, style, children, disabled }: Props) {
    // Use useMemo to ensure the animated value is always defined
    const scaleAnim = useMemo(() => new Animated.Value(1), []);

    const animatePress = (toValue: number) => {
        Animated.spring(scaleAnim, {
            toValue,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    return (
        <Animated.View 
            style={[
                { transform: [{ scale: scaleAnim }] },
                disabled && styles.disabled
            ]}
        >
            <Pressable
                onPress={onPress}
                onPressIn={() => !disabled && animatePress(0.92)}
                onPressOut={() => !disabled && animatePress(1)}
                disabled={disabled}
                style={style}
            >
                {children}
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    disabled: {
        opacity: 0.5,
    },
});
