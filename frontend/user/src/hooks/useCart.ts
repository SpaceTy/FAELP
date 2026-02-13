import { signal } from '@preact/signals';
import type { Cart } from '@/types/material';

const CART_KEY = 'falp_cart';

function loadCart(): Cart {
  try {
    const item = localStorage.getItem(CART_KEY);
    return item ? JSON.parse(item) : { items: {} };
  } catch {
    return { items: {} };
  }
}

export const cartSignal = signal<Cart>(loadCart());

function save() {
  localStorage.setItem(CART_KEY, JSON.stringify(cartSignal.value));
}

export function addItem(materialId: string, quantity = 1) {
  cartSignal.value = {
    items: {
      ...cartSignal.value.items,
      [materialId]: {
        materialId,
        quantity: (cartSignal.value.items[materialId]?.quantity || 0) + quantity,
        addedAt: new Date().toISOString()
      }
    }
  };
  save();
}

export function removeItem(materialId: string) {
  const { [materialId]: _, ...rest } = cartSignal.value.items;
  cartSignal.value = { items: rest };
  save();
}

export function updateQuantity(materialId: string, quantity: number) {
  if (quantity <= 0) return removeItem(materialId);
  cartSignal.value = {
    items: { ...cartSignal.value.items, [materialId]: { ...cartSignal.value.items[materialId], materialId, quantity } }
  };
  save();
}

export function clearCart() {
  cartSignal.value = { items: {} };
  save();
}

export function getItem(materialId: string) {
  return cartSignal.value.items[materialId];
}

export function getItemCount() {
  return Object.values(cartSignal.value.items).reduce((sum, item) => sum + item.quantity, 0);
}
