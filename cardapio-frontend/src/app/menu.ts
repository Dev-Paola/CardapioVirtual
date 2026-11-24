import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from './cart.service';
import { MenuItemCard } from './menu-item-card';
import { MenuItem } from './menu-item';
import { MenuSearch } from './menu-search';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [],
  templateUrl: './menu.html',
  styleUrl: './menu.css'
})
export class Menu {
  searchTerm: string = '';
  recentSearches: string[] = ['Hambúrguer Artesanal', 'Pizza Calabresa', 'Batata Rústica'];

  menuItems: MenuItem[] = [
    {
      id: 1,
      name: 'X-Burger Clássico',
      category: 'Lanches',
      price: 28.90,
      description: 'Pão brioche, blend 180g, queijo prato e maionese da casa.'
    },
    {
      id: 2,
      name: 'Pizza Calabresa',
      category: 'Pizzas',
      price: 45.00,
      description: 'Molho de tomate artesanal, mussarela, calabresa fatiada e cebola roxa.'
    },
    {
      id: 3,
      name: 'Batata Rústica',
      category: 'Porções',
      price: 19.50,
      description: 'Batatas cortadas à mão com alecrim e páprica defumada.'
    },
    {
      id: 4,
      name: 'Hambúrguer Artesanal',
      category: 'Lanches',
      price: 34.00,
      description: 'Blend bovino 200g na brasa, cheddar inglês, bacon crocante e molho especial.'
    }
  ];

  filteredItems: MenuItem[] = [...this.menuItems];

  constructor(
    private readonly router: Router,
    private readonly cartService: CartService
  ) {}

  onSearch(searchTerm: string = this.searchTerm): void {
    const term = searchTerm.trim();
    this.searchTerm = searchTerm;

    if (!term) {
      this.filteredItems = [...this.menuItems];
      return;
    }

    this.recentSearches = [
      term,
      ...this.recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase())
    ].slice(0, 5);

    const lowerTerm = term.toLowerCase();
    this.filteredItems = this.menuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerTerm) ||
        item.category.toLowerCase().includes(lowerTerm) ||
        item.description.toLowerCase().includes(lowerTerm)
    );
  }

  select(term: string): void {
    this.searchTerm = term;
    this.onSearch(term);
  }

  addToCart(item: MenuItem): void {
    this.cartService.add(item);
    void this.router.navigate(['/carrinho']);
  }
}
