<?php

use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\OrderController;

Route::get('/menu/search', [MenuController::class, 'search']);
Route::post('/orders', [OrderController::class, 'store']);
