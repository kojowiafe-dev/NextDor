"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dispatchToast } from "@/components/ui/ToastContainer";

export type WishlistItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  image: string;
};

type WishlistContextValue = {
  items: WishlistItem[];
  wishlistCount: number;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (item: WishlistItem) => boolean;
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (productId: string) => void;
  clearWishlist: () => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);
const STORAGE_KEY = "nextdor_wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored) as WishlistItem[]);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadFromStorage();
    setHydrated(true);
  }, [loadFromStorage]);

  // Synchronize across tabs or custom in-window updates
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        loadFromStorage();
      }
    }

    function handleCustomUpdate() {
      loadFromStorage();
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("wishlist-updated", handleCustomUpdate);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("wishlist-updated", handleCustomUpdate);
    };
  }, [loadFromStorage]);

  // Save changes to localStorage
  const persistItems = useCallback((newItems: WishlistItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
      window.dispatchEvent(new Event("wishlist-updated"));
    } catch (err) {
      console.warn("Failed to persist wishlist to localStorage", err);
    }
  }, []);

  const isInWishlist = useCallback(
    (productId: string) => {
      return items.some((item) => item.id === productId);
    },
    [items]
  );

  const addToWishlist = useCallback(
    (item: WishlistItem) => {
      if (items.some((existing) => existing.id === item.id)) {
        return;
      }
      persistItems([...items, item]);
      dispatchToast({
        message: `Saved ${item.name} to wishlist`,
        variant: "wishlist",
        href: "/wishlist",
        actionLabel: "View",
      });
    },
    [items, persistItems]
  );

  const removeFromWishlist = useCallback(
    (productId: string) => {
      const target = items.find((item) => item.id === productId);
      persistItems(items.filter((item) => item.id !== productId));
      dispatchToast({
        message: target ? `Removed ${target.name} from wishlist` : "Removed from wishlist",
        variant: "wishlist",
      });
    },
    [items, persistItems]
  );

  const toggleWishlist = useCallback(
    (item: WishlistItem): boolean => {
      const exists = items.some((existing) => existing.id === item.id);
      if (exists) {
        persistItems(items.filter((existing) => existing.id !== item.id));
        dispatchToast({
          message: `Removed ${item.name} from wishlist`,
          variant: "wishlist",
        });
        return false;
      } else {
        persistItems([...items, item]);
        dispatchToast({
          message: `Saved ${item.name} to wishlist`,
          variant: "wishlist",
          href: "/wishlist",
          actionLabel: "View",
        });
        return true;
      }
    },
    [items, persistItems]
  );

  const clearWishlist = useCallback(() => {
    persistItems([]);
  }, [persistItems]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      wishlistCount: items.length,
      isInWishlist,
      toggleWishlist,
      addToWishlist,
      removeFromWishlist,
      clearWishlist,
    }),
    [items, isInWishlist, toggleWishlist, addToWishlist, removeFromWishlist, clearWishlist]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
