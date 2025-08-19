// src/utils/EventBus.ts
type Events = {
  'apar:refresh': { id?: string; token?: string } | void;
};

type Listener<K extends keyof Events> = (payload: Events[K]) => void;

const store: { [K in keyof Events]?: Set<Listener<K>> } = {};

export function on<K extends keyof Events>(name: K, fn: Listener<K>) {
  (store[name] ||= new Set()).add(fn as any);
  return () => off(name, fn);
}

export function off<K extends keyof Events>(name: K, fn: Listener<K>) {
  store[name]?.delete(fn as any);
}

export function emit<K extends keyof Events>(name: K, payload: Events[K] extends void ? undefined : Events[K] = undefined as any) {
  store[name]?.forEach((fn) => (fn as any)(payload));
}
