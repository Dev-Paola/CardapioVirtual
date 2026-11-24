import { Routes } from '@angular/router';
import { Cart } from './cart';
import { Checkout } from './checkout';
import { Menu } from './menu';

export const routes: Routes = [
  { path: '', component: Menu },
  { path: 'carrinho', component: Cart },
  { path: 'compra', component: Checkout },
  { path: '**', redirectTo: '' }
];
