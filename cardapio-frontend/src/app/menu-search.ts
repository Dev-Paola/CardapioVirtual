import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-menu-search',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './menu-search.html',
  styleUrl: './menu-search.css'
})
export class MenuSearch {
  @Input() searchTerm: string = '';
  @Input() recentSearches: string[] = [];

  @Output() searchTermChange = new EventEmitter<string>();
  @Output() searchSubmitted = new EventEmitter<string>();
  @Output() recentSearchSelected = new EventEmitter<string>();
}
