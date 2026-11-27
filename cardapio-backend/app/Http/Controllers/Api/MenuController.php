<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\SearchHistoryService;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;

class MenuController extends Controller
{
    protected SearchHistoryService $searchHistory;

    public function __construct(SearchHistoryService $searchHistory)
    {
        $this->searchHistory = $searchHistory;
    }

    public function search(Request $request)
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $query = trim($validated['q'] ?? '');

        if ($query !== '') {
            $this->searchHistory->addSearchTerm($query);
        }

        $products = Product::query()
            ->with('category')
            ->where('is_active', true)
            ->when($query !== '', function (Builder $products) use ($query): void {
                $products->where(function (Builder $products) use ($query): void {
                    $products->where('name', 'like', "%{$query}%")
                        ->orWhere('description', 'like', "%{$query}%")
                        ->orWhereHas('category', function (Builder $category) use ($query): void {
                            $category->where('name', 'like', "%{$query}%");
                        });
                });
            })
            ->orderBy('name')
            ->get();

        return response()->json([
            'query' => $query,
            'results' => $products,
            'recent_searches' => $this->searchHistory->getRecentSearches(),
        ]);
    }
}
