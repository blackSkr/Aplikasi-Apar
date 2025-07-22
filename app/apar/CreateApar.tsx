// apar/CRUDAparTest.tsx

import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
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
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import QRCodeSVG from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import styled from 'styled-components/native';

// --- Helpers: sanitasi & validasi ---
const sanitize = (str: string): string =>
  str.replace(/<[^>]+>/g, '').trim();

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
    idApar, noApar, lokasi, jenis,
    checklist, status, tglExp, tglMaint, interval
  } = fields;

  // if (!/^[A-Z0-9]{1,26}$/.test(idApar))
  //   return 'ID APAR wajib 1–26 karakter, huruf besar A–Z dan digit saja.';
  if (!/^[\w\s\-]{1,50}$/.test(noApar))
    return 'No. APAR maksimal 50 karakter, hanya huruf, angka, spasi, dan tanda “-”.';
  if (lokasi.length > 255) return 'Lokasi maksimal 255 karakter.';
  if (!jenis) return 'Jenis APAR harus dipilih.';
  if (jenis.length > 100) return 'Jenis APAR maksimal 100 karakter.';
  const cleanedList = checklist.map(sanitize).filter(s => s !== '');
  if (cleanedList.length === 0)
    return 'Minimal satu checklist kondisi harus diisi.';
  if (cleanedList.some(item => item.length > 200))
    return 'Setiap checklist maksimal 200 karakter.';
  const allowedStatus = ['Sehat', 'Maintenance', 'Expired'];
  if (!allowedStatus.includes(status))
    return `Status harus salah satu: ${allowedStatus.join(', ')}.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tglExp) || Number.isNaN(Date.parse(tglExp)))
    return 'Format Tgl. Exp harus YYYY-MM-DD dan tanggal valid.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tglMaint) || Number.isNaN(Date.parse(tglMaint)))
    return 'Format Tgl. Terakhir Maintenance harus YYYY-MM-DD dan tanggal valid.';
  const num = parseInt(interval, 10);
  if (Number.isNaN(num) || num <= 0 || num > 365)
    return 'Interval Maintenance harus angka bulat antara 1–365 hari.';

  return null;
}

// ——————————————————————————————————————————————

const Colors = {
  primary: '#D50000',
  background: '#FFFFFF',
  text: '#212121',
  border: '#ECECEC',
};

const Container = styled(KeyboardAvoidingView).attrs({
  behavior: Platform.OS === 'ios' ? 'padding' : 'height',
})`
  flex: 1;
  background-color: ${Colors.background};
`;

const Header = styled.View`
  padding: 16px;
  background-color: ${Colors.primary};
`;

const Title = styled.Text`
  color: #fff;
  font-size: 22px;
  font-weight: bold;
`;

const Form = styled(ScrollView)`
  padding: 16px;
`;

const Label = styled.Text`
  font-size: 14px;
  color: ${Colors.text};
  margin-bottom: 4px;
`;

const Input = styled(TextInput)`
  border: 1px solid ${Colors.border};
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 12px;
`;

const PickerContainer = styled.View`
  border: 1px solid ${Colors.border};
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
  background-color: ${Colors.primary};
  border-radius: 4px;
`;

const RemoveText = styled.Text`
  color: #fff;
  font-weight: bold;
`;

const AddBtn = styled.Pressable`
  background-color: ${Colors.primary};
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
  background-color: ${Colors.primary};
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

const CRUDAparTest: React.FC = () => {
  const router = useRouter();

  // State form
  const [idApar, setIdApar] = useState('');
  const [noApar, setNoApar] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [jenis, setJenis] = useState('');
  const [checklist, setChecklist] = useState<string[]>(['']);
  const [status, setStatus] = useState('');
  const [tglExp, setTglExp] = useState('');
  const [tglMaint, setTglMaint] = useState('');
  const [interval, setInterval] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [showExpPicker, setShowExpPicker] = useState(false);
  const [showMaintPicker, setShowMaintPicker] = useState(false);

  // Ref untuk capture
  const svgContainerRef = useRef<View>(null);

  const updateItem = (text: string, i: number) => {
    const tmp = [...checklist];
    tmp[i] = text;
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
      keterangan: sanitize(keterangan),
    };
    const err = validateAll(clean);
    if (err) return Alert.alert('Error Validasi', err);

    const keperluan_check = clean.checklist.filter(i => i).join('; ');
    try {
      const res = await fetch('http://192.168.245.1:3000/api/apar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_apar: clean.idApar,
          no_apar: clean.noApar,
          lokasi_apar: clean.lokasi,
          jenis_apar: clean.jenis,
          keperluan_check,
          qr_code_apar: clean.idApar,
          status_apar: clean.status,
          tgl_exp: clean.tglExp,
          tgl_terakhir_maintenance: clean.tglMaint,
          interval_maintenance: parseInt(clean.interval, 10),
          keterangan: clean.keterangan,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.message || 'Gagal menambah APAR');
      }
      Alert.alert('Sukses', 'Data APAR berhasil ditambahkan.', [
        { text: 'OK', onPress: () => router.push('/apar/ReadApar') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Fungsi capture & save/share
  const saveCustomQRCode = () => {
    if (!svgContainerRef.current) {
      Alert.alert('Error', 'View belum siap untuk di‑capture');
      return;
    }

    // tunggu hingga semua rendering (QR & teks) selesai
    InteractionManager.runAfterInteractions(async () => {
      try {
        // capture jadi tmp file PNG
        const uri = await captureRef(svgContainerRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });

        // generate filename: jenis_idApar.png
        const cleanJenis = jenis.trim().replace(/\s+/g, '-').toLowerCase() || 'apar';
        const filename = `${cleanJenis}_${idApar.trim()}.png`;

        // (opsional) save to cache with that name (jika perlu)
        const cachePath = FileSystem.cacheDirectory + filename;
        await FileSystem.moveAsync({ from: uri, to: cachePath });

        // simpan ke Gallery
        const { status: perm } = await MediaLibrary.requestPermissionsAsync();
        if (perm === 'granted') {
          const asset = await MediaLibrary.createAssetAsync(cachePath);
          await MediaLibrary.createAlbumAsync('QR APAR', asset, false);
          Alert.alert('Sukses', `Tersimpan sebagai ${filename} di album "QR APAR"`);
        }

        // share / download dialog
        await Sharing.shareAsync(cachePath, {
          mimeType: 'image/png',
          dialogTitle: `Share ${filename}`,
          UTI: 'public.png',
        });
      } catch (e: any) {
        Alert.alert('Gagal', e.message);
      }
    });
  };

  return (
    <Container>
      <Header>
        <Title>Tambah APAR</Title>
      </Header>
      <Form>
        {/* ID APAR */}
        <Label>ID APAR</Label>
        <Input
          value={idApar}
          onChangeText={setIdApar}
          placeholder="AP00016 (A–Z,0–9 max 26)"
          autoCapitalize="characters"
          maxLength={26}
        />

        {/* Custom QR Layout & Download */}
        {idApar.trim().length > 0 && (
          <>
            <View
              ref={svgContainerRef}
              collapsable={false}
              style={{
                alignSelf: 'center',
                padding: 16,
                backgroundColor: Colors.background,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 8,
                marginVertical: 16,
              }}
            >
              {/* Header */}
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
                PT. Contoh Fire Safety
              </Text>
              {/* QR Code */}
              <QRCodeSVG value={idApar.trim()} size={180} />
              {/* Footer */}
              <Text style={{ marginTop: 8, fontSize: 16 }}>
                Kode APAR: <Text style={{ fontWeight: 'bold' }}>{idApar.trim()}</Text>
              </Text>
            </View>
            <Button title="Download Layout QR" onPress={saveCustomQRCode} />
          </>
        )}

        {/* Sisa form: No. APAR, Lokasi, Jenis, Checklist, dsb. */}
        <Label>No. APAR</Label>
        <Input
          value={noApar}
          onChangeText={setNoApar}
          placeholder="max 50 chars"
          maxLength={50}
        />

        <Label>Lokasi APAR</Label>
        <Input
          value={lokasi}
          onChangeText={setLokasi}
          placeholder="max 255 chars"
          maxLength={255}
        />

        <Label>Jenis APAR</Label>
        <PickerContainer>
          <Picker
            selectedValue={jenis}
            onValueChange={val => setJenis(val)}
          >
            <Picker.Item
              label="Pilih jenis APAR..."
              value=""
              enabled={false}
              color="#999"
            />
            <Picker.Item label="APAR" value="apar" />
            <Picker.Item label="Sprinkle" value="sprinkle" />
            <Picker.Item label="Smoke Detector" value="smoke detector" />
          </Picker>
        </PickerContainer>

        <Label>Checklist Kondisi</Label>
        {checklist.map((item, i) => (
          <Row key={i}>
            <Input
              style={{ flex: 1, marginBottom: 0 }}
              placeholder={`Checklist #${i + 1} (max 200)`}
              value={item}
              onChangeText={text => updateItem(text, i)}
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

        <Label>Status APAR</Label>
        <Input
          value={status}
          onChangeText={setStatus}
          placeholder="Sehat / Maintenance / Expired"
        />

        <Label>Tgl. Exp</Label>
        <Pressable onPress={() => setShowExpPicker(true)}>
          <Input value={tglExp} editable={false} placeholder="pilih tanggal" />
        </Pressable>

        <Label>Tgl. Terakhir Maintenance</Label>
        <Pressable onPress={() => setShowMaintPicker(true)}>
          <Input value={tglMaint} editable={false} placeholder="pilih tanggal" />
        </Pressable>

        <Label>Interval Maintenance (hari)</Label>
        <Input
          value={interval}
          onChangeText={setInterval}
          placeholder="1–365"
          keyboardType="numeric"
          maxLength={3}
        />

        <Label>Keterangan (opsional)</Label>
        <Input
          value={keterangan}
          onChangeText={setKeterangan}
          placeholder="Catatan tambahan (max 500)"
          multiline
          maxLength={500}
        />

        <SubmitBtn onPress={handleSubmit}>
          <SubmitText>Simpan APAR</SubmitText>
        </SubmitBtn>
      </Form>

      {/* Date pickers */}
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
};

export default CRUDAparTest;
