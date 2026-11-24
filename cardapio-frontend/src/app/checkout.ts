import { CurrencyPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from './cart.service';

type PaymentMethod = 'pix' | 'cash' | 'card';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class Checkout {
  paymentMethod: PaymentMethod = 'pix';
  confirmedPayment: PaymentMethod | null = null;
  confirmedTotal: number = 0;
  orderConfirmed: boolean = false;

  constructor(readonly cart: CartService) {}

  confirmOrder(): void {
    this.confirmedTotal = this.cart.total;
    this.confirmedPayment = this.paymentMethod;
    this.cart.clear();
    this.orderConfirmed = true;
  }
}
