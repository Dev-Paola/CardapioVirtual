<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            // Chave estrangeira ligando o produto à sua categoria
            $table->foreignId('category_id')->constrained()->onDelete('cascade');
            $table->string('name'); // Nome do item (ex: X-Burguer Artesanal)
            $table->text('description')->nullable(); // Ingredientes/Detalhes
            $table->decimal('price', 8, 2); // Preço (ex: 35.90)
            $table->string('image')->nullable(); // Caminho da foto do prato
            $table->boolean('is_active')->default(true); // Se está disponível no cardápio
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
