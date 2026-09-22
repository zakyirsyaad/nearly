import { useColor } from '@/hooks/useColor';
import { useGerakDikurangi } from '@/hooks/useGerakDikurangi';
import { BORDER_RADIUS } from '@/theme/globals';
import React, { useEffect } from 'react';
import { DimensionValue, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  style?: ViewStyle;
}

/**
 * Salinan BNA yang disunting (spec desain UI §3.7, §7.2): radius 8, dan
 * menjadi blok DIAM tanpa kilau saat Reduce Motion menyala.
 */
export const Skeleton = React.memo(function Skeleton({
  width = '100%',
  height = 16,
  style,
}: SkeletonProps) {
  const warna = useColor('muted');
  const gerakDikurangi = useGerakDikurangi();
  const opacity = useSharedValue(0.7);

  const gayaAnimasi = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (gerakDikurangi) {
      cancelAnimation(opacity);
      opacity.value = 0.7;
      return;
    }
    opacity.value = 0.5;
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(opacity);
  }, [gerakDikurangi, opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
      style={[
        { width, height, backgroundColor: warna, borderRadius: BORDER_RADIUS },
        gayaAnimasi,
        style,
      ]}
    />
  );
});
