<?php

namespace App\Services;

class SearchHistoryService
{
    protected array $history = [];
    protected int $maxLimit;

    public function __construct(int $maxLimit = 10)
    {
        $this->maxLimit = $maxLimit;
    }

    /**
     * Adiciona um novo termo de busca no topo do histórico
     */
    public function addSearchTerm(string $term): void
    {
        $term = trim($term);
        if (empty($term)) {
            return;
        }

        $this->history = array_values(array_filter(
            $this->history,
            fn (string $item): bool => $item !== $term,
        ));
        array_unshift($this->history, $term);
        $this->history = array_slice($this->history, 0, $this->maxLimit);
    }

    /**
     * Retorna todos os termos recentes pesquisados
     */
    public function getRecentSearches(): array
    {
        return $this->history;
    }
}
