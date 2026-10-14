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

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  currency: string;
  quantity: number;
  maxQty?: number | null;
  isBackorder?: boolean;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "nextdor-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored) as CartItem[]);
      }
    } catch {
      setItems([]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      setItems((current) => {
        const existing = current.find(
          (entry) => entry.productId === item.productId,
        );

        if (existing) {
          const requestedQty = existing.quantity + quantity;
          const finalQty = !existing.isBackorder && existing.maxQty != null ? Math.min(requestedQty, existing.maxQty) : requestedQty;
          return current.map((entry) =>
            entry.productId === item.productId
              ? {
                  ...entry,
                  quantity: finalQty,
                  maxQty: item.maxQty !== undefined ? item.maxQty : entry.maxQty,
                  isBackorder: item.isBackorder !== undefined ? item.isBackorder : entry.isBackorder,
                }
              : entry,
          );
        }

        const initialQty = !item.isBackorder && item.maxQty != null ? Math.min(quantity, item.maxQty) : quantity;
        return [...current, { ...item, quantity: initialQty }];
      });
    },
    [],
  );

  const removeItem = useCallback((productId: string) => {
    setItems((current) =>
      current.filter((entry) => entry.productId !== productId),
    );
  }, []);

  const updateQty = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((current) =>
        current.filter((entry) => entry.productId !== productId),
      );
      return;
    }

    setItems((current) =>
      current.map((entry) => {
        if (entry.productId !== productId) return entry;
        const finalQty = !entry.isBackorder && entry.maxQty != null ? Math.min(quantity, entry.maxQty) : quantity;
        return { ...entry, quantity: finalQty };
      }),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      ),
      addItem,
      removeItem,
      updateQty,
      clearCart,
    }),
    [items, addItem, removeItem, updateQty, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
