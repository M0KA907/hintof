export type Unsubscribe = () => void;

export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<(s: T) => void>();

  return {
    get: () => state,
    set: (next: T) => {
      state = next;
      listeners.forEach((l) => l(state));
    },
    update: (fn: (s: T) => T) => {
      state = fn(state);
      listeners.forEach((l) => l(state));
    },
    subscribe: (listener: (s: T) => void): Unsubscribe => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select<U>(selector: (s: T) => U, onChange: (v: U) => void): Unsubscribe {
      let current = selector(state);
      const listener = (s: T) => {
        const next = selector(s);
        if (next !== current) {
          current = next;
          onChange(next);
        }
      };
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
