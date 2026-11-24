import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, of, Subject, switchMap } from 'rxjs';
import { CartService } from './cart.service';
import { MenuApiService, MenuSearchResponse } from './menu-api.service';
import { MenuItemCard } from './menu-item-card';
import { MenuItem } from './menu-item';
import { MenuSearch } from './menu-search';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [MenuItemCard, MenuSearch],
  templateUrl: './menu.html',
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
  isLoading = false;
  apiUnavailable = false;
  private readonly searchRequests = new Subject<string>();

  constructor(
    private readonly router: Router,
    private readonly cartService: CartService,
    private readonly menuApi: MenuApiService
  ) {
    this.searchRequests.pipe(
      switchMap((term) => {
        this.isLoading = true;
        return this.menuApi.search(term).pipe(
          map((response) => ({ response, term })),
          catchError(() => of({ response: null, term }))
        );
      })
    ).subscribe(({ response, term }) => {
      this.isLoading = false;
      this.apiUnavailable = response === null;

      if (response) {
        this.applyApiResponse(response, term);
        return;
      }

      this.applyLocalSearch(term);
    });

    this.searchRequests.next('');
  }

  onSearch(searchTerm: string = this.searchTerm): void {
    const term = searchTerm.trim();
    this.searchTerm = searchTerm;

    if (term) this.addRecentSearch(term);
    this.searchRequests.next(term);
  }

  select(term: string): void {
    this.searchTerm = term;
    this.onSearch(term);
  }

  addToCart(item: MenuItem): void {
    this.cartService.add(item);
    void this.router.navigate(['/carrinho']);
  }

  private applyApiResponse(response: MenuSearchResponse, term: string): void {
    this.menuItems = response.results.map((product) => this.menuApi.toMenuItem(product));
    this.filteredItems = [...this.menuItems];
    this.recentSearches = [...response.recent_searches, ...this.recentSearches]
      .filter((search, index, searches) =>
        searches.findIndex((value) => value.toLowerCase() === search.toLowerCase()) === index
      )
      .slice(0, 5);
    if (term) this.addRecentSearch(term);
  }

  private applyLocalSearch(term: string): void {
    const lowerTerm = term.toLowerCase();
    this.filteredItems = this.menuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerTerm) ||
        item.category.toLowerCase().includes(lowerTerm) ||
        item.description.toLowerCase().includes(lowerTerm)
    );
  }

  private addRecentSearch(term: string): void {
    this.recentSearches = [
      term,
      ...this.recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase())
    ].slice(0, 5);
  }
}
