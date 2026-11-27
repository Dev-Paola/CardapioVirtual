import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, TimeoutError } from 'rxjs';
import { CartService } from './cart.service';
import { CreateOrderRequest, MenuApiService } from './menu-api.service';

type PaymentMethod = CreateOrderRequest['payment_method'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
    private readonly menuApi: MenuApiService,
    private readonly changeDetector: ChangeDetectorRef
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
    }).pipe(
      finalize(() => {
        this.isSubmitting = false;
        this.changeDetector.markForCheck();
      })
    ).subscribe({
      next: ({ order }) => {
        this.confirmedTotal = Number(order.total);
        this.confirmedPayment = order.payment_method;
        this.confirmedChangeFor = order.change_for === null ? null : Number(order.change_for);
        this.confirmedOrderId = order.id;
        this.cart.clear();
        this.orderConfirmed = true;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.errorMessage = this.getOrderErrorMessage(error);
        this.changeDetector.markForCheck();
      }
    });
  }

  private getOrderErrorMessage(error: unknown): string {
    if (error instanceof TimeoutError) {
      return 'A API demorou para confirmar o pedido. Verifique se ele foi registrado antes de tentar novamente.';
    }

    if (!(error instanceof HttpErrorResponse)) {
      return 'Não foi possível confirmar o pedido. Tente novamente.';
    }

    if (error.status === 0) {
      return 'Não foi possível conectar à API. Verifique a conexão e as configurações de CORS.';
    }

    if (isRecord(error.error) && typeof error.error['message'] === 'string') {
      return error.error['message'];
    }

    return `Não foi possível enviar o pedido (HTTP ${error.status}).`;
  }
}
