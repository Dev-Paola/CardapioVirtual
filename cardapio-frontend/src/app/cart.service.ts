import { Injectable } from '@angular/core';
import { MenuItem } from './menu-item';

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private cartItems: CartItem[] = [];

  get items(): CartItem[] {
    return this.cartItems;
  }

  get total(): number {
    return this.cartItems.reduce((sum, cartItem) => sum + cartItem.item.price * cartItem.quantity, 0);
  }

  add(item: MenuItem): void {
    const existing = this.cartItems.find((cartItem) => cartItem.item.id === item.id);

    if (existing) {
      existing.quantity += 1;
      return;
    }

    this.cartItems = [...this.cartItems, { item, quantity: 1 }];
  }

  decrease(itemId: number): void {
    const existing = this.cartItems.find((cartItem) => cartItem.item.id === itemId);

    if (!existing) {
      return;
    }

    if (existing.quantity === 1) {
      this.remove(itemId);
      return;
    }

    existing.quantity -= 1;
  }

  remove(itemId: number): void {
    this.cartItems = this.cartItems.filter((cartItem) => cartItem.item.id !== itemId);
  }

  clear(): void {
    this.cartItems = [];
  }
}
