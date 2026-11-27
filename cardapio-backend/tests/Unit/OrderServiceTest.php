<?php

namespace Tests\Unit;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class OrderServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_recalculates_order_prices_using_the_database_product_price(): void
    {
        $product = $this->createProduct('Hambúrguer', '12.50');

        $order = app(OrderService::class)->create([
            'payment_method' => 'pix',
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 2,
                'product_name' => 'Nome adulterado',
                'price' => '0.01',
                'unit_price' => '0.01',
                'line_total' => '0.02',
            ]],
        ]);

        $this->assertSame('25.00', $order->total);
        $this->assertSame('Hambúrguer', $order->items->first()->product_name);
        $this->assertSame('12.50', $order->items->first()->unit_price);
        $this->assertSame('25.00', $order->items->first()->line_total);
    }

    public function test_order_item_keeps_product_name_and_price_snapshot_after_product_changes(): void
    {
        $product = $this->createProduct('Pizza original', '32.90');

        $order = app(OrderService::class)->create([
            'payment_method' => 'pix',
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
            ]],
        ]);

        $product->update([
            'name' => 'Pizza atualizada',
            'price' => '40.00',
        ]);

        $item = $order->items->first();
        $this->assertSame('Pizza original', $item->product_name);
        $this->assertSame('32.90', $item->unit_price);

        $this->assertDatabaseHas('order_items', [
            'id' => $item->id,
            'product_name' => 'Pizza original',
            'unit_price' => '32.90',
        ]);
    }

    public function test_it_throws_and_rolls_back_when_a_product_is_unavailable(): void
    {
        $availableProduct = $this->createProduct('Disponível', '8.00');
        $unavailableProduct = $this->createProduct('Indisponível', '9.00', false);

        try {
            app(OrderService::class)->create([
                'payment_method' => 'pix',
                'items' => [
                    ['product_id' => $availableProduct->id, 'quantity' => 1],
                    ['product_id' => $unavailableProduct->id, 'quantity' => 1],
                ],
            ]);

            $this->fail('A ValidationException deveria ter sido lançada.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('items', $exception->errors());
        }

        $this->assertSame(0, Order::query()->count());
        $this->assertDatabaseCount('order_items', 0);
    }

    private function createProduct(string $name, string $price, bool $isActive = true): Product
    {
        $category = Category::create([
            'name' => 'Lanches',
            'description' => null,
        ]);

        return Product::create([
            'category_id' => $category->id,
            'name' => $name,
            'description' => null,
            'price' => $price,
            'image' => null,
            'is_active' => $isActive,
        ]);
    }
}
