// app/apar/EditApar.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  Text,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import QRCodeSVG from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import styled from 'styled-components/native';
import { safeFetchOffline } from '../../utils/safeFetchOffline';

const API_BASE = 'http://192.168.245.1:3000/api';

const C = {
  primary: '#D50000',
  background: '#FAFAFA',
  card: '#FFFFFF',
  text: '#212121',
  label: '#555',
  border: '#E0E0E0',
  secondary: '#757575',
};

const Container = styled(KeyboardAvoidingView).attrs({
  behavior: Platform.OS === 'ios' ? 'padding' : 'height',
})`
  flex: 1;
  background-color: ${C.background};
`;

const Header = styled(View)`
  background-color: ${C.primary};
  padding: 16px;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
`;

const HeaderTitle = styled(Text)`
  color: white;
  font-size: 24px;
  font-weight: bold;
`;

const Form = styled(ScrollView)`
  flex: 1;
  padding: 20px;
`;

const Section = styled(View)`
  margin-bottom: 24px;
`;

const SectionTitle = styled(Text)`
  font-size: 18px;
  color: ${C.secondary};
  margin-bottom: 8px;
  font-weight: bold;
`;

const FieldLabel = styled(Text)`
  font-size: 14px;
  color: ${C.label};
  margin-bottom: 4px;
`;

const FieldInput = styled(TextInput)`
  background-color: ${C.card};
  border: 1px solid ${C.border};
  border-radius: 8px;
  padding: 12px;
  color: ${C.text};
  margin-bottom: 12px;
`;

const Card = styled(View)`
  background-color: ${C.card};
  border-radius: 12px;
  padding: 16px;
  margin-vertical: 16px;
  align-items: center;
  elevation: 3;
`;

const QRTitle = styled(Text)`
  font-size: 16px;
  font-weight: bold;
  color: ${C.text};
  margin-bottom: 8px;
`;

const ButtonBase = styled(Pressable)<{ disabled?: boolean }>`
  background-color: ${({ disabled }) => (disabled ? C.border : C.primary)};
  padding: 14px;
  border-radius: 8px;
  align-items: center;
  margin-top: 12px;
  margin-bottom: 56px;
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
`;

const ButtonText = styled(Text)`
  color: white;
  font-size: 16px;
  font-weight: bold;
`;

const SecondaryButton = styled(Pressable)`
  background-color: ${C.card};
  border: 1px solid ${C.primary};
  padding: 12px;
  border-radius: 8px;
  align-items: center;
  margin-bottom: 16px;
`;

const SecondaryText = styled(Text)`
  color: ${C.primary};
  font-size: 16px;
  font-weight: bold;
`;

export default function EditApar() {
  const router = useRouter();
  const { id_apar: origId } = useLocalSearchParams<{ id_apar: string }>();

  const [loading, setLoading] = useState(true);
  const [idApar, setIdApar] = useState(origId || '');
  const [noApar, setNoApar] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [jenis, setJenis] = useState('');
  const [checklist, setChecklist] = useState<string[]>(['']);
  const [status, setStatus] = useState<'Sehat' | 'Maintenance' | 'Expired' | ''>('');
  const [tglExp, setTglExp] = useState('');
  const [tglMaint, setTglMaint] = useState('');
  const [interval, setInterval] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [showExpPicker, setShowExpPicker] = useState(false);
  const [showMaintPicker, setShowMaintPicker] = useState(false);

  const qrRef = useRef<View>(null);

  // Load existing APAR data on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await safeFetchOffline(`${API_BASE}/apar/${origId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setNoApar(data.no_apar);
        setLokasi(data.lokasi_apar);
        setJenis(data.jenis_apar);
        setStatus(data.status_apar);
        setTglExp(data.tgl_exp.slice(0, 10));
        setTglMaint(data.tgl_terakhir_maintenance.slice(0, 10));
        setInterval(data.interval_maintenance.toString());
        setKeterangan(data.keterangan ?? '');

        // parse checklist from JSON or semicolon list
        let items: string[] = [];
        try {
          const parsed = JSON.parse(data.keperluan_check);
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          items = data.keperluan_check
            .split(';')
            .map((s: string) => s.trim())
            .filter((s: string) => s);
        }
        setChecklist(items.length ? items : ['']);
      } catch (e: any) {
        Alert.alert(
          e.message === 'Offline' ? 'Offline' : 'Error memuat data',
          e.message === 'Offline'
            ? 'Tidak dapat memuat saat offline.'
            : e.message
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [origId]);

  // Checklist handlers
  const updateChecklistItem = (text: string, index: number) => {
    const arr = [...checklist];
    arr[index] = text;
    setChecklist(arr);
  };
  const addChecklistItem = () => setChecklist(prev => [...prev, '']);
  const removeChecklistItem = (index: number) =>
    setChecklist(prev => prev.filter((_, i) => i !== index));

  // Save changes
  const handleSubmit = async () => {
    if (
      !noApar.trim() ||
      !lokasi.trim() ||
      !jenis.trim() ||
      !status.trim() ||
      !tglExp.trim() ||
      !tglMaint.trim() ||
      !interval.trim() ||
      checklist.every(i => !i.trim())
    ) {
      return Alert.alert('Error', 'Lengkapi semua field sebelum menyimpan.');
    }

    try {
      await safeFetchOffline(`${API_BASE}/apar/${origId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_apar: idApar,
          no_apar: noApar,
          lokasi_apar: lokasi,
          jenis_apar: jenis,
          keperluan_check: JSON.stringify(checklist.filter(i => i.trim())),
          qr_code_apar: idApar,
          status_apar: status,
          tgl_exp: tglExp,
          tgl_terakhir_maintenance: tglMaint,
          interval_maintenance: parseInt(interval, 10),
          keterangan,
        }),
      });
      Alert.alert('Sukses', 'Data APAR berhasil diperbarui.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (e: any) {
      Alert.alert(
        e.message === 'Offline' ? 'Offline' : 'Error menyimpan',
        e.message === 'Offline'
          ? 'Silakan ulang saat online.'
          : e.message
      );
    }
  };

  // Download QR code
  const handleDownloadQR = () => {
    if (!qrRef.current) {
      return Alert.alert('Error', 'QR belum siap diunduh');
    }
    InteractionManager.runAfterInteractions(async () => {
      try {
        const uri = await captureRef(qrRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        const filename = `apar_${idApar}.png`;
        const dest = FileSystem.cacheDirectory + filename;
        await FileSystem.moveAsync({ from: uri, to: dest });

        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          const asset = await MediaLibrary.createAssetAsync(dest);
          await MediaLibrary.createAlbumAsync('QR APAR', asset, false);
          Alert.alert('Tersimpan', filename);
        } else {
          Alert.alert('Error', 'Izin penyimpanan ditolak');
        }
      } catch (err: any) {
        Alert.alert('Gagal download', err.message);
      }
    });
  };

  if (loading) {
    return (
      <Container>
        <ActivityIndicator size="large" style={{ marginTop: 80 }} />
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderTitle>Edit APAR</HeaderTitle>
      </Header>
      <Form>
        {/* Identitas APAR */}
        <Section>
          <SectionTitle>Identitas APAR</SectionTitle>
          <FieldLabel>No. APAR</FieldLabel>
          <FieldInput value={noApar} onChangeText={setNoApar} />

          <FieldLabel>QR Code</FieldLabel>
          <Card ref={qrRef} collapsable={false}>
            <QRTitle>{idApar}</QRTitle>
            <QRCodeSVG value={idApar} size={140} />
          </Card>
          <SecondaryButton onPress={handleDownloadQR}>
            <SecondaryText>Download QR ke Gallery</SecondaryText>
          </SecondaryButton>
        </Section>

        {/* Detail APAR */}
        <Section>
          <SectionTitle>Detail APAR</SectionTitle>
          <FieldLabel>Lokasi</FieldLabel>
          <FieldInput value={lokasi} onChangeText={setLokasi} />
          <FieldLabel>Jenis</FieldLabel>
          <FieldInput value={jenis} onChangeText={setJenis} />
          <FieldLabel>Status</FieldLabel>
          <FieldInput value={status} onChangeText={setStatus} />
        </Section>

        {/* Checklist Kondisi */}
        <Section>
          <SectionTitle>Checklist Kondisi</SectionTitle>
          {checklist.map((item, idx) => (
            <View
              key={idx}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
            >
              <FieldInput
                style={{ flex: 1, marginBottom: 0 }}
                value={item}
                onChangeText={txt => updateChecklistItem(txt, idx)}
              />
              {checklist.length > 1 && (
                <Pressable
                  onPress={() => removeChecklistItem(idx)}
                  style={{ marginLeft: 8, padding: 6, backgroundColor: C.primary, borderRadius: 4 }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>–</Text>
                </Pressable>
              )}
            </View>
          ))}
          <Pressable
            onPress={addChecklistItem}
            style={{ backgroundColor: C.primary, padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>+ Tambah Checklist</Text>
          </Pressable>
        </Section>

        {/* Waktu & Interval */}
        <Section>
          <SectionTitle>Waktu & Interval</SectionTitle>
          <FieldLabel>Tgl Exp</FieldLabel>
          <Pressable onPress={() => setShowExpPicker(true)}>
            <FieldInput value={tglExp} editable={false} />
          </Pressable>
          <FieldLabel>Tgl Terakhir Maintenance</FieldLabel>
          <Pressable onPress={() => setShowMaintPicker(true)}>
            <FieldInput value={tglMaint} editable={false} />
          </Pressable>
          <FieldLabel>Interval (hari)</FieldLabel>
          <FieldInput value={interval} onChangeText={setInterval} keyboardType="numeric" />
        </Section>

        {/* Keterangan */}
        <Section>
          <SectionTitle>Keterangan (opsional)</SectionTitle>
          <FieldInput
            value={keterangan}
            onChangeText={setKeterangan}
            multiline
            style={{ minHeight: 80 }}
          />
        </Section>

        {/* Tombol Simpan */}
        <ButtonBase onPress={handleSubmit} disabled={loading}>
          <ButtonText>Simpan Perubahan</ButtonText>
        </ButtonBase>
      </Form>

      {/* Date Pickers */}
      <DateTimePickerModal
        isVisible={showExpPicker}
        mode="date"
        onConfirm={d => {
          setShowExpPicker(false);
          setTglExp(d.toISOString().slice(0, 10));
        }}
        onCancel={() => setShowExpPicker(false)}
      />
      <DateTimePickerModal
        isVisible={showMaintPicker}
        mode="date"
        onConfirm={d => {
          setShowMaintPicker(false);
          setTglMaint(d.toISOString().slice(0, 10));
        }}
        onCancel={() => setShowMaintPicker(false)}
      />
    </Container>
  );
}
