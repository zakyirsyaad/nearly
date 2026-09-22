import { useColor } from '@/hooks/useColor';
import { HURUF, type VarianHuruf } from '@/theme/globals';
import { keluargaUntuk } from '@/theme/huruf';
import React, { forwardRef } from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  TextStyle,
} from 'react-native';

/**
 * Salinan BNA yang disunting (spec desain UI §3.3, Ruling A8): varian
 * memetakan ke ukuran dan KELUARGA font dari theme/globals.ts. `fontWeight`
 * dari `style` diterjemahkan ke `fontFamily` lalu TIDAK diteruskan — di
 * Android keduanya bisa bertabrakan. `subtitle` dan `link` dipertahankan
 * karena dipakai salinan BNA lain (toast, card).
 */
export type TextVariant = VarianHuruf | 'subtitle' | 'link';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  lightColor?: string;
  darkColor?: string;
  children?: React.ReactNode;
}

const VARIAN_JUDUL: TextVariant[] = ['heading', 'title', 'subtitle'];

function dasarVarian(variant: TextVariant): VarianHuruf {
  if (variant === 'subtitle') return 'title';
  if (variant === 'link') return 'body';
  return variant;
}

export const Text = React.memo(
  forwardRef<RNText, TextProps>(
    ({ variant = 'body', lightColor, darkColor, style, children, ...props }, ref) => {
      const warnaTeks = useColor('text', { light: lightColor, dark: darkColor });
      const warnaRedup = useColor('textMuted');
      const warnaTautan = useColor('primary');
      const dasar = HURUF[dasarVarian(variant)];

      const rata: TextStyle = StyleSheet.flatten(style) ?? {};
      const { fontWeight, fontFamily, ...sisa } = rata;

      const gaya: TextStyle = {
        fontSize: dasar.fontSize,
        // lineHeight varian hanya berlaku bila pemanggil tidak mengganti
        // fontSize — lineHeight kecil di huruf besar memotong teks.
        ...(sisa.fontSize === undefined ? { lineHeight: dasar.lineHeight } : {}),
        color: variant === 'link' ? warnaTautan : dasar.redup ? warnaRedup : warnaTeks,
        ...(variant === 'link' ? { textDecorationLine: 'underline' as const } : {}),
        ...sisa,
        fontFamily: fontFamily ?? keluargaUntuk(dasar.fontFamily, fontWeight),
      };

      return (
        <RNText
          ref={ref}
          style={gaya}
          accessibilityRole={VARIAN_JUDUL.includes(variant) ? 'header' : undefined}
          {...props}
        >
          {children}
        </RNText>
      );
    }
  )
);

Text.displayName = 'Text';
