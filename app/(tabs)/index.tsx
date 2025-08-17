import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Debug & config
import { __CONFIG_DEBUG__, baseUrl, logApiConfig } from '@/src/config';
import { installFetchLogger } from '@/src/setupNetworking';
import { createLogger } from '@/src/utils/logger';

installFetchLogger();
const log = createLogger('home');

const INITIAL_COUNT = 3;
const FORCE_CTA_MS = 12000;

async function debugPing(tag: string) {
  const url = `${baseUrl}/api/peralatan?badge=PING`;
  log.debug(`[${tag}] baseUrl = ${baseUrl}`);
  log.debug(`[${tag}] config =`, __CONFIG_DEBUG__);
  log.debug(`[${tag}] ping GET ${url}`);

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 6000);

  try {
    const r = await fetch(url, { method: 'GET', signal: controller.signal });
    log.info(`[${tag}] ping status = ${r.status}`);
  } catch (e: any) {
    log.error(`[${tag}] ping error = ${e?.message || e}`);
  } finally {
    clearTimeout(id);
  }
}

export default function AparInformasi() {
  const { loading, list, refresh, offlineReason } = useAparList();
  const { badgeNumber, clearBadgeNumber, petugasInfo, offlineCapable, isEmployeeOnly } = useBadge();

  const { count, isFlushing, refreshQueue, flushNow } = useOfflineQueue({
    autoFlushOnReconnect: false,
    autoFlushOnForeground: false,
  });

  const { status: preloadStatus } = usePreloadCache({ showToast: false });

  const [isConnected, setIsConnected] = useState(true);
  const [selectedJenis, setSelectedJenis] = useState<string | null>(null);
  const [visibleNeed, setVisibleNeed] = useState(INITIAL_COUNT);
  const [visibleDone, setVisibleDone] = useState(INITIAL_COUNT);
  const [relogKey, setRelogKey] = useState(0);
  const [forceShowFlushCta, setForceShowFlushCta] = useState(false);

  useEffect(() => {
    (async () => {
      logApiConfig('boot');
      const n = await NetInfo.fetch();
      log.info(
        `[home-mount] NetInfo isConnected=${n.isConnected} reachable=${n.isInternetReachable} type=${n.type}`
      );
      await debugPing('home-mount');
    })();
  }, []);

  const refreshQueueRef = useRef(refreshQueue);
  useEffect(() => { refreshQueueRef.current = refreshQueue; }, [refreshQueue]);

  const refreshingRef = useRef(false);
  const refreshSafe = useCallback(async () => {
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

  // ⬇️ filter list berdasarkan lokasi petugas (kalau ada)
  const listByLokasi = useMemo(() => {
    if (!petugasInfo?.lokasiNama) return list;
    const ln = String(petugasInfo.lokasiNama).trim().toLowerCase();
    return list.filter(i =>
      String(i.lokasi_apar || '').trim().toLowerCase() === ln
    );
  }, [list, petugasInfo]);

  const jenisList = useMemo(
    () => Array.from(new Set(listByLokasi.map(i => i.jenis_apar).filter(Boolean))),
    [listByLokasi]
  );

  useEffect(() => {
    if (selectedJenis && !jenisList.includes(selectedJenis)) {
      setSelectedJenis(null);
    }
  }, [jenisList, selectedJenis]);

  useEffect(() => {
    setVisibleNeed(INITIAL_COUNT);
    setVisibleDone(INITIAL_COUNT);
  }, [selectedJenis, listByLokasi]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(async s => {
      const connected = !!s.isConnected;
      if (lastIsConnectedRef.current === connected) return;
      lastIsConnectedRef.current = connected;

      setIsConnected(connected);

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      if (connected) {
        log.info(
          `[net-change-online] isConnected=${s.isConnected} reachable=${s.isInternetReachable} type=${s.type}`
        );
        await debugPing('net-change-online');

        setRelogKey(k => k + 1);
        setForceShowFlushCta(true);
        if (forceTimerRef.current) clearTimeout(forceTimerRef.current);
        forceTimerRef.current = setTimeout(() => setForceShowFlushCta(false), FORCE_CTA_MS);

        await refreshQueueRef.current();
        debounceTimerRef.current = setTimeout(() => {
          refreshSafeRef.current();
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

  useEffect(() => {
    if (forceShowFlushCta && count === 0 && !isFlushing) {
      setForceShowFlushCta(false);
      if (forceTimerRef.current) {
        clearTimeout(forceTimerRef.current);
        forceTimerRef.current = null;
      }
    }
  }, [forceShowFlushCta, count, isFlushing]);

  useFocusEffect(
    useCallback(() => {
      refreshSafeRef.current();
    }, [])
  );

  useEffect(() => {
    if (preloadStatus === 'done' || preloadStatus === 'skipped' || preloadStatus === 'error') {
      refreshSafeRef.current();
    }
  }, [preloadStatus]);

  const handleLogout = async () => {
    if (badgeNumber) {
      const flagKey = `PRELOAD_FULL_FOR_${badgeNumber}`;
      await AsyncStorage.removeItem(flagKey);
    }
    await clearBadgeNumber();
  };

  const needAll = useMemo(
    () => listByLokasi
      .filter(i => i.statusMaintenance === 'Belum')
      .filter(i => !selectedJenis || i.jenis_apar === selectedJenis),
    [listByLokasi, selectedJenis]
  );

  const doneAll = useMemo(
    () => listByLokasi
      .filter(i => i.statusMaintenance === 'Sudah')
      .filter(i => !selectedJenis || i.jenis_apar === selectedJenis),
    [listByLokasi, selectedJenis]
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
    { title: 'Perlu Inspeksi',  data: needAll.slice(0, visibleNeed), allData: needAll, type: 'need', key: 'section-need' },
    { title: 'Sudah Inspeksi', data: doneAll.slice(0, visibleDone), allData: doneAll, type: 'done', key: 'section-done' },
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
      <Header onLogout={handleLogout} selectedJenis={selectedJenis} />

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
      {/* Banner online-only bila employee-only */}
      {isEmployeeOnly && (
        <OfflineBanner>
          <OfflineText>⚠️ Mode Online-only — akun ini belum terikat lokasi & bukan Rescue. Preload/flush offline dimatikan.</OfflineText>
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
            onPressDetails={() => {
              const pathname =
                item.statusMaintenance === 'Sudah'
                  ? '/ManajemenApar/AparHistory'
                  : '/ManajemenApar/AparMaintenance';
              router.push({
                pathname,
                params: { id: String(item.id_apar) },
              });
            }}
          />
        )}
        renderSectionFooter={({ section }) => renderFooter(section)}
        ListEmptyComponent={
          <EmptyContainer key="empty">
            <EmptyText>
              {selectedJenis ? `Tidak ada data untuk jenis "${selectedJenis}".` : 'Data kosong.'}
            </EmptyText>
          </EmptyContainer>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
        stickySectionHeadersEnabled={false}
      />

      {/* FAB Kirim Offline hanya kalau offlineCapable */}
      {offlineCapable && isConnected && (count > 0 || isFlushing || forceShowFlushCta) && (
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
                    await refreshSafeRef.current();
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
    </Container>
  );
}

// === styled ===
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
