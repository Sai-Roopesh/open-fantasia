"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export function useLocalDraft<T>({
  storageKey,
  initialValue,
}: {
  storageKey: string;
  initialValue: T;
}) {
  const initialSerialized = useMemo(
    () => JSON.stringify(initialValue),
    [initialValue],
  );
  const [value, setValue] = useState<T>(() => initialValue);
  const [hasStoredDraft, setHasStoredDraft] = useState(false);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const ignoredInitialDraft = useRef(false);
  const [readyToPersist, setReadyToPersist] = useState(false);
  const initialSerializedRef = useRef(initialSerialized);
  const valueRef = useRef(value);

  const commitValue = useCallback((nextValue: T) => {
    valueRef.current = nextValue;
    setValue(nextValue);
    setIsDirty(JSON.stringify(nextValue) !== initialSerializedRef.current);
  }, []);

  useEffect(() => {
    initialSerializedRef.current = initialSerialized;
    ignoredInitialDraft.current = false;
    setReadyToPersist(false);
    setHasStoredDraft(false);
    setRestoredFromDraft(false);
    setIsDirty(false);
    const nextValue = JSON.parse(initialSerialized) as T;
    valueRef.current = nextValue;
    setValue(nextValue);
  }, [initialSerialized, storageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;

      if (raw === initialSerialized) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      setHasStoredDraft(true);
    } catch {
      // Ignore localStorage access failures in non-browser or locked-down contexts.
    } finally {
      setReadyToPersist(true);
    }
  }, [initialSerialized, storageKey]);

  useEffect(() => {
    if (!readyToPersist) return;
    try {
      const serialized = JSON.stringify(value);
      if (serialized === initialSerialized) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      window.localStorage.setItem(storageKey, serialized);
    } catch {
      // Ignore localStorage persistence failures.
    }
  }, [initialSerialized, readyToPersist, storageKey, value]);

  const setDraftValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      const resolved =
        typeof nextValue === "function"
          ? (nextValue as (currentValue: T) => T)(valueRef.current)
          : nextValue;

      commitValue(resolved);
    },
    [commitValue],
  );

  const restoreDraft = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      commitValue(JSON.parse(raw) as T);
      setHasStoredDraft(false);
      setRestoredFromDraft(true);
    } catch {
      // Ignore malformed draft payloads.
    }
  }, [commitValue, storageKey]);

  const discardDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore localStorage cleanup failures.
    }

    setHasStoredDraft(false);
    if (!ignoredInitialDraft.current) {
      commitValue(JSON.parse(initialSerialized) as T);
      ignoredInitialDraft.current = true;
    }
  }, [commitValue, initialSerialized, storageKey]);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore localStorage cleanup failures.
    }

    setHasStoredDraft(false);
    setRestoredFromDraft(false);
  }, [storageKey]);

  return {
    value,
    setValue: setDraftValue,
    hasStoredDraft,
    restoredFromDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
    isDirty,
  };
}
