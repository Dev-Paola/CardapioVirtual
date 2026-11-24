import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MenuItem } from './menu-item';

interface ApiMenuProduct {
  id: number;
  name: string;
  description: string | null;
  price: string | number;
  category?: { name: string } | null;
  category_name?: string;
}

export interface MenuSearchResponse {
  query: string;
  results: ApiMenuProduct[];
  recent_searches: string[];
}

export interface CreateOrderRequest {
  items: Array<{ product_id: number; quantity: number }>;
  payment_method: 'pix' | 'delivery_card' | 'delivery_cash';
  change_for: number | null;
}

export interface CreateOrderResponse {
  message: string;
  order: {
    id: number;
    total: string | number;
    payment_method: CreateOrderRequest['payment_method'];
    change_for: string | number | null;
    status: string;
  };
}

@Injectable({ providedIn: 'root' })
export class MenuApiService {
  private readonly apiUrl = 'http://localhost:8000/api';

  constructor(private readonly http: HttpClient) {}

  search(term: string): Observable<MenuSearchResponse> {
    return this.http.get<MenuSearchResponse>(`${this.apiUrl}/menu/search`, {
      params: { q: term }
    });
  }

  createOrder(order: CreateOrderRequest): Observable<CreateOrderResponse> {
    return this.http.post<CreateOrderResponse>(`${this.apiUrl}/orders`, order);
  }

  toMenuItem(product: ApiMenuProduct): MenuItem {
    return {
      id: product.id,
      name: product.name,
      category: product.category?.name ?? product.category_name ?? 'Outros',
      price: Number(product.price),
      description: product.description ?? ''
    };
  }
}
