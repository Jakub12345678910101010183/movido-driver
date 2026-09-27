const m = new Map<string, string>();
export const AFTER_FIRST_UNLOCK = 0;
export type SecureStoreOptions = Record<string, unknown>;
export const getItemAsync = async (k: string) => m.get(k) ?? null;
export const setItemAsync = async (k: string, v: string) => { m.set(k, v); };
export const deleteItemAsync = async (k: string) => { m.delete(k); };
