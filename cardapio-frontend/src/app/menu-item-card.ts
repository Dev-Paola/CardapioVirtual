import { CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MenuItem } from './menu-item';

@Component({
  selector: 'app-menu-item-card',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './menu-item-card.html'
})
export class MenuItemCard {
  @Input({ required: true }) item!: MenuItem;
  @Output() addToCart = new EventEmitter<MenuItem>();
}
