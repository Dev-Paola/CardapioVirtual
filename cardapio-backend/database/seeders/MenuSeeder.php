<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;

class MenuSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            [
                'category' => 'Lanches',
                'name' => 'X-Burger Clássico',
                'description' => 'Pão brioche, blend 180g, queijo prato e maionese da casa.',
                'price' => 28.90,
            ],
            [
                'category' => 'Pizzas',
                'name' => 'Pizza Calabresa',
                'description' => 'Molho de tomate artesanal, mussarela, calabresa fatiada e cebola roxa.',
                'price' => 45.00,
            ],
            [
                'category' => 'Porções',
                'name' => 'Batata Rústica',
                'description' => 'Batatas cortadas à mão com alecrim e páprica defumada.',
                'price' => 19.50,
            ],
            [
                'category' => 'Lanches',
                'name' => 'Hambúrguer Artesanal',
                'description' => 'Blend bovino 200g na brasa, cheddar inglês, bacon crocante e molho especial.',
                'price' => 34.00,
            ],
        ];

        foreach ($items as $item) {
            $category = Category::firstOrCreate(['name' => $item['category']]);

            Product::updateOrCreate(
                ['category_id' => $category->id, 'name' => $item['name']],
                [
                    'description' => $item['description'],
                    'price' => $item['price'],
                    'is_active' => true,
                ],
            );
        }
    }
}
