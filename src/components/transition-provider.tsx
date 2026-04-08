"use client";

import {
  createContext,
  useCallback,
  useContext,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type TransitionContextValue = {
  /** True while a `startNavTransition(router.refresh)` round-trip is in flight. */
  isNavigating: boolean;
  /** Wraps `router.refresh()` in a React transition so `isNavigating` is true during the fetch. */
  refreshWithTransition: () => void;
};

const TransitionContext = createContext<TransitionContextValue>({
  isNavigating: false,
  refreshWithTransition: () => {},
});

export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();

  const refreshWithTransition = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router, startTransition]);

  return (
    <TransitionContext value={{ isNavigating, refreshWithTransition }}>
      {children}
    </TransitionContext>
  );
}

export function useNavTransition() {
  return useContext(TransitionContext);
}
