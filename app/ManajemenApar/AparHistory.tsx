// app/ManajemenApar/AparHistory.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import styled from 'styled-components/native';

import Colors from '@/constants/Colors';
import { useBadge } from '@/context/BadgeContext';
import { baseUrl } from '@/src/config';
import { safeFetchOffline } from '@/utils/ManajemenOffline';

/* =========================
   Types dari BE
   ========================= */
type StatusResp = {
  success: boolean;
  data: {
    Id: number;
    TanggalPemeriksaan: string;
    Kondisi?: string | null;
    AparKode: string;
    LokasiNama: string;
    JenisNama: string;
    PetugasBadge?: string | null;
    NamaInterval?: string | null;
    IntervalBulan?: number | null;
    NextDueDate?: string | null;
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
    photos?: Array<{ FotoPath: string; UploadedAt: string }>;
  } | null;
};

type HistoryItem = {
  Id: number;
  TanggalPemeriksaan: string;
  Kondisi?: string | null;
  CatatanMasalah?: string | null;
  Rekomendasi?: string | null;
  TindakLanjut?: string | null;
  Tekanan?: number | null;
  JumlahMasalah?: number | null;
  PetugasBadge?: string | null;
  PetugasRole?: string | null;
  NamaInterval?: string | null;
  IntervalBulan?: number | null;
  NextDueDateAtTime?: string | null;
  AparKode: string;
  LokasiNama: string;
  JenisNama: string;
};
type HistoryResp = { success: boolean; data: HistoryItem[] };

/* =========================
   Utils
   ========================= */
const fmtDate = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const diffDaysFromToday = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const parseNumberParam = (v: string | string[] | undefined) => {
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};
const parseStringParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '-';

/* =========================
   Main
   ========================= */
export default function AparHistoryScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; no?: string | string[] }>();
  const router = useRouter();
  const aparId = useMemo(() => parseNumberParam(params?.id), [params?.id]);
  const aparNoFromRoute = useMemo(() => parseStringParam(params?.no), [params?.no]);
  const { badgeNumber } = useBadge();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState<null | 'network' | 'server-5xx'>(null);
  const [statusData, setStatusData] = useState<StatusResp['data'] | null>(null);
  const [details, setDetails] = useState<DetailsResp['data'] | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [histFilter, setHistFilter] = useState<'all' | 'ok' | 'bad'>('all');
  const [photoModal, setPhotoModal] = useState<{ visible: boolean; url?: string }>({ visible: false });

  const load = useCallback(
    async (isRefresh = false) => {
      if (!Number.isFinite(aparId)) {
        setStatusData(null);
        setDetails(null);
        setHistory([]);
        setLoading(false);
        setErrorText('Parameter ID APAR tidak valid.');
        return;
      }

      if (!badgeNumber) {
        setStatusData(null);
        setDetails(null);
        setHistory([]);
        setLoading(false);
        setErrorText('Badge belum terdeteksi. Silakan login/scan badge terlebih dahulu.');
        return;
      }

      if (!isRefresh) setLoading(true);
      setOffline(null);
      setErrorText(null);

      try {
        // 1) status terakhir (butuh badge)
        const sres = await safeFetchOffline(
          `${baseUrl}/api/perawatan/status/${aparId}?badge=${encodeURIComponent(badgeNumber)}`,
          { method: 'GET' }
        );
        let sjson: any = null;
        try { sjson = await sres.json(); } catch { sjson = null; }

        if (sjson?.offline) {
          setOffline(sjson.reason === 'server-5xx' ? 'server-5xx' : 'network');
          setStatusData(null);
          setDetails(null);
        } else if (sjson?.success) {
          const s: StatusResp = sjson;
          setStatusData(s.data ?? null);

          // 2) details + checklist + photos
          if (s?.data?.Id) {
            const did = s.data.Id;
            const dres = await safeFetchOffline(`${baseUrl}/api/perawatan/details/${did}`, { method: 'GET' });
            let djson: any = null;
            try { djson = await dres.json(); } catch { djson = null; }

            if (djson?.offline) {
              setOffline(djson.reason === 'server-5xx' ? 'server-5xx' : 'network');
              setDetails(null);
            } else if (djson?.success) {
              const d: DetailsResp = djson;
              setDetails(d.data ?? null);
            } else {
              setDetails(null);
            }
          } else {
            setDetails(null);
          }
        } else {
          setStatusData(null);
          setDetails(null);
          setErrorText(sjson?.message || 'Gagal memuat status.');
        }

        // 3) riwayat list
        const hres = await safeFetchOffline(`${baseUrl}/api/perawatan/history/${aparId}`, { method: 'GET' });
        let hjson: any = null;
        try { hjson = await hres.json(); } catch { hjson = null; }

        if (hjson?.offline) {
          if (!offline) setOffline(hjson.reason === 'server-5xx' ? 'server-5xx' : 'network');
          setHistory([]);
        } else if (hjson?.success) {
          const h: HistoryResp = hjson;
          setHistory(Array.isArray(h.data) ? h.data : []);
        } else {
          setHistory([]);
          if (!errorText) setErrorText(hjson?.message || 'Gagal memuat riwayat.');
        }
      } catch {
        setDetails(null);
        setHistory([]);
        setErrorText('Terjadi kesalahan tak terduga saat memuat data.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [aparId, badgeNumber, offline, errorText]
  );

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  /* ===== Derived UI Data ===== */
  const noApar   = details?.AparKode ?? statusData?.AparKode ?? aparNoFromRoute ?? '-';
  const lokasi   = details?.LokasiNama ?? statusData?.LokasiNama ?? '-';
  const jenis    = details?.JenisNama ?? statusData?.JenisNama ?? '-';
  const petugas  = details?.PetugasBadge ?? statusData?.PetugasBadge ?? '-';
  const selesai  = fmtDate(details?.TanggalPemeriksaan ?? statusData?.TanggalPemeriksaan ?? null);
  const interval = statusData?.NamaInterval
    ? `${statusData.NamaInterval}${statusData.IntervalBulan ? ` (${statusData.IntervalBulan} bln)` : ''}`
    : (statusData?.IntervalBulan ? `${statusData.IntervalBulan} bln` : '-');

  const nextDueIso = statusData?.NextDueDate ?? null;
  const nextDue  = fmtDate(nextDueIso);
  const sisaHari = diffDaysFromToday(nextDueIso);

  const checklist = (details?.checklist ?? []).slice().sort((a, b) => a.Dicentang - b.Dicentang); // Tidak duluan
  const totalCL = checklist.length;
  const baikCL  = checklist.filter(c => c.Dicentang === 1).length;
  const tidakCL = totalCL - baikCL;
  const passPct = totalCL ? Math.round((baikCL / totalCL) * 100) : 0;

  const photos = (details?.photos ?? []).map(p => {
    const rel = String(p.FotoPath || '');
    const url = `${baseUrl}${rel.startsWith('/') ? '' : '/'}${rel}`;
    return { ...p, url };
  });

  const filteredHistory = useMemo(() => {
    if (histFilter === 'all') return history;
    const isOK = (s?: string | null) => {
      const t = (s || '').toLowerCase();
      return t.includes('baik') || t.includes('ok');
    };
    return history.filter(h => (histFilter === 'ok' ? isOK(h.Kondisi) : !isOK(h.Kondisi)));
  }, [history, histFilter]);

  /* ===== Render ===== */
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
      {!!offline && (
        <Banner>
          <BannerText>{offline === 'server-5xx' ? '🛠️ Server bermasalah' : '📴 Offline'} — menampilkan data terbatas.</BannerText>
        </Banner>
      )}
      {!!errorText && !offline && (
        <ErrorBanner>
          <BannerText style={{ color: '#8a1c1c' }}>⚠️ {errorText}</BannerText>
        </ErrorBanner>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ===== Ringkasan ===== */}
        <Card>
          <CardTitle>Ringkasan Terakhir</CardTitle>
          <Row><Label>No. APAR</Label><Value>{noApar}</Value></Row>
          <Row><Label>Petugas</Label><Value>{petugas || '-'}</Value></Row>
          <Row><Label>Selesai</Label><Value>{selesai}</Value></Row>
          <Divider />

          <PillRow>
            <Pill>
              <PillLabel>Interval</PillLabel>
              <PillValue>{interval}</PillValue>
            </Pill>
            <Pill
              style={{ marginLeft: 8 }}
              color={sisaHari == null ? '#e5e7eb' : sisaHari < 0 ? '#fee2e2' : sisaHari <= 7 ? '#fff7ed' : '#e8f5e9'}
              borderColor={sisaHari == null ? '#e5e7eb' : sisaHari < 0 ? '#fecaca' : sisaHari <= 7 ? '#fed7aa' : '#c8e6c9'}
            >
              <PillLabel>Jatuh Tempo</PillLabel>
              <PillValue>
                {nextDue}
                {sisaHari != null && (
                  <Text style={{ color: '#6b7280' }}>
                    {'  '}
                    {sisaHari < 0 ? `Terlambat ${Math.abs(sisaHari)}h` : `± ${sisaHari}h`}
                  </Text>
                )}
              </PillValue>
            </Pill>
          </PillRow>

          {/* Stats checklist */}
          {/* <StatsWrap>
            <StatBox><StatNum>{totalCL}</StatNum><StatLabel>Total</StatLabel></StatBox>
            <StatBox><StatNum style={{ color: Colors.success }}>{baikCL}</StatNum><StatLabel>Baik</StatLabel></StatBox>
            <StatBox><StatNum style={{ color: Colors.error }}>{tidakCL}</StatNum><StatLabel>Tidak</StatLabel></StatBox>
          </StatsWrap>
          <ProgressOuter><ProgressInner style={{ width: `${passPct}%` }} /></ProgressOuter>
          <ProgLabel>{passPct}% lolos</ProgLabel> */}
        </Card>

        {/* ===== Info Umum ===== */}
        <Card>
          <CardTitle>Info Umum</CardTitle>
          <Row><Label>Lokasi</Label><Value>{lokasi}</Value></Row>
          <Row><Label>Jenis</Label><Value>{jenis}</Value></Row>
          <Row><Label>ID APAR</Label><Value>{Number.isFinite(aparId) ? String(aparId) : '-'}</Value></Row>
        </Card>

        {/* ===== Checklist ===== */}
        <Card>
          <CardTitle>Checklist Terakhir</CardTitle>
          {checklist.length === 0 ? (
            <Empty>- Tidak ada checklist -</Empty>
          ) : (
            <View>
              {checklist.map((c, idx) => (
                <CLRow key={`${c.ChecklistId}-${idx}`}>
                  <CLHeader>
                    <CLBadge good={!!c.Dicentang}>{c.Dicentang ? 'Baik' : 'Tidak'}</CLBadge>
                    <CLQ>{c.Pertanyaan}</CLQ>
                  </CLHeader>
                  {c.Keterangan ? <CLKet>Catatan: {c.Keterangan}</CLKet> : null}
                </CLRow>
              ))}
            </View>
          )}
        </Card>

        {/* ===== Foto ===== */}
        <Card>
          <CardTitle>Foto Pemeriksaan</CardTitle>
          {photos.length === 0 ? (
            <Empty>- Tidak ada foto -</Empty>
          ) : (
            <PhotoGrid>
              {photos.map((p, i) => (
                <Pressable key={i} onPress={() => setPhotoModal({ visible: true, url: p.url })}>
                  <PhotoThumb source={{ uri: p.url }} />
                </Pressable>
              ))}
            </PhotoGrid>
          )}
        </Card>

        {/* ===== Riwayat ===== */}
        <Card>
          <CardTitle>Riwayat Pemeriksaan</CardTitle>

          <FilterRow>
            <FilterBtn active={histFilter === 'all'} onPress={() => setHistFilter('all')}>
              <FilterText active={histFilter === 'all'}>Semua</FilterText>
            </FilterBtn>
            <FilterBtn active={histFilter === 'ok'} onPress={() => setHistFilter('ok')}>
              <FilterText active={histFilter === 'ok'}>OK</FilterText>
            </FilterBtn>
            <FilterBtn active={histFilter === 'bad'} onPress={() => setHistFilter('bad')}>
              <FilterText active={histFilter === 'bad'}>Tidak</FilterText>
            </FilterBtn>
          </FilterRow>

          {filteredHistory.length === 0 ? (
            <Empty>- Belum ada data -</Empty>
          ) : (
            <View>
              {filteredHistory.map((h) => (
                <HistItem key={h.Id} item={h} aparId={aparId} aparNo={noApar} />
              ))}
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Image Modal */}
      <Modal visible={photoModal.visible} transparent animationType="fade" onRequestClose={() => setPhotoModal({ visible: false })}>
        <ModalBackdrop onPress={() => setPhotoModal({ visible: false })}>
          {photoModal.url ? <ModalImage source={{ uri: photoModal.url }} resizeMode="contain" /> : null}
        </ModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
}

/* =========================
   Riwayat Item (expand/collapse)
   ========================= */
function HistItem({ item }: { item: HistoryItem; aparId: number; aparNo: string }) {
  const [open, setOpen] = useState(false);

  return (
    <HistRow>
      <HistLeft>
        <HistDate>{fmtDate(item.TanggalPemeriksaan)}</HistDate>
        <HistMeta>{item.PetugasBadge || '-'}</HistMeta>
        <HistMeta>
          {item.NamaInterval
            ? `${item.NamaInterval}${item.IntervalBulan ? ` (${item.IntervalBulan} bln)` : ''}`
            : (item.IntervalBulan ? `${item.IntervalBulan} bln` : '-')}
        </HistMeta>
      </HistLeft>
      <HistRight>
        <HistBadge type={item.Kondisi || ''}><HistBadgeText>{item.Kondisi || '—'}</HistBadgeText></HistBadge>
        <Pressable onPress={() => setOpen(o => !o)} hitSlop={6}>
          <HistLink>{open ? 'Tutup' : 'Rincian'}</HistLink>
        </Pressable>
      </HistRight>

      {open && (
        <HistDetail>
          <DRow><DLabel>Tekanan</DLabel><DVal>{item.Tekanan != null ? `${item.Tekanan} bar` : '-'}</DVal></DRow>
          <DRow><DLabel>Masalah</DLabel><DVal>{item.JumlahMasalah != null ? item.JumlahMasalah : '-'}</DVal></DRow>
          <DRow><DLabel>Catatan</DLabel><DVal>{item.CatatanMasalah || '-'}</DVal></DRow>
          <DRow><DLabel>Rekomendasi</DLabel><DVal>{item.Rekomendasi || '-'}</DVal></DRow>
          <DRow><DLabel>Tindak Lanjut</DLabel><DVal>{item.TindakLanjut || '-'}</DVal></DRow>
        </HistDetail>
      )}
    </HistRow>
  );
}

/* =========================
   styled
   ========================= */
const Center = styled.View`flex:1; align-items:center; justify-content:center; background:#fff;`;
const LoadingText = styled(Text)`margin-top:8px; color:${Colors.subtext};`;

const Banner = styled.View`padding:10px 14px; background:#fff3cd;`;
const ErrorBanner = styled.View`padding:10px 14px; background:#fde2e2;`;
const BannerText = styled(Text)`color:#a66c00; font-size:13px;`;

const Card = styled.View`
  background:#fff; margin:12px 14px 0 14px; border-radius:12px; padding:14px;
  border:1px solid #eee;
`;
const CardTitle = styled(Text)`font-weight:800; color:${Colors.text}; margin-bottom:10px; font-size:16px;`;
const Row = styled.View`flex-direction:row; justify-content:space-between; padding:8px 2px;`;
const Label = styled(Text)`color:${Colors.subtext};`;
const Value = styled(Text)`color:${Colors.text}; font-weight:700;`;
const Divider = styled.View`height:1px; background:#f0f0f0; margin:8px 0 6px;`;

const PillRow = styled.View`flex-direction:row; margin-top:6px;`;
const Pill = styled.View<{ color?: string; borderColor?: string }>`
  flex:1; padding:10px; border-radius:10px; 
  background:${p => p.color || '#f3f4f6'};
  border:1px solid ${p => p.borderColor || '#e5e7eb'};
`;
const PillLabel = styled(Text)`color:${Colors.subtext}; font-size:12px;`;
const PillValue = styled(Text)`color:${Colors.text}; font-weight:700; margin-top:2px;`;

const StatsWrap = styled.View`flex-direction:row; margin-top:12px;`;
const StatBox = styled.View`flex:1; align-items:center;`;
const StatNum = styled(Text)`font-size:20px; font-weight:800; color:${Colors.text};`;
const StatLabel = styled(Text)`font-size:12px; color:${Colors.subtext}; margin-top:2px;`;

const ProgressOuter = styled.View`height:8px; background:#f1f5f9; border-radius:999px; margin-top:10px; overflow:hidden;`;
const ProgressInner = styled.View`height:8px; background:${Colors.success};`;
const ProgLabel = styled(Text)`text-align:right; margin-top:6px; color:${Colors.subtext}; font-size:12px;`;

const Empty = styled(Text)`text-align:center; color:${Colors.subtext}; padding:18px 0;`;

const CLRow = styled.View`padding:10px 2px; border-top-width:1px; border-top-color:#f0f0f0;`;
const CLHeader = styled.View`flex-direction:row; align-items:flex-start;`;
const CLBadge = styled.Text<{good:boolean}>`
  background:${p=>p.good?'#e9f7ef':'#fdecea'};
  color:${p=>p.good?Colors.success:Colors.error};
  border:1px solid ${p=>p.good?'#b7e1c1':'#f5c6cb'};
  padding:2px 8px; border-radius:999px; margin-right:8px; font-weight:800; font-size:12px;
`;
const CLQ   = styled(Text)`color:${Colors.text}; flex:1;`;
const CLKet = styled(Text)`color:${Colors.subtext}; font-size:12px; margin-top:6px;`;

const PhotoGrid = styled.View`flex-direction:row; flex-wrap:wrap; margin:-4px;`;
const PhotoThumb = styled(Image)`width:31%; aspect-ratio:1; margin:4px; border-radius:8px; background:#eee;`;

const FilterRow = styled.View`flex-direction:row; margin-bottom:10px;`;
const FilterBtn = styled.Pressable<{active:boolean}>`
  flex:1; padding:8px 10px; margin-right:6px; border-radius:999px;
  background:${p=>p.active ? '#eef2ff' : '#f3f4f6'};
  border:1px solid ${p=>p.active ? '#c7d2fe' : '#e5e7eb'};
  align-items:center;
`;
const FilterText = styled(Text)<{active:boolean}>`
  font-size:12px; font-weight:700; color:${p=>p.active ? Colors.primary : Colors.text};
`;

const HistRow = styled.View`
  padding:12px 2px; border-top-width:1px; border-top-color:#f0f0f0;
  flex-direction:row; justify-content:space-between; align-items:flex-start;
`;
const HistLeft = styled.View``;
const HistRight = styled.View`align-items:flex-end;`;
const HistDate = styled(Text)`color:${Colors.text}; font-weight:700; margin-bottom:2px;`;
const HistMeta = styled(Text)`color:${Colors.subtext}; font-size:12px;`;
const HistBadge = styled.View<{type:string}>`
  padding:4px 8px; border-radius:999px; margin-bottom:6px;
  background: ${({type}) => {
    const t = (type || '').toLowerCase();
    if (t.includes('baik') || t.includes('ok')) return '#e9f7ef';
    if (t.includes('buruk') || t.includes('tidak') || t.includes('rusak')) return '#fdecea';
    return '#eef2ff';
  }};
  border-width:1px;
  border-color: ${({type}) => {
    const t = (type || '').toLowerCase();
    if (t.includes('baik') || t.includes('ok')) return '#b7e1c1';
    if (t.includes('buruk') || t.includes('tidak') || t.includes('rusak')) return '#f5c6cb';
    return '#c7d2fe';
  }};
`;
const HistBadgeText = styled(Text)`font-size:12px; color:${Colors.text};`;
const HistLink = styled(Text)`color:${Colors.primary}; font-size:12px; text-decoration:underline;`;

const HistDetail = styled.View`width:100%; margin-top:10px; padding:10px; background:#fafafa; border-radius:8px;`;
const DRow = styled.View`flex-direction:row; justify-content:space-between; margin-bottom:6px;`;
const DLabel = styled(Text)`color:${Colors.subtext}; font-size:12px;`;
const DVal = styled(Text)`color:${Colors.text}; font-weight:600; font-size:12px;`;

const ModalBackdrop = styled.Pressable`flex:1; background:rgba(0,0,0,0.9); justify-content:center; align-items:center;`;
const ModalImage = styled(Image)`width:92%; height:80%;`;
