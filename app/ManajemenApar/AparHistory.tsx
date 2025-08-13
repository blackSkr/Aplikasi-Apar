// app/ManajemenApar/AparHistory.tsx
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from 'react-native';
import styled from 'styled-components/native';

import Colors from '@/constants/Colors';
import { useBadge } from '@/context/BadgeContext';
import { baseUrl } from '@/src/config';
import { safeFetchOffline } from '@/utils/ManajemenOffline';

// ---------- Types dari BE ----------
type StatusResp = {
  success: boolean;
  data: {
    Id: number;
    TanggalPemeriksaan: string;
    Kondisi?: string | null;
    AparKode: string;
    LokasiNama: string;
    JenisNama: string;
    // mungkin ada field lain, tapi yang penting Id
  } | null;
};

type DetailsResp = {
  success: boolean;
  data: {
    Id: number;
    PeralatanId: number;
    TanggalPemeriksaan: string;
    Kondisi?: string | null;
    CatatanMasalah?: string | null;
    Rekomendasi?: string | null;
    TindakLanjut?: string | null;
    Tekanan?: number | null;
    JumlahMasalah?: number | null;
    PetugasBadge?: string | null;

    AparKode: string;
    LokasiNama: string;
    JenisNama: string;

    checklist?: Array<{
      ChecklistId: number;
      Dicentang: 0 | 1;
      Keterangan?: string | null;
      Pertanyaan: string;
    }>;
  } | null;
};

// ---------- Utils ----------
const fmtDate = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

// =========================================================
// Main
// =========================================================
export default function AparHistoryScreen() {
  const params = useLocalSearchParams<{ id?: string; no?: string }>();
  const aparId = useMemo(() => Number(params?.id ?? NaN), [params?.id]);
  const { badgeNumber } = useBadge();

  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<null | 'network' | 'server-5xx'>(null);
  const [statusData, setStatusData] = useState<StatusResp['data'] | null>(null);
  const [details, setDetails] = useState<DetailsResp['data'] | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(aparId)) {
      setStatusData(null);
      setDetails(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setOffline(null);

    try {
      // 1) Ambil ID pemeriksaan terakhir
      const sres = await safeFetchOffline(
        `${baseUrl}/api/perawatan/status/${aparId}?badge=${encodeURIComponent(badgeNumber || '')}`,
        { method: 'GET' }
      );
      const sjson = await sres.json();
      if (sjson?.offline) {
        setOffline(sjson.reason === 'server-5xx' ? 'server-5xx' : 'network');
        setStatusData(null);
        setDetails(null);
        setLoading(false);
        return;
      }
      const s: StatusResp = sjson;
      setStatusData(s.data ?? null);

      // 2) Kalau ada Id terakhir → ambil details + checklist
      if (s?.data?.Id) {
        const did = s.data.Id;
        const dres = await safeFetchOffline(
          `${baseUrl}/api/perawatan/details/${did}`,
          { method: 'GET' }
        );
        const djson = await dres.json();
        if (djson?.offline) {
          setOffline(djson.reason === 'server-5xx' ? 'server-5xx' : 'network');
          setDetails(null);
        } else {
          const d: DetailsResp = djson;
          setDetails(d.data ?? null);
        }
      } else {
        setDetails(null);
      }
    } catch {
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [aparId, badgeNumber]);

  useEffect(() => { load(); }, [load]);

  // ---------- Derived UI data ----------
  const noApar = details?.AparKode ?? statusData?.AparKode ?? params?.no ?? '-';
  const lokasi = details?.LokasiNama ?? statusData?.LokasiNama ?? '-';
  const jenis  = details?.JenisNama ?? statusData?.JenisNama ?? '-';
  const petugas = details?.PetugasBadge ?? '-';
  const selesai = fmtDate(details?.TanggalPemeriksaan ?? statusData?.TanggalPemeriksaan ?? null);

  const checklist = details?.checklist ?? [];

  // ---------- Render ----------
  if (loading) {
    return (
      <Center>
        <ActivityIndicator size="large" color={Colors.primary} />
        <LoadingText>Memuat riwayat…</LoadingText>
      </Center>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f6f6' }}>
      {offline && (
        <Banner>
          <BannerText>{offline === 'server-5xx' ? '🛠️ Server bermasalah' : '📴 Offline'} — menampilkan data terbatas.</BannerText>
        </Banner>
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Card>
          <CardTitle>Ringkasan Terakhir</CardTitle>
          <Row>
            <Label>No. APAR</Label>
            <Value>{noApar}</Value>
          </Row>
          <Row>
            <Label>Petugas</Label>
            <Value>{petugas || '-'}</Value>
          </Row>
          <Row>
            <Label>Selesai</Label>
            <Value>{selesai}</Value>
          </Row>
        </Card>

        <Card>
          <CardTitle>Info Umum</CardTitle>
          <Row>
            <Label>Lokasi</Label>
            <Value>{lokasi}</Value>
          </Row>
          <Row>
            <Label>Jenis</Label>
            <Value>{jenis}</Value>
          </Row>
          <Row>
            <Label>ID APAR</Label>
            <Value>{Number.isFinite(aparId) ? String(aparId) : '-'}</Value>
          </Row>
        </Card>

        <Card>
          <CardTitle>Checklist</CardTitle>
          {checklist.length === 0 ? (
            <Empty>- Tidak ada checklist -</Empty>
          ) : (
            <View>
              {checklist.map((c, idx) => (
                <CLRow key={`${c.ChecklistId}-${idx}`}>
                  <CLQ>{c.Pertanyaan}</CLQ>
                  <CLAns good={!!c.Dicentang}>{c.Dicentang ? 'Baik' : 'Tidak'}</CLAns>
                  {c.Keterangan ? <CLKet>Catatan: {c.Keterangan}</CLKet> : null}
                </CLRow>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- styled ----------
const Center = styled.View`flex:1; align-items:center; justify-content:center; background:#fff;`;
const LoadingText = styled(Text)`margin-top:8px; color:${Colors.subtext};`;

const Banner = styled.View`padding:10px 14px; background:#fff3cd;`;
const BannerText = styled(Text)`color:#a66c00; font-size:13px;`;

const Card = styled.View`
  background:#fff; margin:12px 14px 0 14px; border-radius:12px; padding:14px;
  border:1px solid #eee;
`;
const CardTitle = styled(Text)`font-weight:800; color:${Colors.text}; margin-bottom:10px; font-size:16px;`;
const Row = styled.View`flex-direction:row; justify-content:space-between; padding:8px 2px;`;
const Label = styled(Text)`color:${Colors.subtext};`;
const Value = styled(Text)`color:${Colors.text}; font-weight:700;`;

const Empty = styled(Text)`text-align:center; color:${Colors.subtext}; padding:18px 0;`;

const CLRow = styled.View`padding:10px 2px; border-top-width:1px; border-top-color:#f0f0f0;`;
const CLQ   = styled(Text)`color:${Colors.text}; margin-bottom:6px;`;
const CLAns = styled(Text)<{good:boolean}>`
  color: ${({good}) => good ? Colors.success : Colors.error};
  font-weight:800; margin-bottom:4px;
`;
const CLKet = styled(Text)`color:${Colors.subtext}; font-size:12px;`;
