import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartService } from './cart.service';
import { Checkout } from './checkout';

describe('Checkout', () => {
  let httpTesting: HttpTestingController;
  let cart: CartService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    cart = TestBed.inject(CartService);
  });

  afterEach(() => httpTesting.verify());

  it('clears the cart and renders confirmation after a successful order response', () => {
    cart.add({
      id: 1,
      name: 'X-Burger Clássico',
      category: 'Lanches',
      price: 28.9,
      description: 'Queijo e pão'
    });

    const fixture = TestBed.createComponent(Checkout);
    fixture.detectChanges();
    fixture.componentInstance.confirmOrder();

    expect(fixture.componentInstance.isSubmitting).toBe(true);

    httpTesting.expectOne('http://localhost:8000/api/orders').flush({
      message: 'Pedido recebido com sucesso.',
      order: {
        id: 12,
        total: '28.90',
        payment_method: 'pix',
        change_for: null,
        status: 'pending'
      }
    }, { status: 201, statusText: 'Created' });

    fixture.detectChanges();

    expect(fixture.componentInstance.isSubmitting).toBe(false);
    expect(fixture.componentInstance.orderConfirmed).toBe(true);
    expect(cart.items).toHaveLength(0);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Pedido finalizado!');
  });

  it('ends the loading state and keeps the cart when the API rejects the order', () => {
    cart.add({
      id: 1,
      name: 'X-Burger Clássico',
      category: 'Lanches',
      price: 28.9,
      description: 'Queijo e pão'
    });

    const fixture = TestBed.createComponent(Checkout);
    fixture.detectChanges();
    fixture.componentInstance.confirmOrder();

    httpTesting.expectOne('http://localhost:8000/api/orders').flush(
      { message: 'The items field is required.' },
      { status: 422, statusText: 'Unprocessable Content' }
    );

    fixture.detectChanges();

    expect(fixture.componentInstance.isSubmitting).toBe(false);
    expect(fixture.componentInstance.errorMessage).toBe('The items field is required.');
    expect(cart.items).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent)
      .toContain('The items field is required.');
  });

  it('ends the loading state and shows a connection message when the API is unreachable', () => {
    cart.add({
      id: 1,
      name: 'X-Burger Clássico',
      category: 'Lanches',
      price: 28.9,
      description: 'Queijo e pão'
    });

    const fixture = TestBed.createComponent(Checkout);
    fixture.detectChanges();
    fixture.componentInstance.confirmOrder();

    httpTesting.expectOne('http://localhost:8000/api/orders').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.componentInstance.isSubmitting).toBe(false);
    expect(fixture.componentInstance.errorMessage).toContain('Não foi possível conectar à API.');
    expect(cart.items).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent)
      .toContain('Não foi possível conectar à API.');
  });
});
