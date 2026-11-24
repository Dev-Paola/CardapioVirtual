use App\Http\Controllers\Api\MenuController;

// Rota de busca do cardápio integrada com o histórico em Deque
Route::get('/menu/search', [MenuController::class, 'search']);
