import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing } from 'react-native';

/**
 * HoldButton Component
 * Enforces a strict hold-to-confirm touch duration (default 2000ms)
 * to prevent accidental execution of critical dam hardware actions.
 */
export default function HoldButton({
  title,
  subtitle,
  confirmColor = '#EF4444',
  baseColor = '#1E293B',
  textColor = '#FFFFFF',
  duration = 2000,
  onConfirm,
  disabled = false,
  style
}) {
  const [holding, setHolding] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef(null);

  const startHold = () => {
    if (disabled || confirmed) return;

    setHolding(true);
    progressAnim.setValue(0);

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: duration,
      easing: Easing.linear,
      useNativeDriver: false
    }).start();

    holdTimer.current = setTimeout(() => {
      setConfirmed(true);
      setHolding(false);
      if (onConfirm) onConfirm();

      // Reset confirmed badge after 1.5s
      setTimeout(() => {
        setConfirmed(false);
        progressAnim.setValue(0);
      }, 1500);
    }, duration);
  };

  const cancelHold = () => {
    if (confirmed) return;
    setHolding(false);
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
  };

  const fillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPressIn={startHold}
      onPressOut={cancelHold}
      disabled={disabled || confirmed}
      style={[
        styles.buttonContainer,
        { backgroundColor: baseColor, borderColor: confirmColor },
        disabled && styles.disabledContainer,
        style
      ]}
    >
      {/* Animated Fill Bar */}
      <Animated.View
        style={[
          styles.fillBar,
          {
            width: fillWidth,
            backgroundColor: confirmColor
          }
        ]}
      />

      {/* Button Content */}
      <View style={styles.textWrapper}>
        <Text style={[styles.mainTitle, { color: textColor }]}>
          {confirmed ? '✓ EXECUTED' : holding ? `HOLD 2s TO CONFIRM...` : title}
        </Text>
        {subtitle && !holding && !confirmed && (
          <Text style={styles.subTitle}>{subtitle}</Text>
        )}
        {holding && (
          <Text style={styles.holdingNotice}>Release to cancel</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6
  },
  disabledContainer: {
    opacity: 0.45,
    borderColor: '#475569'
  },
  fillBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10
  },
  textWrapper: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  mainTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  subTitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500'
  },
  holdingNotice: {
    fontSize: 11,
    color: '#FEF08A',
    fontWeight: '700',
    marginTop: 2
  }
});
