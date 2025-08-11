// app/(tabs)/index.tsx
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  SectionList,
  Text,
  View
} from 'react-native';
import styled from 'styled-components/native';

import Header from '@/components/IndexPages/Header';
import IndexAparCard from '@/components/IndexPages/IndexAparCards';
import Options from '@/components/IndexPages/IndexOptions';
import Stats from '@/components/IndexPages/IndexStats';
import Colors from '@/constants/Colors';
import { useBadge } from '@/context/BadgeContext';
import { useAparList } from '@/hooks/useAparList';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { usePreloadCache } from '@/hooks/usePreloadCache';
import { router } from 'expo-router';

const INITIAL_COUNT = 3;
const FORCE_CTA_MS = 12000;

export default function AparInformasi() {
  const { loading, list, refresh, offlineReason } = useAparList();
  const { clearBadgeNumber } = useBadge();

  // Kirim manual (tidak auto flush)
  const { count, isFlushing, refreshQueue, flushNow } = useOfflineQueue({
    autoFlushOnReconnect: false,
    autoFlushOnForeground: false,
  });

  const { status: preloadStatus, summary: preloadSummary } = usePreloadCache({ showToast: false });

  const [isConnected, setIsConnected] = useState(true);
  const [selectedJenis, setSelectedJenis] = useState<string | null>(null);
  const [visibleNeed, setVisibleNeed] = useState(INITIAL_COUNT);
  const [visibleDone, setVisibleDone] = useState(INITIAL_COUNT);
  const [relogKey, setRelogKey] = useState(0);
  const [forceShowFlushCta, setForceShowFlushCta] = useState(false);

  // Refs untuk hindari re-subscribe loop
  const refreshQueueRef = useRef(refreshQueue);
  useEffect(() => { refreshQueueRef.current = refreshQueue; }, [refreshQueue]);

  const refreshingRef = useRef(false);
  const refreshSafe = useCallback(async (reason?: string) => {
    if (preloadStatus === 'running') return;
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try { await refresh(); }
    finally { refreshingRef.current = false; }
  }, [refresh, preloadStatus]);

  const refreshSafeRef = useRef(refreshSafe);
  useEffect(() => { refreshSafeRef.current = refreshSafe; }, [refreshSafe]);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const forceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastIsConnectedRef = useRef<boolean | null>(null);

  // reset pagination tiap filter/list berubah
  useEffect(() => {
    setVisibleNeed(INITIAL_COUNT);
    setVisibleDone(INITIAL_COUNT);
  }, [selectedJenis, list]);

  // NetInfo listener (stable, dependency [])
  useEffect(() => {
    const unsub = NetInfo.addEventListener(async s => {
      const connected = !!s.isConnected;
      if (lastIsConnectedRef.current === connected) return;
      lastIsConnectedRef.current = connected;

      setIsConnected(connected);

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      if (connected) {
        // soft “relog” (remount subtree)
        setRelogKey(k => k + 1);

        // paksa tombol kirim tampil beberapa detik
        setForceShowFlushCta(true);
        if (forceTimerRef.current) clearTimeout(forceTimerRef.current);
        forceTimerRef.current = setTimeout(() => setForceShowFlushCta(false), FORCE_CTA_MS);

        // update count queue
        await refreshQueueRef.current();

        // refresh data utama (debounced)
        debounceTimerRef.current = setTimeout(() => {
          refreshSafeRef.current('netinfo-online');
        }, 400);
      } else {
        setForceShowFlushCta(false);
      }
    });
    return () => {
      unsub();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (forceTimerRef.current) clearTimeout(forceTimerRef.current);
    };
  }, []);

  // tutup paksa CTA kalau antrian sudah kosong
  useEffect(() => {
    if (forceShowFlushCta && count === 0 && !isFlushing) {
      setForceShowFlushCta(false);
      if (forceTimerRef.current) {
        clearTimeout(forceTimerRef.current);
        forceTimerRef.current = null;
      }
    }
  }, [forceShowFlushCta, count, isFlushing]);

  // refresh saat focus
  useFocusEffect(
    useCallback(() => {
      refreshSafeRef.current('screen-focus');
    }, [])
  );

  // setelah preload selesai → refresh sekali
  useEffect(() => {
    if (preloadStatus === 'done' || preloadStatus === 'skipped' || preloadStatus === 'error') {
      refreshSafeRef.current('after-preload');
    }
  }, [preloadStatus]);

  const handleLogout = async () => { await clearBadgeNumber(); };

  const jenisList = useMemo(
    () => Array.from(new Set(list.map(i => i.jenis_apar).filter(Boolean))),
    [list]
  );

  const needAll = useMemo(
    () => list.filter(i => i.statusMaintenance === 'Belum')
              .filter(i => !selectedJenis || i.jenis_apar === selectedJenis),
    [list, selectedJenis]
  );

  const doneAll = useMemo(
    () => list.filter(i => i.statusMaintenance === 'Sudah')
              .filter(i => !selectedJenis || i.jenis_apar === selectedJenis),
    [list, selectedJenis]
  );

  if (loading) {
    return (
      <SafeAreaView style={{flex:1,justifyContent:'center',alignItems:'center'}}>
        <ActivityIndicator size="large" color={Colors.primary}/>
        <LoadingText>Memuat data...</LoadingText>
      </SafeAreaView>
    );
  }

  const sections = [
    { title: 'Perlu Maintenance',  data: needAll.slice(0, visibleNeed), allData: needAll, type: 'need', key: 'section-need-maintenance' },
    { title: 'Sudah Maintenance', data: doneAll.slice(0, visibleDone), allData: doneAll, type: 'done', key: 'section-sudah-maintenance' },
  ];

  const renderFooter = (section: any) => {
    const total = section.allData.length;
    const visible = section.type === 'need' ? visibleNeed : visibleDone;
    if (total === 0) return null;
    return (
      <View key={`footer-${section.type}`} style={{ alignItems:'center', paddingVertical:8, flexDirection:'row', justifyContent:'center' }}>
        {visible < total && (
          <LoadMoreBtn
            onPress={() =>
              section.type === 'need'
                ? setVisibleNeed(v => v + INITIAL_COUNT)
                : setVisibleDone(v => v + INITIAL_COUNT)
            }
            style={{ marginRight: visible > INITIAL_COUNT - 1 ? 12 : 0 }}
          >
            <LoadMoreText>Tampilkan Lagi</LoadMoreText>
          </LoadMoreBtn>
        )}
        {visible > INITIAL_COUNT && (
          <HideBtn
            onPress={() =>
              section.type === 'need'
                ? setVisibleNeed(INITIAL_COUNT)
                : setVisibleDone(INITIAL_COUNT)
            }
          >
            <HideText>Tutup</HideText>
          </HideBtn>
        )}
      </View>
    );
  };

  return (
    <Container key={relogKey}>
      <Header onLogout={handleLogout} />

      {/* Banner koneksi/server */}
      {!isConnected && (
        <OfflineBanner>
          <OfflineText>📴 Kamu sedang offline.</OfflineText>
        </OfflineBanner>
      )}
      {isConnected && offlineReason === 'server-5xx' && (
        <OfflineBanner>
          <OfflineText>🛠️ Server sedang bermasalah. Menampilkan data dari cache.</OfflineText>
        </OfflineBanner>
      )}

      <Stats
        jenisList={jenisList}
        selectedJenis={selectedJenis}
        onSelectJenis={val => setSelectedJenis(val)}
      />

      <Options />

      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => `${item.id_apar||idx}-${idx}`}
        renderSectionHeader={({ section }) => (
          <SectionHeader key={section.key}>
            <SectionTitle>{section.title}</SectionTitle>
          </SectionHeader>
        )}
        renderItem={({ item, index }) => (
          <IndexAparCard
            key={`card-${item.id_apar||index}-${index}`}
            item={item}
            onPressDetails={() =>
              router.push({ pathname: '/ManajemenApar/AparMaintenance', params: { id: item.id_apar } })
            }
          />
        )}
        renderSectionFooter={({ section }) => renderFooter(section)}
        ListEmptyComponent={<EmptyContainer key="empty"><EmptyText>Data kosong.</EmptyText></EmptyContainer>}
        contentContainerStyle={{ paddingBottom: 80 }}
        stickySectionHeadersEnabled={false}
      />

      {/* Tombol kirim — manual + dipaksa tampil sesaat setelah online */}
      {isConnected && (count > 0 || isFlushing || forceShowFlushCta) && (
        <FloatingBtn
          onPress={() => {
            if (isFlushing) {
              Alert.alert('Sedang Mengirim', 'Tunggu sampai proses pengiriman selesai.');
              return;
            }
            Alert.alert(
              'Kirim Data Offline',
              `Kamu punya ${count} data tersimpan offline. Kirim sekarang?`,
              [
                { text: 'Batal', style: 'cancel' },
                {
                  text: 'Kirim',
                  style: 'destructive',
                  onPress: async () => {
                    await flushNow();
                    await refreshQueueRef.current();
                    await refreshSafeRef.current('after-flush');
                    if (count === 0) {
                      Alert.alert('✅ Berhasil', 'Data offline berhasil dikirim.');
                    }
                  },
                },
              ]
            );
          }}
        >
          <FloatingText>{isFlushing ? '⏳ Mengirim…' : `🔄 Kirim (${count})`}</FloatingText>
        </FloatingBtn>
      )}

      {/* {__DEV__ && (
        <DebugWrap>
          <DebugTitle>Preload: {preloadStatus}</DebugTitle>
          <DebugLine>List: {preloadSummary.listCount}</DebugLine>
          <DebugLine>Detail OK: {preloadSummary.detailSaved}/{preloadSummary.detailRequested}</DebugLine>
          {preloadSummary.detailFailed > 0 && (
            <>
              <DebugLine>Gagal: {preloadSummary.detailFailed}</DebugLine>
              <DebugFailedIds numberOfLines={2} ellipsizeMode="tail">
                IDs gagal: {preloadSummary.failedIds.join(', ')}
              </DebugFailedIds>
            </>
          )}
          <DebugLine>Online: {isConnected ? 'ya' : 'tidak'}</DebugLine>
          <DebugLine>Queue: {count} | Flushing: {isFlushing ? 'ya' : 'tidak'}</DebugLine>
          <DebugLine>Force CTA: {forceShowFlushCta ? 'ya' : 'tidak'}</DebugLine>
        </DebugWrap>
      )} */}
    </Container>
  );
}

// =================== STYLED COMPONENTS ===================
const Container = styled.View` flex: 1; background: #f5f5f5; `;
const LoadingText = styled(Text)` margin-top: 12px; color: ${Colors.text}; font-size: 16px; `;
const OfflineBanner = styled(View)` padding: 10px; align-items: center; background: #fff3cd; `;
const OfflineText = styled(Text)` color: #d50000; font-size: 13px; `;
const SectionHeader = styled(View)` background: #f5f5f5; padding: 8px 16px; `;
const SectionTitle = styled(Text)` font-size: 16px; font-weight: bold; color: ${Colors.text}; `;
const EmptyContainer = styled(View)` padding: 24px; align-items: center; `;
const EmptyText = styled(Text)` text-align: center; color: ${Colors.textSecondary}; font-size: 14px; `;
const LoadMoreBtn = styled.TouchableOpacity` background: ${Colors.primary}; padding: 8px 24px; border-radius: 20px; `;
const LoadMoreText = styled(Text)` color: #fff; font-size: 14px; font-weight: 600; `;
const HideBtn = styled.TouchableOpacity` background: #e0e0e0; padding: 8px 24px; border-radius: 20px; `;
const HideText = styled(Text)` color: #444; font-size: 14px; font-weight: 600; `;
const FloatingBtn = styled.TouchableOpacity`
  position: absolute; bottom: 20px; right: 20px; background: #dc2626;
  padding: 16px 20px; border-radius: 32px; elevation: 4;
  shadow-color: #000; shadow-offset: 0px 2px; shadow-opacity: 0.2; shadow-radius: 4px;
`;
const FloatingText = styled(Text)` color: #fff; font-weight: bold; font-size: 14px; `;

/* Debug panel (dev only) */
const DebugWrap = styled(View)`
  position: absolute; left: 12px; bottom: 20px; padding: 10px 12px;
  background: rgba(0,0,0,0.75); border-radius: 8px; max-width: 75%;
`;
const DebugTitle = styled(Text)` color: #fff; font-weight: 700; margin-bottom: 4px; `;
const DebugLine = styled(Text)` color: #e5e7eb; font-size: 12px; `;
const DebugFailedIds = styled(Text)` color: #fca5a5; font-size: 11px; margin-top: 2px; `;
