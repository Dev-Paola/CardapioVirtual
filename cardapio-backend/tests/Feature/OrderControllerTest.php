<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_rejects_an_empty_cart(): void
    {
        $this->postJson('/api/orders', [
            'items' => [],
            'payment_method' => 'pix',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('items');
    }

    public function test_it_rejects_an_invalid_order_payload(): void
    {
        $this->postJson('/api/orders', [
            'items' => [['product_id' => 1]],
            'payment_method' => 'pix',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.quantity');
    }

    public function test_it_rejects_a_nonexistent_product(): void
    {
        $this->postJson('/api/orders', [
            'items' => [['product_id' => 999, 'quantity' => 1]],
            'payment_method' => 'pix',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.product_id');
    }

    public function test_it_rejects_an_invalid_payment_method(): void
    {
        $product = $this->createProduct();

        $this->postJson('/api/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'bitcoin',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('payment_method');
    }

    public function test_it_creates_an_order_and_order_items(): void
    {
        $product = $this->createProduct();

        $response = $this->postJson('/api/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'payment_method' => 'pix',
        ]);

        $response->assertCreated()
            ->assertJsonPath('order.total', '20.50')
            ->assertJsonPath('order.items.0.product_name', 'Hambúrguer')
            ->assertJsonPath('order.items.0.unit_price', '10.25')
            ->assertJsonPath('order.items.0.quantity', 2)
            ->assertJsonPath('order.items.0.line_total', '20.50');

        $this->assertDatabaseHas('orders', [
            'id' => $response->json('order.id'),
            'total' => '20.50',
            'payment_method' => 'pix',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('order_items', [
            'order_id' => $response->json('order.id'),
            'product_id' => $product->id,
            'product_name' => 'Hambúrguer',
            'unit_price' => '10.25',
            'quantity' => 2,
            'line_total' => '20.50',
        ]);
    }

    private function createProduct(): Product
    {
        $category = Category::create([
            'name' => 'Lanches',
            'description' => null,
        ]);

        return Product::create([
            'category_id' => $category->id,
            'name' => 'Hambúrguer',
            'description' => null,
            'price' => '10.25',
            'image' => null,
            'is_active' => true,
        ]);
    }
}
