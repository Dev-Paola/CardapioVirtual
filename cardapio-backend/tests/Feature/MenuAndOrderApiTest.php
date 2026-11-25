<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MenuAndOrderApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_menu_search_matches_product_description_and_category_but_hides_unavailable_products(): void
    {
        $category = Category::create(['name' => 'Lanches']);
        $activeProduct = Product::create([
            'category_id' => $category->id,
            'name' => 'Sanduíche da casa',
            'description' => 'Queijo artesanal',
            'price' => 28.90,
            'is_active' => true,
        ]);
        Product::create([
            'category_id' => $category->id,
            'name' => 'Lanche indisponível',
            'description' => 'Queijo',
            'price' => 20,
            'is_active' => false,
        ]);

        $this->getJson('/api/menu/search?q=Lanches')
            ->assertOk()
            ->assertJsonPath('results.0.id', $activeProduct->id)
            ->assertJsonCount(1, 'results');
    }

    public function test_order_uses_database_prices_and_records_cash_change(): void
    {
        $category = Category::create(['name' => 'Lanches']);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Sanduíche da casa',
            'description' => 'Queijo artesanal',
            'price' => 28.90,
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
            'payment_method' => 'delivery_cash',
            'change_for' => 100,
        ]);

        $response->assertCreated()
            ->assertJsonPath('order.total', '57.80')
            ->assertJsonPath('order.payment_method', 'delivery_cash')
            ->assertJsonPath('order.change_for', '100.00')
            ->assertJsonPath('order.status', 'pending');

        $this->assertDatabaseHas('orders', ['total' => '57.80']);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $response->json('order.id'),
            'product_id' => $product->id,
            'unit_price' => '28.90',
            'quantity' => 2,
            'line_total' => '57.80',
        ]);
    }

    public function test_order_accepts_pix_with_no_cash_change(): void
    {
        $category = Category::create(['name' => 'Lanches']);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Sanduíche da casa',
            'description' => 'Queijo artesanal',
            'price' => 28.90,
            'is_active' => true,
        ]);

        $this->postJson('/api/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'pix',
            'change_for' => null,
        ])->assertCreated()
            ->assertJsonPath('order.payment_method', 'pix')
            ->assertJsonPath('order.change_for', null);
    }

    public function test_order_rejects_cash_change_less_than_the_server_calculated_total(): void
    {
        $category = Category::create(['name' => 'Lanches']);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Sanduíche da casa',
            'description' => 'Queijo artesanal',
            'price' => 28.90,
            'is_active' => true,
        ]);

        $this->postJson('/api/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'payment_method' => 'delivery_cash',
            'change_for' => 20,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('change_for');

        $this->assertSame(0, Order::count());
    }
}
