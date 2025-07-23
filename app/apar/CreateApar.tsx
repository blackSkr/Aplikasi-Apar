// app/apar/CreateApar.tsx
import React, { useState, useRef } from 'react';
import {
  Alert,
  Button,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import QRCodeSVG from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Picker } from '@react-native-picker/picker';
import styled from 'styled-components/native';
import { safeFetchOffline } from '../../utils/safeFetchOffline';

// ——— Helpers —————————————————————————————————————————
const sanitize = (str: string) => str.replace(/<[^>]+>/g, '').trim();

function validateAll(fields: {
  idApar: string;
  noApar: string;
  lokasi: string;
  jenis: string;
  checklist: string[];
  status: string;
  tglExp: string;
  tglMaint: string;
  interval: string;
}) {
  const {
    idApar,
    noApar,
    lokasi,
    jenis,
    checklist,
    status,
    tglExp,
    tglMaint,
    interval,
  } = fields;
  if (!/^[A-Z0-9\-]{1,26}$/.test(idApar))
    return 'ID APAR wajib 1–26 karakter, A–Z, 0–9 atau “-”.';
  if (!/^[\w\s\-]{1,50}$/.test(noApar))
    return 'No. APAR maksimal 50 karakter, huruf/angka/spasi/“-”.';
  if (lokasi.length > 255) return 'Lokasi maksimal 255 karakter.';
  if (!jenis) return 'Jenis APAR harus dipilih.';
  const cleaned = checklist.map(sanitize).filter(i => i);
  if (!cleaned.length) return 'Minimal satu checklist.';
  if (!/^(Sehat|Maintenance|Expired)$/.test(status))
    return 'Status: Sehat, Maintenance, atau Expired.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tglExp)) return 'Tgl Exp format YYYY-MM-DD.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tglMaint))
    return 'Tgl Maint format YYYY-MM-DD.';
  const n = parseInt(interval, 10);
  if (isNaN(n) || n < 1 || n > 365)
    return 'Interval harus angka 1–365 hari.';
  return null;
}

// ——— Styled Components —————————————————————————————————
const C = {
  primary: '#D50000',
  bg: '#FFFFFF',
  text: '#212121',
  border: '#ECECEC',
};
const Container = styled(KeyboardAvoidingView).attrs({
  behavior: Platform.OS === 'ios' ? 'padding' : 'height',
})`
  flex: 1;
  background-color: ${C.bg};
`;
const Header = styled.View`
  padding: 16px;
  background-color: ${C.primary};
`;
const Title = styled.Text`
  color: #fff;
  font-size: 22px;
  font-weight: bold;
`;
const Form = styled(ScrollView)`padding: 16px;`;
const Label = styled.Text`
  font-size: 14px;
  color: ${C.text};
  margin-bottom: 4px;
`;
const Input = styled(TextInput)`
  border: 1px solid ${C.border};
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 12px;
`;
const PickerContainer = styled.View`
  border: 1px solid ${C.border};
  border-radius: 6px;
  margin-bottom: 12px;
  overflow: hidden;
`;
const Row = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 8px;
`;
const RemoveBtn = styled.Pressable`
  margin-left: 8px;
  padding: 6px;
  background-color: ${C.primary};
  border-radius: 4px;
`;
const RemoveText = styled.Text`
  color: #fff;
  font-weight: bold;
`;
const AddBtn = styled.Pressable`
  background-color: ${C.primary};
  padding: 12px;
  border-radius: 8px;
  align-items: center;
  margin-bottom: 16px;
`;
const AddText = styled.Text`
  color: #fff;
  font-weight: bold;
`;
const SubmitBtn = styled.Pressable`
  background-color: ${C.primary};
  padding: 14px;
  border-radius: 8px;
  align-items: center;
  margin-top: 12px;
  margin-bottom: 56px;
`;
const SubmitText = styled.Text`
  color: #fff;
  font-size: 16px;
  font-weight: bold;
`;
const QRContainer = styled(View)`
  align-self: center;
  padding: 16px;
  background-color: ${C.bg};
  border: 1px solid ${C.border};
  border-radius: 8px;
  margin-vertical: 16px;
`;

// ——— Component ——————————————————————————————————————
export default function CreateApar() {
  const router = useRouter();
  const [idApar, setIdApar] = useState('');
  const [noApar, setNoApar] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [jenis, setJenis] = useState('');
  const [checklist, setChecklist] = useState<string[]>(['']);
  const [status, setStatus] = useState('');
  const [tglExp, setTglExp] = useState('');
  const [tglMaint, setTglMaint] = useState('');
  const [interval, setInterval] = useState('');
  const [ket, setKet] = useState('');
  const [showExpPicker, setShowExpPicker] = useState(false);
  const [showMaintPicker, setShowMaintPicker] = useState(false);
  const qrRef = useRef<View>(null);

  const updateItem = (txt: string, i: number) => {
    const tmp = [...checklist];
    tmp[i] = txt;
    setChecklist(tmp);
  };
  const addItem = () => setChecklist(prev => [...prev, '']);
  const removeItem = (i: number) =>
    setChecklist(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    const clean = {
      idApar: sanitize(idApar),
      noApar: sanitize(noApar),
      lokasi: sanitize(lokasi),
      jenis: sanitize(jenis),
      checklist: checklist.map(sanitize),
      status: sanitize(status),
      tglExp: sanitize(tglExp),
      tglMaint: sanitize(tglMaint),
      interval: sanitize(interval),
    };
    const err = validateAll(clean);
    if (err) return Alert.alert('Error Validasi', err);

    try {
      const res = await safeFetchOffline(
        'http://192.168.245.1:3000/api/apar',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_apar: clean.idApar,
            no_apar: clean.noApar,
            lokasi_apar: clean.lokasi,
            jenis_apar: clean.jenis,
            keperluan_check: clean.checklist.filter(i => i).join('; '),
            qr_code_apar: clean.idApar,
            status_apar: clean.status,
            tgl_exp: clean.tglExp,
            tgl_terakhir_maintenance: clean.tglMaint,
            interval_maintenance: parseInt(clean.interval, 10),
            keterangan: ket,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).message || 'Gagal');
      Alert.alert('Sukses', 'APAR berhasil ditambahkan.', [
        { text: 'OK', onPress: () => router.replace('/apar/ReadApar') },
      ]);
    } catch (e: any) {
      if (e.message === 'Offline') {
        return Alert.alert('Offline', 'Silakan coba lagi saat online.');
      }
      Alert.alert('Error', e.message);
    }
  };

  const saveQR = () => {
    if (!qrRef.current) return Alert.alert('Error', 'QR belum siap');
    InteractionManager.runAfterInteractions(async () => {
      try {
        const tmp = await captureRef(qrRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        const fn = `apar_${idApar}.png`;
        const dest = FileSystem.cacheDirectory + fn;
        await FileSystem.moveAsync({ from: tmp, to: dest });
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          const asset = await MediaLibrary.createAssetAsync(dest);
          await MediaLibrary.createAlbumAsync('QR APAR', asset, false);
          Alert.alert('Tersimpan', fn);
        }
        await Sharing.shareAsync(dest);
      } catch (e: any) {
        Alert.alert('Gagal', e.message);
      }
    });
  };

  return (
    <Container>
      <Header>
        <Title>Tambah APAR</Title>
      </Header>
      <Form>
        {/* ID APAR & QR */}
        <Label>ID APAR</Label>
        <Input
          value={idApar}
          onChangeText={setIdApar}
          placeholder="AP00001"
          autoCapitalize="characters"
          maxLength={26}
        />
        {idApar.trim() !== '' && (
          <>
            <QRContainer ref={qrRef} collapsable={false}>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>
                PT. Contoh Fire Safety
              </Text>
              <QRCodeSVG value={idApar} size={180} />
              <Text style={{ marginTop: 8 }}>
                Kode APAR:{' '}
                <Text style={{ fontWeight: 'bold' }}>{idApar}</Text>
              </Text>
            </QRContainer>
            <Button title="Download QR" onPress={saveQR} />
          </>
        )}

        {/* Sisa form fields… */}
        <Label>No. APAR</Label>
        <Input value={noApar} onChangeText={setNoApar} placeholder="50 chars max" />
        <Label>Lokasi</Label>
        <Input value={lokasi} onChangeText={setLokasi} placeholder="255 chars max" />
        <Label>Jenis</Label>
        <PickerContainer>
          <Picker selectedValue={jenis} onValueChange={setJenis}>
            <Picker.Item label="Pilih jenis..." value="" color="#999" />
            <Picker.Item label="APAR" value="apar" />
            <Picker.Item label="Sprinkle" value="sprinkle" />
            <Picker.Item label="Smoke Detector" value="smoke detector" />
          </Picker>
        </PickerContainer>

        <Label>Checklist Kondisi</Label>
        {checklist.map((it, i) => (
          <Row key={i}>
            <Input
              style={{ flex: 1, marginBottom: 0 }}
              value={it}
              onChangeText={txt => updateItem(txt, i)}
              placeholder={`#${i + 1}`}
              maxLength={200}
            />
            {checklist.length > 1 && (
              <RemoveBtn onPress={() => removeItem(i)}>
                <RemoveText>–</RemoveText>
              </RemoveBtn>
            )}
          </Row>
        ))}
        <AddBtn onPress={addItem}>
          <AddText>+ Tambah Checklist</AddText>
        </AddBtn>

        <Label>Status</Label>
        <Input value={status} onChangeText={setStatus} placeholder="Sehat / Maintenance / Expired" />

        <Label>Tgl Exp</Label>
        <Pressable onPress={() => setShowExpPicker(true)}>
          <Input value={tglExp} editable={false} placeholder="YYYY-MM-DD" />
        </Pressable>

        <Label>Tgl Maint</Label>
        <Pressable onPress={() => setShowMaintPicker(true)}>
          <Input value={tglMaint} editable={false} placeholder="YYYY-MM-DD" />
        </Pressable>

        <Label>Interval (hari)</Label>
        <Input
          value={interval}
          onChangeText={setInterval}
          placeholder="1–365"
          keyboardType="numeric"
          maxLength={3}
        />

        <Label>Keterangan (opsional)</Label>
        <Input
          value={ket}
          onChangeText={setKet}
          placeholder="Catatan tambahan"
          multiline
          maxLength={500}
        />

        <SubmitBtn onPress={handleSubmit}>
          <SubmitText>Simpan</SubmitText>
        </SubmitBtn>
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
