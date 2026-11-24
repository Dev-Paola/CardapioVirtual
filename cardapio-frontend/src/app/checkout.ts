import { CurrencyPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from './cart.service';
import { CreateOrderRequest, MenuApiService } from './menu-api.service';

type PaymentMethod = CreateOrderRequest['payment_method'];

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RouterLink],
  templateUrl: './checkout.html'
})
export class Checkout {
  paymentMethod: PaymentMethod = 'pix';
  confirmedPayment: PaymentMethod | null = null;
  confirmedTotal: number = 0;
  confirmedChangeFor: number | null = null;
  confirmedOrderId: number | null = null;
  orderConfirmed: boolean = false;
  isSubmitting = false;
  errorMessage = '';
  changeFor: number | null = null;

  constructor(
    readonly cart: CartService,
    private readonly menuApi: MenuApiService
  ) {}

  confirmOrder(): void {
    if (this.isSubmitting || this.cart.items.length === 0) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.menuApi.createOrder({
      items: this.cart.items.map(({ item, quantity }) => ({
        product_id: item.id,
        quantity
      })),
      payment_method: this.paymentMethod,
      change_for: this.paymentMethod === 'delivery_cash' ? this.changeFor : null
    }).subscribe({
      next: ({ order }) => {
        this.confirmedTotal = Number(order.total);
        this.confirmedPayment = order.payment_method;
        this.confirmedChangeFor = order.change_for === null ? null : Number(order.change_for);
        this.confirmedOrderId = order.id;
        this.cart.clear();
        this.orderConfirmed = true;
        this.isSubmitting = false;
      },
      error: (error: { error?: { message?: string } }) => {
        this.errorMessage = error.error?.message
          ?? 'Não foi possível enviar o pedido. Verifique sua conexão e tente novamente.';
        this.isSubmitting = false;
      }
    });
  }
}
