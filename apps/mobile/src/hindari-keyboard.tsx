import { useCallback, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

/**
 * Untuk layar yang isiannya MENEMPEL di bawah, di luar daftar yang bisa
 * digulir (percakapan, lapor). `automaticallyAdjustKeyboardInsets` — pola di
 * layar profil — hanya menyusutkan isi ScrollView, jadi tidak menolong di sini.
 *
 * KeyboardAvoidingView menghitung tumpang tindih dari frame-nya RELATIF KE
 * PARENT, sehingga butuh `keyboardVerticalOffset` setinggi segala sesuatu di
 * atasnya (header stack). Menebak angka itu gampang meleset — apalagi header
 * iOS 26 yang melayang — dan `useHeaderHeight` dari expo-router sudah
 * deprecated. Maka posisinya DIUKUR: jarak layar ini dari atas jendela
 * persis sama dengan offset yang dibutuhkan.
 *
 * Android dibiarkan seperti sebelumnya (behavior undefined): jendelanya
 * sudah di-resize oleh sistem.
 */
export function HindariKeyboard({ children }: { children: ReactNode }) {
  const ref = useRef<View>(null);
  const [offset, setOffset] = useState(0);

  const ukur = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => setOffset(y));
  }, []);

  return (
    <View ref={ref} style={s.flex} onLayout={ukur}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={offset}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({ flex: { flex: 1 } });
