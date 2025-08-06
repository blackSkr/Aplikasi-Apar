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
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const BADGE_KEY = 'BADGE_NUMBER';
const BADGE_TIMESTAMP_KEY = 'BADGE_TIMESTAMP';

interface BadgeContextValue {
  badgeNumber: string;
  setBadgeNumber: (b: string) => Promise<void>;
  clearBadgeNumber: () => Promise<void>;
}
const BadgeContext = createContext<BadgeContextValue>({
  badgeNumber: '',
  setBadgeNumber: async () => {},
  clearBadgeNumber: async () => {},
});

export const useBadge = () => useContext(BadgeContext);

function BadgeModal({ onSave }: { onSave: (badge: string) => void }) {
  const [input, setInput] = useState('');

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Image
            source={require('../assets/images/kpc-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Masukkan Badge Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: ABC123"
            value={input}
            onChangeText={setInput}
            autoCapitalize="characters"
            placeholderTextColor="#aaa"
          />
          <Pressable
            style={styles.button}
            onPress={() => {
              const trimmed = input.trim();
              if (trimmed) onSave(trimmed);
            }}
          >
            <Text style={styles.buttonText}>SIMPAN</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export const BadgeProvider = ({ children }: { children: ReactNode }) => {
  const [badgeNumber, setBadge] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [ready, setReady] = useState(false);

  const checkBadgeValidity = async () => {
    const stored = await AsyncStorage.getItem(BADGE_KEY);
    const timestamp = await AsyncStorage.getItem(BADGE_TIMESTAMP_KEY);

    if (!stored || !timestamp) {
      setBadge('');
      setShowModal(true);
      return;
    }

    const diff = Date.now() - parseInt(timestamp, 10);
    const oneHour = 60 * 60 * 1000; //Interval Waktu Cache 1 Jam
    if (diff > oneHour) {
      await AsyncStorage.multiRemove([BADGE_KEY, BADGE_TIMESTAMP_KEY]);
      setBadge('');
      setShowModal(true);
    } else {
      setBadge(stored);
    }
  };

  useEffect(() => {
    checkBadgeValidity().then(() => setReady(true));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') checkBadgeValidity();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const interval = setInterval(checkBadgeValidity, 60_000);
    return () => clearInterval(interval);
  }, []);

  const setBadgeNumber = async (b: string) => {
    const now = Date.now().toString();
    await AsyncStorage.multiSet([
      [BADGE_KEY, b],
      [BADGE_TIMESTAMP_KEY, now],
    ]);
    setBadge(b);
    setShowModal(false);
  };

  const clearBadgeNumber = async () => {
    await AsyncStorage.multiRemove([BADGE_KEY, BADGE_TIMESTAMP_KEY]);
    setBadge('');
    setShowModal(true);
  };

  if (!ready) return null;

  return (
    <BadgeContext.Provider value={{ badgeNumber, setBadgeNumber, clearBadgeNumber }}>
      {children}
      {showModal && <BadgeModal onSave={setBadgeNumber} />}
    </BadgeContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  logo: {
    width: 100,
    height: 50,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    marginBottom: 20,
    color: '#333',
  },
  button: {
    backgroundColor: '#D50000',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
