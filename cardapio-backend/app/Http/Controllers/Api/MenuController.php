<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SearchHistoryService;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    protected SearchHistoryService $searchHistory;

    public function __construct(SearchHistoryService $searchHistory)
    {
        $this->searchHistory = $searchHistory;
    }

    public function search(Request $request)
    {
        $query = $request->input('q', '');

        // Se houver termo de busca, armazena no Deque de histórico
        if (!empty($query)) {
            $this->searchHistory->addSearchTerm($query);
        }

        // Simulação de retorno de produtos do cardápio filtrados
        // (Aqui integrará depois com a Model Product)
        return response()->json([
            'query' => $query,
            'results' => [], // Resultados da busca
            'recent_searches' => $this->searchHistory->getRecentSearches()
        ]);
    }
}
