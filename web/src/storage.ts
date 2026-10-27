function safeStorage(kind: "localStorage" | "sessionStorage") {
  const memory = new Map<string, string>();
  let unavailable = false;
  return {
    getItem(key: string): string | null {
      if (!unavailable)
        try {
          return window[kind].getItem(key);
        } catch {
          unavailable = true;
        }
      return memory.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
      if (!unavailable)
        try {
          window[kind].setItem(key, value);
        } catch {
          unavailable = true;
        }
    },
    removeItem(key: string) {
      memory.delete(key);
      if (!unavailable)
        try {
          window[kind].removeItem(key);
        } catch {
          unavailable = true;
        }
    },
  };
}
export const localStore = safeStorage("localStorage");
export const sessionStore = safeStorage("sessionStorage");
