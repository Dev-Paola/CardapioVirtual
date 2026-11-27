<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'total',
        'payment_method',
        'change_for',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'decimal:2',
            'change_for' => 'decimal:2',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
