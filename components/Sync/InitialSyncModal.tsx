// components/Sync/InitialSyncModal.tsx
import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  progress: { phase: string; total: number; done: number; message?: string };
  canDismiss?: boolean;                 // true bila diizinkan lanjut meski gagal sebagian
  onDismiss?: () => void;
};

export default function InitialSyncModal({ visible, progress, canDismiss, onDismiss }: Props) {
  const { total, done, phase, message } = progress || { total: 0, done: 0, phase: 'prepare' };
  const pct = total > 0 ? Math.round((done / total) * 100) : (phase === 'finalize' ? 100 : 0);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>Menyiapkan Mode Offline</Text>
          <Text style={s.msg}>{message || 'Memulai…'}</Text>
          <View style={s.barWrap}>
            <View style={[s.bar, { width: `${pct}%` }]} />
          </View>
          <Text style={s.pct}>{pct}%</Text>
          {canDismiss ? (
            <TouchableOpacity style={s.btn} onPress={onDismiss}>
              <Text style={s.btnText}>Lanjut</Text>
            </TouchableOpacity>
          ) : (
            <ActivityIndicator style={{ marginTop: 8 }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', alignItems:'center', justifyContent:'center' },
  card:{ width:'85%', backgroundColor:'#fff', borderRadius:16, padding:16 },
  title:{ fontSize:16, fontWeight:'700' },
  msg:{ marginTop:6, color:'#444' },
  barWrap:{ marginTop:12, height:8, backgroundColor:'#eee', borderRadius:6, overflow:'hidden' },
  bar:{ height:8, backgroundColor:'#3b82f6' },
  pct:{ marginTop:6, fontVariant:['tabular-nums'], color:'#111' },
  btn:{ marginTop:12, backgroundColor:'#ef4444', paddingVertical:10, borderRadius:10, alignItems:'center' },
  btnText:{ color:'#fff', fontWeight:'600' },
});
