<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function create(array $data): Order
    {
        return DB::transaction(function () use ($data): Order {
            $products = Product::query()
                ->whereIn('id', array_column($data['items'], 'product_id'))
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $lineItems = [];
            $totalInCents = 0;

            foreach ($data['items'] as $item) {
                $product = $products->get($item['product_id']);

                if (!$product || !$product->is_active) {
                    throw ValidationException::withMessages([
                        'items' => ['Um ou mais produtos não estão disponíveis. Atualize o cardápio e tente novamente.'],
                    ]);
                }

                $unitPriceInCents = (int) round((float) $product->price * 100);
                $lineTotalInCents = $unitPriceInCents * $item['quantity'];
                $totalInCents += $lineTotalInCents;
                $lineItems[] = [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'unit_price' => $unitPriceInCents,
                    'quantity' => $item['quantity'],
                    'line_total' => $lineTotalInCents,
                ];
            }

            $changeForInCents = isset($data['change_for'])
                ? (int) round((float) $data['change_for'] * 100)
                : null;

            if ($data['payment_method'] === 'delivery_cash'
                && $changeForInCents !== null
                && $changeForInCents < $totalInCents) {
                throw ValidationException::withMessages([
                    'change_for' => ['O valor para troco deve ser igual ou superior ao total do pedido.'],
                ]);
            }

            $order = Order::create([
                'total' => number_format($totalInCents / 100, 2, '.', ''),
                'payment_method' => $data['payment_method'],
                'change_for' => $changeForInCents === null
                    ? null
                    : number_format($changeForInCents / 100, 2, '.', ''),
                'status' => 'pending',
            ]);

            foreach ($lineItems as $lineItem) {
                $order->items()->create([
                    'product_id' => $lineItem['product_id'],
                    'product_name' => $lineItem['product_name'],
                    'unit_price' => number_format($lineItem['unit_price'] / 100, 2, '.', ''),
                    'quantity' => $lineItem['quantity'],
                    'line_total' => number_format($lineItem['line_total'] / 100, 2, '.', ''),
                ]);
            }

            return $order->load('items');
        });
    }
}
