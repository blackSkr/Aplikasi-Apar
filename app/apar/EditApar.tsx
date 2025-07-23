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
  primary:'#D50000', background:'#FAFAFA', card:'#FFF',
  text:'#212121', label:'#555', border:'#E0E0E0', secondary:'#757575'
};

const Container = styled(KeyboardAvoidingView).attrs({
  behavior: Platform.OS==='ios'?'padding':'height'
})`flex:1; background-color:${C.background};`;
const Header = styled(View)`background-color:${C.primary}; padding:16px;
  border-bottom-left-radius:16px; border-bottom-right-radius:16px;`;
const HeaderTitle = styled(Text)`color:#fff; font-size:24px; font-weight:bold;`;
const Form = styled(ScrollView)`flex:1; padding:20px;`;
const Section = styled(View)`margin-bottom:24px;`;
const SectionTitle = styled(Text)`font-size:18px; color:${C.secondary};
  margin-bottom:8px; font-weight:bold;`;
const FieldLabel = styled(Text)`font-size:14px; color:${C.label};
  margin-bottom:4px;`;
const FieldInput = styled(TextInput)`background-color:${C.card};
  border:1px solid ${C.border}; border-radius:8px; padding:12px;
  color:${C.text}; margin-bottom:12px;`;
const Card = styled(View)`background-color:${C.card}; border-radius:12px;
  padding:16px; margin-vertical:16px; align-items:center; elevation:3;`;
const QRTitle = styled(Text)`font-size:16px; font-weight:bold;
  color:${C.text}; margin-bottom:8px;`;
const ButtonBase = styled(Pressable)<{disabled?:boolean}>`
  background-color:${({disabled})=>disabled?C.border:C.primary}; padding:14px;
  border-radius:8px; align-items:center; margin-top:12px; margin-bottom:56px;
  opacity:${({disabled})=>disabled?0.6:1};`;
const ButtonText = styled(Text)`color:#fff; font-size:16px; font-weight:bold;`;
const SecondaryButton = styled(Pressable)`background-color:${C.card};
  border:1px solid ${C.primary}; padding:12px; border-radius:8px;
  align-items:center; margin-bottom:16px;`;
const SecondaryText = styled(Text)`color:${C.primary}; font-size:16px;
  font-weight:bold;`;

export default function EditApar() {
  const router = useRouter();
  const { id_apar: origId } = useLocalSearchParams<{id_apar:string}>();
  const [loading,setLoading]=useState(true);
  const [idApar,setIdApar]=useState(origId||'');
  const [noApar,setNoApar]=useState('');
  const [lokasi,setLokasi]=useState('');
  const [jenis,setJenis]=useState('');
  const [checklist,setChecklist]=useState<string[]>([]);
  const [status,setStatus]=useState<'Sehat'|'Maintenance'|'Expired'|''>('');
  const [tglExp,setTglExp]=useState('');
  const [tglMaint,setTglMaint]=useState('');
  const [interval,setInterval]=useState('');
  const [ket,setKet]=useState('');
  const [showExpPicker,setShowExpPicker]=useState(false);
  const [showMaintPicker,setShowMaintPicker]=useState(false);
  const qrRef=useRef<View>(null);

  useEffect(()=>{
    (async()=>{
      try {
        const res=await safeFetchOffline(`${API_BASE}/apar/${origId}`);
        if(!res.ok)throw new Error(`HTTP ${res.status}`);
        const d=await res.json();
        setNoApar(d.no_apar);
        setLokasi(d.lokasi_apar);
        setJenis(d.jenis_apar);
        setStatus(d.status_apar);
        setTglExp(d.tgl_exp.slice(0,10));
        setTglMaint(d.tgl_terakhir_maintenance.slice(0,10));
        setInterval(d.interval_maintenance.toString());
        setKet(d.keterangan||'');
        let items:string[]=[];
        try {
          const p=JSON.parse(d.keperluan_check);
          if(Array.isArray(p))items=p;
        } catch{
          items=d.keperluan_check.split(';').map((s:string)=>s.trim()).filter((s:string)=>s);
        }
        setChecklist(items.length?items:['']);
      } catch(e:any){
        Alert.alert(e.message==='Offline'?'Offline':'Error memuat data',
          e.message==='Offline'?'Tidak dapat memuat saat offline.':e.message);
      } finally{setLoading(false);}
    })();
  },[origId]);

  const updateItem=(t:string,i:number)=>{
    const a=[...checklist]; a[i]=t; setChecklist(a);
  };
  const addItem=()=>setChecklist(p=>[...p,'']);
  const removeItem=(i:number)=>setChecklist(p=>p.filter((_,j)=>j!==i));

  const handleSubmit=async()=>{
    if(!noApar.trim()||!lokasi.trim()||!jenis.trim()||!status.trim()||
       !tglExp.trim()||!tglMaint.trim()||!interval.trim()||
       checklist.every(i=>!i.trim())){
      return Alert.alert('Error','Lengkapi semua field sebelum menyimpan.');
    }
    try{
      await safeFetchOffline(`${API_BASE}/apar/${origId}`,{
        method:'PUT', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          id_apar:idApar,no_apar:noApar,lokasi_apar:lokasi,jenis_apar:jenis,
          keperluan_check:JSON.stringify(checklist.filter(i=>i.trim())),
          qr_code_apar:idApar,status_apar:status,tgl_exp:tglExp,
          tgl_terakhir_maintenance:tglMaint,
          interval_maintenance:parseInt(interval,10),keterangan:ket
        })
      });
      Alert.alert('Sukses','Data APAR berhasil diperbarui.',[
        {text:'OK',onPress:()=>router.back()}
      ]);
    }catch(e:any){
      Alert.alert(e.message==='Offline'?'Offline':'Error menyimpan',
        e.message==='Offline'?'Silakan ulang saat online.':e.message);
    }
  };

  const handleDownloadQR=()=>{
    if(!qrRef.current)return Alert.alert('Error','QR belum siap diunduh');
    InteractionManager.runAfterInteractions(async()=>{
      try{
        const uri=await captureRef(qrRef,{format:'png',quality:1,result:'tmpfile'});
        const fn=`apar_${idApar}.png`; const dest=FileSystem.cacheDirectory+fn;
        await FileSystem.moveAsync({from:uri,to:dest});
        const {status:perm}=await MediaLibrary.requestPermissionsAsync();
        if(perm==='granted'){
          const asset=await MediaLibrary.createAssetAsync(dest);
          await MediaLibrary.createAlbumAsync('QR APAR',asset,false);
          Alert.alert('Tersimpan',fn);
        }else Alert.alert('Error','Izin penyimpanan ditolak');
      }catch(e:any){
        Alert.alert('Gagal download',e.message);
      }
    });
  };

  if(loading){
    return <Container><ActivityIndicator size="large" style={{marginTop:80}}/></Container>;
  }

  return (
    <Container>
      <Header><HeaderTitle>Edit APAR</HeaderTitle></Header>
      <Form>
        <Section>
          <SectionTitle>Identitas APAR</SectionTitle>
          <FieldLabel>No. APAR</FieldLabel>
          <FieldInput value={noApar} onChangeText={setNoApar}/>
          <FieldLabel>QR Code</FieldLabel>
          <Card ref={qrRef} collapsable={false}>
            <QRTitle>{idApar}</QRTitle>
            <QRCodeSVG value={idApar} size={140}/>
          </Card>
          <SecondaryButton onPress={handleDownloadQR}>
            <SecondaryText>Download QR ke Gallery</SecondaryText>
          </SecondaryButton>
        </Section>
        <Section>
          <SectionTitle>Detail APAR</SectionTitle>
          <FieldLabel>Lokasi</FieldLabel>
          <FieldInput value={lokasi} onChangeText={setLokasi}/>
          <FieldLabel>Jenis</FieldLabel>
          <FieldInput value={jenis} onChangeText={setJenis}/>
          <FieldLabel>Status</FieldLabel>
          <FieldInput value={status} onChangeText={setStatus}/>
        </Section>
        <Section>
          <SectionTitle>Checklist Kondisi</SectionTitle>
          {checklist.map((it,idx)=>(
            <View key={idx} style={{flexDirection:'row',alignItems:'center',marginBottom:8}}>
              <FieldInput style={{flex:1,marginBottom:0}} value={it}
                onChangeText={txt=>updateItem(txt,idx)}/>
              {checklist.length>1&&(
                <Pressable onPress={()=>removeItem(idx)}
                  style={{marginLeft:8,padding:6,backgroundColor:C.primary,borderRadius:4}}>
                  <Text style={{color:'white',fontWeight:'bold'}}>–</Text>
                </Pressable>
              )}
            </View>
          ))}
          <Pressable onPress={addItem}
            style={{backgroundColor:C.primary,padding:12,borderRadius:8,alignItems:'center',marginBottom:16}}>
            <Text style={{color:'white',fontWeight:'bold'}}>+ Tambah Checklist</Text>
          </Pressable>
        </Section>
        <Section>
          <SectionTitle>Waktu & Interval</SectionTitle>
          <FieldLabel>Tgl Exp</FieldLabel>
          <Pressable onPress={()=>setShowExpPicker(true)}>
            <FieldInput value={tglExp} editable={false}/>
          </Pressable>
          <FieldLabel>Tgl Terakhir Maintenance</FieldLabel>
          <Pressable onPress={()=>setShowMaintPicker(true)}>
            <FieldInput value={tglMaint} editable={false}/>
          </Pressable>
          <FieldLabel>Interval (hari)</FieldLabel>
          <FieldInput value={interval} onChangeText={setInterval} keyboardType="numeric"/>
        </Section>
        <Section>
          <SectionTitle>Keterangan (opsional)</SectionTitle>
          <FieldInput value={ket} onChangeText={setKet} multiline style={{minHeight:80}}/>
        </Section>
        <ButtonBase onPress={handleSubmit} disabled={loading}>
          <ButtonText>Simpan Perubahan</ButtonText>
        </ButtonBase>
      </Form>
      <DateTimePickerModal isVisible={showExpPicker} mode="date"
        onConfirm={d=>{setShowExpPicker(false);setTglExp(d.toISOString().slice(0,10));}}
        onCancel={()=>setShowExpPicker(false)}/>
      <DateTimePickerModal isVisible={showMaintPicker} mode="date"
        onConfirm={d=>{setShowMaintPicker(false);setTglMaint(d.toISOString().slice(0,10));}}
        onCancel={()=>setShowMaintPicker(false)}/>
    </Container>
  );
}
