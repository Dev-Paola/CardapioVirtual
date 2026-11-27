<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'payment_method' => ['required', Rule::in(['pix', 'delivery_card', 'delivery_cash'])],
            'change_for' => [
                'nullable',
                'numeric',
                'min:0',
                'max:999999.99',
                Rule::prohibitedIf($request->input('payment_method') !== 'delivery_cash'),
            ],
        ]);

        $order = $this->orders->create($validated);

        return response()->json([
            'message' => 'Pedido recebido com sucesso.',
            'order' => $order,
        ], 201);
    }
}
