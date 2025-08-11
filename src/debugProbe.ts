// src/debugProbe.ts
import { baseUrl } from '@/src/config';
import NetInfo from '@react-native-community/netinfo';

function timeout<T>(p: Promise<T>, ms = 6000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e); });
  });
}

export async function runDebugProbe(tag: string = 'probe') {
  if (!__DEV__) return; // biar bersih di APK release

  try {
    const s = await NetInfo.fetch();
    console.log(`[debug][${tag}] NetInfo isConnected=${s.isConnected} reachable=${s.isInternetReachable} type=${s.type}`);
  } catch (e) {
    console.log(`[debug][${tag}] NetInfo error`, String(e));
  }

  console.log(`[debug][${tag}] baseUrl = ${baseUrl}`);

  const url = `${baseUrl}/api/peralatan?badge=PING`;
  console.log(`[debug][${tag}] ping GET ${url}`);

  try {
    const res = await timeout(fetch(url));
    console.log(`[debug][${tag}] ping status = ${res.status}`);
  } catch (e) {
    console.log(`[debug][${tag}] ping error =`, String(e));
  }
}
