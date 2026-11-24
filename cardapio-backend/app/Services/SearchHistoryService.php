<?php

namespace App\Services;

use Ds\Deque;

class SearchHistoryService
{
    protected Deque $history;
    protected int $maxLimit;

    public function __construct(int $maxLimit = 10)
    {
        // Inicializa o Deque otimizado em C da extensão ext-ds
        $this->history = new Deque();
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

        // Remove duplicados se já existirem para reordenar no topo
        $filtered = $this->history->filter(fn($item) => $item !== $term);
        $this->history = $filtered;

        // Adiciona no início do Deque
        $this->history->unshift($term);

        // Limita o tamanho máximo do histórico
        if ($this->history->count() > $this->maxLimit) {
            $this->history->pop(); // Remove o elemento mais antigo do fim
        }
    }

    /**
     * Retorna todos os termos recentes pesquisados
     */
    public function getRecentSearches(): array
    {
        return $this->history->toArray();
    }
}
