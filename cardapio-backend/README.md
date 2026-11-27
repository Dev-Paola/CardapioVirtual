# Backend — API do Cardápio Virtual

Eu desenvolvi a API com Laravel 13 e PHP 8.3. Neste documento, registro as decisões internas de modelagem, persistência, contrato HTTP e testes. A visão geral do sistema e a inicialização básica do Docker Compose estão no README da raiz.

## Modelagem de dados e Eloquent ORM

Eu organizei o catálogo e os pedidos em quatro tabelas de domínio. As migrations também criam tabelas padrão do Laravel para usuários, cache e filas.

| Tabela | Colunas de domínio e tipos | Integridade e finalidade |
| --- | --- | --- |
| `categories` | `id` auto-incremental; `name` string; `description` text anulável; `created_at` e `updated_at`. | Organiza os produtos. |
| `products` | `id`; `category_id` como chave estrangeira; `name` string; `description` text anulável; `price` decimal(8,2); `image` string anulável; `is_active` booleano com padrão `true`; timestamps. | `category_id` referencia `categories.id` e usa `ON DELETE CASCADE`: ao excluir uma categoria, seus produtos também são removidos. |
| `orders` | `id`; `total` decimal(10,2); `payment_method` string(30); `change_for` decimal(10,2) anulável; `status` string(30) com padrão `pending`; timestamps. | Registra o total calculado, a forma de pagamento, o troco opcional e o estado do pedido. |
| `order_items` | `id`; `order_id` e `product_id` como chaves estrangeiras; `product_name` string; `unit_price` e `line_total` decimal(10,2); `quantity` unsigned small integer; timestamps. | `order_id` usa `ON DELETE CASCADE`; `product_id` é anulável e usa `ON DELETE SET NULL`. |

Eu escolhi `DECIMAL` para armazenar valores monetários com precisão fixa. O serviço de pedidos ainda calcula em centavos inteiros e só formata os valores para gravação ao persistir o pedido. O limite de quantidade aceito pela API é menor que o máximo do tipo SQL: o controller aceita quantidades de 1 a 99.

A combinação de `product_id` anulável com `product_name`, `unit_price`, `quantity` e `line_total` preserva o snapshot financeiro do item quando um produto é excluído. A chave estrangeira é definida como `null`, mas o registro do item e os valores históricos permanecem. Em contrapartida, excluir o pedido remove seus itens por cascata, conforme a relação de propriedade entre `orders` e `order_items`.

### Models, atribuição em massa e relacionamentos

Eu uso `$fillable` para declarar quais atributos cada model aceita em atribuições em massa, como `Model::create()` e `items()->create()`. Isso restringe os campos preenchíveis por essas operações; não substitui a validação dos dados de entrada, que faço no controller.

| Model | Campos em `$fillable` | Relacionamentos e casts |
| --- | --- | --- |
| `Category` | `name`, `description` | `products(): HasMany` representa uma categoria com vários produtos. |
| `Product` | `category_id`, `name`, `description`, `price`, `image`, `is_active` | `category(): BelongsTo` aponta para a categoria. Não declaro casts personalizados neste model. |
| `Order` | `total`, `payment_method`, `change_for`, `status` | `items(): HasMany`; converto `total` e `change_for` para `decimal:2`. |
| `OrderItem` | `product_id`, `product_name`, `unit_price`, `quantity`, `line_total` | `order(): BelongsTo` e `product(): BelongsTo`; converto `unit_price` e `line_total` para `decimal:2`. |

Eu uso `hasMany` e `belongsTo` para expressar as chaves estrangeiras e aproveitar as operações do Eloquent. Por exemplo, `OrderService` grava cada item por meio de `$order->items()->create(...)`, o que associa o `order_id` sem recebê-lo do cliente. Os casts decimais mantêm uma representação consistente na leitura e serialização dos valores financeiros de pedidos e itens.

## Contrato HTTP e fluxo da API

Em `routes/api.php`, eu declaro as rotas abaixo. O bootstrap do Laravel aplica o prefixo `api` ao arquivo de rotas:

| Método e endpoint | Entrada | Resposta de sucesso |
| --- | --- | --- |
| `GET /api/menu/search` | Parâmetro opcional `q`, string com até 100 caracteres. | `200 OK`, com `query`, `results` e `recent_searches`. |
| `POST /api/orders` | JSON com `items`, `payment_method` e, quando aplicável, `change_for`. | `201 Created`, com mensagem e pedido persistido, incluindo seus itens. |

### Busca de produtos

Em `MenuController::search`, eu valido `q`, removo espaços nas extremidades e consulto somente produtos ativos. Quando o termo não está vazio, procuro correspondências no nome, descrição ou nome da categoria; carrego a categoria com `with('category')` e ordeno os resultados por nome. Se a validação falhar, o Laravel responde `422`.

Exemplo de chamada:

```http
GET /api/menu/search?q=Pizza
Accept: application/json
```

Exemplo representativo de resposta `200`, usando o produto de demonstração `Pizza Calabresa`:

```json
{
  "query": "Pizza",
  "results": [{
    "id": 2,
    "category_id": 2,
    "name": "Pizza Calabresa",
    "description": "Molho de tomate artesanal, mussarela, calabresa fatiada e cebola roxa.",
    "price": "45.00",
    "image": null,
    "is_active": true,
    "created_at": "2026-11-27T12:00:00.000000Z",
    "updated_at": "2026-11-27T12:00:00.000000Z",
    "category": {
      "id": 2,
      "name": "Pizzas",
      "description": null,
      "created_at": "2026-11-27T12:00:00.000000Z",
      "updated_at": "2026-11-27T12:00:00.000000Z"
    }
  }],
  "recent_searches": ["Pizza"]
}
```

Os IDs e timestamps do exemplo dependem do banco; os campos representam a serialização do model e da categoria carregada. O `SearchHistoryService` mantém até dez termos em memória, sem persistência entre requisições ou processos.

### Criação de pedidos

Em `OrderController::store`, eu valido de 1 a 50 itens; cada `product_id` deve ser inteiro, distinto e existente, e cada quantidade deve ser um inteiro entre 1 e 99. Aceito somente `pix`, `delivery_card` ou `delivery_cash`. `change_for` é opcional, numérico e limitado a `999999.99`; a regra proíbe enviá-lo para as outras formas de pagamento.

Exemplo de payload válido:

```json
{
  "items": [{ "product_id": 1, "quantity": 2 }],
  "payment_method": "delivery_cash",
  "change_for": 70.00
}
```

Eu delego o cálculo ao `OrderService`, que relê os preços e nomes do banco, verifica a disponibilidade, calcula em centavos inteiros e persiste `orders` e `order_items` dentro de `DB::transaction`. O valor enviado pelo cliente não determina o total. Se o troco informado for menor que o total ou algum produto estiver indisponível, o serviço lança `ValidationException`; nenhuma resposta de sucesso é produzida.

Exemplo representativo de resposta `201 Created` para duas unidades do X-Burger de demonstração:

```json
{
  "message": "Pedido recebido com sucesso.",
  "order": {
    "id": 123,
    "total": "57.80",
    "payment_method": "delivery_cash",
    "change_for": "70.00",
    "status": "pending",
    "created_at": "2026-11-27T12:00:00.000000Z",
    "updated_at": "2026-11-27T12:00:00.000000Z",
    "items": [{
      "id": 456,
      "order_id": 123,
      "product_id": 1,
      "product_name": "X-Burger Clássico",
      "unit_price": "28.90",
      "quantity": 2,
      "line_total": "57.80",
      "created_at": "2026-11-27T12:00:00.000000Z",
      "updated_at": "2026-11-27T12:00:00.000000Z"
    }]
  }
}
```

### Erros de validação

Eu uso `$request->validate()` no controller e `ValidationException::withMessages()` no serviço. Não capturo a exceção para convertê-la manualmente: o Laravel produz o status `422 Unprocessable Entity` e a estrutura JSON de validação. Um exemplo para quantidade zero é:

```json
{
  "message": "The items.0.quantity field must be at least 1.",
  "errors": {
    "items.0.quantity": [
      "The items.0.quantity field must be at least 1."
    ]
  }
}
```

O idioma e o texto da mensagem dependem da configuração de locale; mantenho a estrutura `message` e `errors`, com erros indexados pelo caminho do campo. Ela também é usada para produto inexistente, pagamento inválido e produto indisponível, com a chave correspondente.

## Bootstrap, respostas JSON e CORS

Em `bootstrap/app.php`, eu registro `routes/api.php` e `routes/web.php` por meio de `withRouting`; o Laravel adiciona o prefixo `api` às rotas da API. Em `withExceptions`, configurei `shouldRenderJsonWhen` para tratar como JSON qualquer exceção em `/api/*`, mesmo que a requisição não informe `Accept: application/json`; para outras rotas, a resposta JSON depende de `expectsJson()`. Assim, erros de validação — inclusive `ValidationException` lançada por `OrderService` — seguem o formato HTTP da API.

Eu não configurei uma política CORS própria neste backend: o callback de `withMiddleware` está vazio, não há `config/cors.php` e o Nginx do projeto não declara cabeçalhos CORS. Embora o Laravel inclua `HandleCors` na pilha padrão, o repositório não define origens ou caminhos permitidos para `/api`; portanto, não afirmo que exista uma allowlist configurada. Para consumir a API de outra origem no navegador, é necessário configurar e validar explicitamente essa política para os ambientes usados.

## Imagem PHP e OPcache

No `Dockerfile`, eu parto de `php:8.3-fpm`, instalo ferramentas e bibliotecas necessárias à compilação e adiciono o Composer. Compilo as extensões `pdo_mysql`, `mbstring`, `exif`, `pcntl`, `bcmath` e `gd`. Também instalo e habilito via PECL `ds` versão `1.5.0` e `redis`; esta última permite ao PHP conectar-se ao Redis usado pela fila. Defino `/var/www` como diretório de trabalho.

A configuração do OPcache fica em [`../docker/php/opcache.ini`](../docker/php/opcache.ini), fora da pasta do backend, e é montada pelo Compose no container PHP. Nela, habilito o OPcache, ativo a validação dos timestamps dos arquivos e configuro a revalidação a cada 30 segundos. Como esse arquivo é montado no ambiente, não o descrevo como uma configuração compilada diretamente pelo Dockerfile.

## Ambiente de testes com PHPUnit

Eu configurei `phpunit.xml` para carregar `vendor/autoload.php`, separar as suítes `Unit` e `Feature` e incluir `app/` como código-fonte. A configuração seleciona o ambiente `testing`, SQLite com `:memory:`, `DB_URL` vazio e drivers em memória ou síncronos para cache, sessão, e-mail, broadcast e fila. Também reduz `BCRYPT_ROUNDS` para 4 e desativa recursos de monitoramento que não são necessários nos testes.

Com isso, os testes não dependem do MySQL ou Redis do ambiente de desenvolvimento, não escrevem no banco local e podem criar o schema temporário por meio de `RefreshDatabase`. Os testes de pedidos exercitam regras do serviço e respostas HTTP; eles criam `Category` e `Product` diretamente pelos models, sem factories customizadas.

## Comandos Artisan úteis

Eu executo estes comandos a partir de `cardapio-backend/`, ou dentro do container PHP quando uso o ambiente Compose:

```bash
php artisan route:list
php artisan migrate:fresh --seed
php artisan test --filter=OrderServiceTest
php artisan queue:work
```

| Comando | O que eu uso para fazer |
| --- | --- |
| `php artisan route:list` | Inspeciono métodos, URIs, nomes, ações e middleware das rotas registradas, incluindo os endpoints da API. |
| `php artisan migrate:fresh --seed` | `migrate:fresh` exclui todas as tabelas da conexão selecionada e as recria pelas migrations; `--seed` executa o `DatabaseSeeder`. Eu uso somente em banco local ou descartável, pois a primeira parte apaga os dados existentes. |
| `php artisan test --filter=OrderServiceTest` | Inicio a suíte Laravel e passo `--filter=OrderServiceTest` ao runner para selecionar os testes correspondentes ao nome da classe. Posso trocar o filtro por outro nome de teste. |
| `php artisan queue:work` | Inicio um worker em primeiro plano para consumir tarefas da conexão definida por `QUEUE_CONNECTION`. O processo permanece ativo até ser interrompido. No Compose, o serviço acrescenta a conexão Redis e opções de tentativas e timeout. |

Os endpoints atuais de menu e pedido respondem diretamente durante a requisição; não encontrei despacho de jobs nesses fluxos. O worker está configurado para processar tarefas Redis, mas não é necessário para executar essas duas operações síncronas.
