import { useCallback, useMemo } from 'preact/hooks';
import { useLocalStorage } from './useLocalStorage';
import type { Cart, CartItem } from '@/types/material';

const CART_KEY = 'falp_cart';

const initialCart: Cart = { items: {} };

export function useCart() {
  const [cart, setCart] = useLocalStorage<Cart>(CART_KEY, initialCart);

  const addItem = useCallback((materialId: string, quantity: number = 1) => {
    setCart(prev => ({
      items: {
        ...prev.items,
        [materialId]: {
          materialId,
          quantity: (prev.items[materialId]?.quantity || 0) + quantity,
          addedAt: new Date().toISOString()
        }
      }
    }));
  }, [setCart]);

  const removeItem = useCallback((materialId: string) => {
    setCart(prev => {
      const { [materialId]: _, ...rest } = prev.items;
      return { items: rest };
    });
  }, [setCart]);

  const updateQuantity = useCallback((materialId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(materialId);
      return;
    }
    setCart(prev => ({
      items: {
        ...prev.items,
        [materialId]: {
          ...prev.items[materialId],
          materialId,
          quantity
        }
      }
    }));
  }, [setCart, removeItem]);

  const clearCart = useCallback(() => {
    setCart(initialCart);
  }, [setCart]);

  const itemCount = useMemo(() => {
    return Object.values(cart.items).reduce((sum, item) => sum + item.quantity, 0);
  }, [cart.items]);

  const materialIds = useMemo(() => Object.keys(cart.items), [cart.items]);

  const getItem = useCallback((materialId: string): CartItem | undefined => {
    return cart.items[materialId];
  }, [cart.items]);

  return {
    cart,
    items: cart.items,
    itemCount,
    materialIds,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getItem
  };
}
