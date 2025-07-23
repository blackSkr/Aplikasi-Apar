import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from 'react';
import {
    AppState,
    AppStateStatus,
    Button,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

const BADGE_KEY = 'BADGE_NUMBER';

interface BadgeContextValue {
  badgeNumber: string;
  setBadgeNumber: (b: string) => void;
}
const BadgeContext = createContext<BadgeContextValue>({
  badgeNumber: '',
  setBadgeNumber: () => {},
});

export const useBadge = () => useContext(BadgeContext);

function BadgeModal({ onSave }: { onSave: (badge: string) => void }) {
  const [input, setInput] = useState('');
  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Masukkan Badge Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Badge Number"
            value={input}
            onChangeText={setInput}
            autoCapitalize="characters"
          />
          <Button
            title="Simpan"
            onPress={() => {
              const trimmed = input.trim();
              if (trimmed) onSave(trimmed);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

export const BadgeProvider = ({ children }: { children: ReactNode }) => {
  const [badgeNumber, setBadge] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [ready, setReady] = useState(false);

  // 1) Cek storage sekali saat mount
  useEffect(() => {
    AsyncStorage.getItem(BADGE_KEY).then(stored => {
      if (stored) {
        setBadge(stored);
      } else {
        setShowModal(true);
      }
      setReady(true);
    });
  }, []);

  // 2) Setiap kali app kembali ke foreground, re‑cek storage
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') {
        AsyncStorage.getItem(BADGE_KEY).then(stored => {
          if (!stored) {
            // kalau hilang, munculkan modal input ulang
            setShowModal(true);
            setBadge('');
          }
        });
      }
    });
    return () => sub.remove();
  }, []);

  // helper untuk menyimpan dan sembunyikan modal
  const setBadgeNumber = async (b: string) => {
    await AsyncStorage.setItem(BADGE_KEY, b);
    setBadge(b);
    setShowModal(false);
  };

  // tunggu hingga cek pertama selesai
  if (!ready) return null;

  return (
    <BadgeContext.Provider value={{ badgeNumber, setBadgeNumber }}>
      {children}
      {showModal && <BadgeModal onSave={setBadgeNumber} />}
    </BadgeContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
  },
  title: { fontSize: 18, marginBottom: 12, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
});
