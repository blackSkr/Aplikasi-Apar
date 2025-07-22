// src/apar/EditApar.tsx

import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import QRCodeSVG from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import styled from 'styled-components/native';

const API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api'
    : 'http://localhost:3000/api';

const Colors = {
  primary: '#D50000',
  background: '#FAFAFA',
  card: '#FFFFFF',
  text: '#212121',
  label: '#555',
  border: '#E0E0E0',
  secondary: '#757575',
};

// --- Styled components ---
const Container = styled(KeyboardAvoidingView).attrs({
  behavior: Platform.OS === 'ios' ? 'padding' : 'height',
})`
  flex: 1;
  background-color: ${Colors.background};
`;
const Header = styled.View`
  background-color: ${Colors.primary};
  padding: 10px 20px 20px;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
`;
const HeaderTitle = styled.Text`
  color: #fff;
  font-size: 24px;
  font-weight: bold;
`;
const Form = styled(ScrollView)`
  flex: 1;
  padding: 20px;
`;
const Section = styled.View`
  margin-bottom: 24px;
`;
const SectionTitle = styled.Text`
  font-size: 18px;
  color: ${Colors.secondary};
  margin-bottom: 8px;
  font-weight: bold;
`;
const FieldLabel = styled.Text`
  font-size: 14px;
  color: ${Colors.label};
  margin-bottom: 4px;
`;
const FieldInput = styled.TextInput`
  background-color: ${Colors.card};
  border: 1px solid ${Colors.border};
  border-radius: 8px;
  padding: 12px;
  font-size: 16px;
  color: ${Colors.text};
`;
const Card = styled.View`
  background-color: ${Colors.card};
  border-radius: 12px;
  padding: 16px;
  margin-vertical: 16px;
  align-items: center;
  elevation: 3;
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.1;
  shadow-radius: 4px;
`;
const QRTitle = styled.Text`
  font-size: 18px;
  font-weight: bold;
  color: ${Colors.text};
  margin-bottom: 12px;
`;
const ButtonBase = styled.TouchableOpacity<{ disabled?: boolean }>`
  background-color: ${({ disabled }) =>
    disabled ? Colors.border : Colors.primary};
  padding: 14px;
  border-radius: 8px;
  align-items: center;
  margin-top: 12px;
  margin-bottom: 56px;
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
`;
const ButtonText = styled.Text`
  color: #fff;
  font-size: 16px;
  font-weight: bold;
`;
const SecondaryButton = styled.TouchableOpacity`
  background-color: ${Colors.card};
  border: 1px solid ${Colors.primary};
  padding: 12px;
  border-radius: 8px;
  align-items: center;
  margin-vertical: 8px;
`;
const SecondaryText = styled.Text`
  color: ${Colors.primary};
  font-size: 16px;
  font-weight: bold;
`;
const Row = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 8px;
`;
const RemoveBtn = styled.TouchableOpacity`
  margin-left: 8px;
  padding: 6px;
  background-color: ${Colors.primary};
  border-radius: 4px;
`;
const RemoveText = styled.Text`
  color: #fff;
  font-weight: bold;
`;
// --- end Styled components ---

export default function EditApar() {
  const router = useRouter();
  const { id_apar } = useLocalSearchParams<{ id_apar: string }>();

  // Untuk GET gunakan id_apar yang datang dari param,
  // tapi yang dikirim ulang di body adalah idApar (bisa diubah).
  const [origId] = useState(id_apar);
  const [idApar, setIdApar] = useState(id_apar);

  const [loading, setLoading] = useState(true);
  const [noApar, setNoApar] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [jenis, setJenis] = useState('');
  const [checklist, setChecklist] = useState<string[]>([]);
  const [status, setStatus] = useState<'Sehat'|'Maintenance'|'Expired'|''>('');
  const [tglExp, setTglExp] = useState('');
  const [tglMaint, setTglMaint] = useState('');
  const [interval, setInterval] = useState('');
  const [keterangan, setKeterangan] = useState('');

  const [showExpPicker, setShowExpPicker] = useState(false);
  const [showMaintPicker, setShowMaintPicker] = useState(false);

  const qrContainerRef = useRef<View>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/apar/${origId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // isi field
        setIdApar(data.id_apar);
        setNoApar(data.no_apar);
        setLokasi(data.lokasi_apar);
        setJenis(data.jenis_apar);
        setStatus(data.status_apar);
        setTglExp(data.tgl_exp.slice(0, 10));
        setTglMaint(data.tgl_terakhir_maintenance.slice(0, 10));
        setInterval(data.interval_maintenance.toString());
        setKeterangan(data.keterangan ?? '');

        // parsing keperluan_check: coba JSON, fallback semicolon
        const raw = data.keperluan_check as string;
        let list: string[] = [];
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.every(i => typeof i === 'string')) {
            list = parsed;
          } else {
            throw new Error();
          }
        } catch {
          list = raw.split('; ').filter(s => s.trim() !== '');
        }
        setChecklist(list.length ? list : ['']);
      } catch (e: any) {
        Alert.alert('Error memuat data', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [origId]);

  const updateItem = (txt: string, idx: number) => {
    const tmp = [...checklist];
    tmp[idx] = txt;
    setChecklist(tmp);
  };
  const addItem = () => setChecklist(prev => [...prev, '']);
  const removeItem = (idx: number) =>
    setChecklist(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (
      !idApar.trim() ||
      !noApar.trim() ||
      !lokasi.trim() ||
      !jenis.trim() ||
      !status.trim() ||
      !tglExp.trim() ||
      !tglMaint.trim() ||
      !interval.trim() ||
      checklist.every(it => !it.trim())
    ) {
      return Alert.alert(
        'Error',
        'Mohon lengkapi semua field dan minimal satu checklist.'
      );
    }

    try {
      const payload = {
        id_apar: idApar,
        no_apar: noApar,
        lokasi_apar: lokasi,
        jenis_apar: jenis,
        keperluan_check: JSON.stringify(checklist.filter(s => s.trim())),
        qr_code_apar: idApar,
        status_apar: status,
        tgl_exp: tglExp,
        tgl_terakhir_maintenance: tglMaint,
        interval_maintenance: parseInt(interval, 10),
        keterangan,
      };

      const res = await fetch(`${API_BASE}/apar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      Alert.alert('Sukses', 'Data APAR berhasil diupdate.', [
        {
          text: 'OK',
          onPress: () => router.push('/apar/ReadApar'),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error menyimpan', e.message);
    }
  };

  const downloadQR = () => {
    if (!qrContainerRef.current) {
      return Alert.alert('Error', 'QR belum siap di‑download');
    }
    InteractionManager.runAfterInteractions(async () => {
      try {
        const tmpUri = await captureRef(qrContainerRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        const cleanJenis =
          jenis.trim().replace(/\s+/g, '-').toLowerCase() || 'apar';
        const filename = `${cleanJenis}_${idApar}.png`;
        const dest = FileSystem.cacheDirectory + filename;
        await FileSystem.moveAsync({ from: tmpUri, to: dest });
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          const asset = await MediaLibrary.createAssetAsync(dest);
          await MediaLibrary.createAlbumAsync('QR APAR', asset, false);
          Alert.alert('Tersimpan', `${filename} berhasil disimpan.`);
        } else {
          Alert.alert('Izin ditolak', 'Tidak bisa menyimpan ke gallery.');
        }
      } catch (e: any) {
        Alert.alert('Gagal download', e.message);
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
        {/* Identitas */}
        <Section>
          <SectionTitle>Identitas APAR</SectionTitle>
          <FieldLabel>ID APAR</FieldLabel>
          <FieldInput value={idApar} onChangeText={setIdApar} />

          <Card ref={qrContainerRef} collapsable={false}>
            <QRTitle>{idApar}</QRTitle>
            <QRCodeSVG value={idApar} size={140} />
          </Card>
          <SecondaryButton onPress={downloadQR}>
            <SecondaryText>Download QR ke Gallery</SecondaryText>
          </SecondaryButton>
        </Section>

        {/* Detail */}
        <Section>
          <SectionTitle>Detail APAR</SectionTitle>
          <FieldLabel>No. APAR</FieldLabel>
          <FieldInput value={noApar} onChangeText={setNoApar} />
          <FieldLabel>Lokasi</FieldLabel>
          <FieldInput value={lokasi} onChangeText={setLokasi} />
          <FieldLabel>Jenis</FieldLabel>
          <FieldInput value={jenis} onChangeText={setJenis} />
          <FieldLabel>Status</FieldLabel>
          <FieldInput value={status} onChangeText={setStatus} />
        </Section>

        {/* Checklist */}
        <Section>
          <SectionTitle>Checklist Kondisi</SectionTitle>
          {checklist.map((it, i) => (
            <Row key={i}>
              <FieldInput
                style={{ flex: 1, marginBottom: 0 }}
                value={it}
                onChangeText={txt => updateItem(txt, i)}
              />
              {checklist.length > 1 && (
                <RemoveBtn onPress={() => removeItem(i)}>
                  <RemoveText>–</RemoveText>
                </RemoveBtn>
              )}
            </Row>
          ))}
          <SecondaryButton onPress={addItem}>
            <SecondaryText>+ Tambah Checklist</SecondaryText>
          </SecondaryButton>
        </Section>

        {/* Waktu & Interval */}
        <Section>
          <SectionTitle>Waktu & Interval</SectionTitle>
          <FieldLabel>Exp. Date</FieldLabel>
          <Pressable onPress={() => setShowExpPicker(true)}>
            <FieldInput value={tglExp} editable={false} />
          </Pressable>

          <FieldLabel>Terakhir Maintenance</FieldLabel>
          <Pressable onPress={() => setShowMaintPicker(true)}>
            <FieldInput value={tglMaint} editable={false} />
          </Pressable>

          <FieldLabel>Interval (hari)</FieldLabel>
          <FieldInput
            value={interval}
            onChangeText={setInterval}
            keyboardType="numeric"
          />
        </Section>

        {/* Keterangan */}
        <Section>
          <SectionTitle>Keterangan</SectionTitle>
          <FieldInput
            value={keterangan}
            onChangeText={setKeterangan}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 80 }}
          />
        </Section>

        <ButtonBase onPress={handleSubmit}>
          <ButtonText>Simpan Perubahan</ButtonText>
        </ButtonBase>
      </Form>

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
