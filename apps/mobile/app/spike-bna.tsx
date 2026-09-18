import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { useColor } from "@/hooks/useColor";

/**
 * SEMENTARA — layar uji spike BNA (Rencana A Task 1, spec desain UI §9
 * langkah 1). Pemilik membukanya di Expo Go lewat tautan di beranda lama.
 * Dihapus di Task 8.
 */
export default function SpikeBna() {
  return (
    <ToastProvider>
      <SpikeIsi />
    </ToastProvider>
  );
}

function SpikeIsi() {
  const { toast } = useToast();
  const latar = useColor("background");
  const [isi, setIsi] = useState("");
  return (
    <View style={[s.root, { backgroundColor: latar }]}>
      <Text variant="heading">Nearly</Text>
      <Text variant="caption">BNA spike · B2 palette</Text>
      <Input
        placeholder="Write a message…"
        value={isi}
        onChangeText={setIsi}
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        importantForAutofill="no"
      />
      <Button onPress={() => toast({ title: "Connected", description: "BNA toast works.", variant: "success" })}>
        Show toast
      </Button>
      <Button variant="outline" onPress={() => setIsi("")}>
        Clear
      </Button>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 16 },
});
