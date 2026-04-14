"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

  useEffect(() => {
    ignoredInitialDraft.current = false;
    setReadyToPersist(false);
    setHasStoredDraft(false);
    setRestoredFromDraft(false);
    setIsDirty(false);
    setValue(JSON.parse(initialSerialized) as T);
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

  useEffect(() => {
    setIsDirty(JSON.stringify(value) !== initialSerialized);
  }, [initialSerialized, value]);

  const restoreDraft = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      setValue(JSON.parse(raw) as T);
      setHasStoredDraft(false);
      setRestoredFromDraft(true);
    } catch {
      // Ignore malformed draft payloads.
    }
  }, [storageKey]);

  const discardDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore localStorage cleanup failures.
    }

    setHasStoredDraft(false);
    if (!ignoredInitialDraft.current) {
      setValue(JSON.parse(initialSerialized) as T);
      ignoredInitialDraft.current = true;
    }
  }, [initialSerialized, storageKey]);

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
    setValue,
    hasStoredDraft,
    restoredFromDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
    isDirty,
  };
}
