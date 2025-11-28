import React, { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout } from '../../theme';

export default function SearchBar({ label = '搜尋站牌', onPress, animateShrink = false, containerStyle }) {
  const [measuredW, setMeasuredW] = useState(null);
  const widthAnim = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;

  const startAnimAndPress = () => {
    if (animateShrink && measuredW) {
      Animated.parallel([
        Animated.timing(widthAnim, {
          toValue: layout.searchTargetW,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(labelOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && onPress) onPress();
      });
    } else if (onPress) {
      onPress();
    }
  };

  const onLayout = (e) => {
    if (measuredW == null) {
      const w = e.nativeEvent.layout.width;
      setMeasuredW(w);
      widthAnim.setValue(w);
    }
  };

  return (
    <Pressable onPress={startAnimAndPress} style={[styles.press, containerStyle]}>
      <View style={styles.row} onLayout={onLayout}>
        <Animated.View style={[styles.bar, { width: widthAnim }]}>
          <Ionicons name="search" size={21} color="rgba(255,255,255,0.75)" style={{ marginRight: 12 }} />
          <Animated.Text style={[styles.label, { opacity: labelOpacity }]}>{label}</Animated.Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  row: { width: '100%' },
  bar: {
    height: layout.searchH,
    borderRadius: layout.searchRadius,
    backgroundColor: 'rgba(217,217,217,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  label: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 17,
    fontWeight: '600',
  },
});
