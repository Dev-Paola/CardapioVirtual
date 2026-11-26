# Documentacao do projeto `CardapioVirtual`

O repositorio contem duas aplicacoes independentes: uma API Laravel e uma interface Angular.

## Visao geral

| Caminho | Funcao |
| --- | --- |
| `cardapio-backend/` | API e estrutura de dados em Laravel/PHP. |
| `cardapio-frontend/` | Interface do cardapio em Angular/TypeScript. |
| `docker-compose.yml` | Define MySQL, Redis, Laravel em PHP-FPM, Nginx para HTTP e worker de fila. Nao define um container para o frontend. |
| `docker/` | Configuracoes do Nginx e do OPcache usados pelos containers. |
| `index.php` | Pagina inicial do Laragon na raiz `www`; nao e a entrada da aplicacao Laravel. |
| `DOCUMENTACAO_PROJETO.md` | Este mapa dos arquivos e do estado atual do projeto. |

## Como as partes se relacionam hoje

- O Angular consulta `GET /api/menu/search?q=termo` e usa os produtos ativos do Laravel. Se a API estiver indisponivel, apresenta o cardapio local de demonstracao.
- O endpoint `POST /api/orders` valida os itens e a forma de pagamento, recalcula os precos com os dados do banco e persiste o pedido e seus itens.
- O checkout limpa o carrinho somente depois que a API confirma a criacao do pedido. A confirmacao de pedido nao processa uma transacao financeira: Pix e pagamentos na entrega sao apenas registrados.
- A busca consulta nome, descricao e categoria, mantendo o historico recente do `SearchHistoryService`.
- O Docker Compose aguarda MySQL, Redis e PHP-FPM ficarem saudaveis antes de iniciar os servicos dependentes. O Nginx publica a API em `http://localhost:8000` e encaminha `/index.php` para `backend:9000`; CORS e preflight sao respondidos pelo middleware do Laravel.

## Arquivos na raiz de `www`

- `README.md`: atualmente contem apenas o titulo do repositorio.
- `docker-compose.yml`: declara os servicos `db` (MySQL), `redis`, `backend` (PHP-FPM), `web` (Nginx) e `queue-worker`, com verificacoes de prontidao para banco, Redis e PHP-FPM. As credenciais declaradas sao para desenvolvimento local; nao devem ser tratadas como configuracao de producao.
- `index.php`: pagina de boas-vindas do Laragon, com deteccao de acesso local e exibicao de informacoes do PHP. Nao encaminha requisicoes para o Laravel ou Angular.
- `package.json` e `package-lock.json`: manifest e lockfile npm da raiz. Esse pacote nao e o frontend Angular; para comandos da interface, use `cardapio-frontend/`.
- `.idea/`: configuracoes do IDE JetBrains.
- `node_modules/`: dependencias npm instaladas localmente; conteudo gerado, nao e codigo-fonte.


## Backend: `cardapio-backend/`

### Entrada, dependencias e configuracao

- `artisan`: comando de terminal do Laravel.
- `composer.json` / `composer.lock`: dependencias PHP e suas versoes travadas.
- `package.json`: comandos e dependencias JS do Vite usado pelos recursos Laravel; e separado do `package.json` do Angular.
- `vite.config.js`: configuracao do Vite para `resources/css/app.css` e `resources/js/app.js`.
- `Dockerfile`: imagem PHP 8.3, extensoes PHP/MySQL, `ds` e Redis usadas pelos containers.
- `phpunit.xml`: configuracao do PHPUnit e ambiente SQLite em memoria para testes.
- `.env.example`: exemplo de variaveis locais; o `.env` real e ignorado pelo Git e nao deve ser compartilhado, pois pode conter segredos.
- `.gitignore`, `.gitattributes`, `.editorconfig` e `.npmrc`: regras de versionamento, atributos Git, formatacao e configuracao npm.
- `AGENTS.md` e `CLAUDE.md`: orientacoes para ferramentas de desenvolvimento, nao sao carregadas pela aplicacao em tempo de execucao.
- `README.md`: documentacao padrao do Laravel, ainda nao personalizada para o cardapio.

### Codigo da aplicacao (`app/`)

- `app/Http/Controllers/Controller.php`: controller base do Laravel.
- `app/Http/Controllers/Api/MenuController.php`: consulta produtos ativos por nome, descricao ou categoria, registra o termo no servico de historico e retorna os produtos como JSON.
- `app/Http/Controllers/Api/OrderController.php`: valida pedidos e devolve a confirmacao JSON.
- `app/Models/Category.php`: model Eloquent de categorias; declara relacao de varios produtos.
- `app/Models/Product.php`: model Eloquent de produtos; pertence a uma categoria.
- `app/Models/Order.php` e `app/Models/OrderItem.php`: persistem pedidos e os valores/nomes dos produtos no momento da compra.
- `app/Services/OrderService.php`: confere disponibilidade, calcula os valores no servidor e grava o pedido em transacao.
- `app/Models/User.php`: model de usuario usado pelo Laravel para autenticacao.
- `app/Providers/AppServiceProvider.php`: ponto de registro e inicializacao de servicos Laravel; atualmente sem logica adicional.
- `app/Services/SearchHistoryService.php`: mantem ate dez termos em memoria, removendo duplicados. O historico nao e salvo em banco e nao exige extensoes PHP adicionais.

### Inicializacao e rotas

- `bootstrap/app.php`: configura o bootstrap da aplicacao, registra arquivos de rotas e define respostas JSON para requisicoes de API.
- `bootstrap/providers.php`: lista os service providers da aplicacao.
- `routes/api.php`: declara `GET /api/menu/search` e `POST /api/orders`.
- `routes/web.php`: rota web `/` que mostra a view `welcome`.
- `routes/console.php`: comandos Artisan adicionais; atualmente registra o comando de exemplo `inspire`.
- `public/index.php`: entrada HTTP do Laravel. Diferente do `index.php` da raiz `www`, este inicia a aplicacao Laravel.
- `public/.htaccess`: regras do Apache para encaminhar URLs ao front controller.
- `public/favicon.ico` e `public/robots.txt`: icone e instrucoes para robos de busca.

### Dados

- `config/database.php`: conexoes de banco; a conexao padrao e escolhida por `DB_CONNECTION` e, sem configuracao, usa SQLite.
- `database/migrations/0001_01_01_000000_create_users_table.php`: tabelas de usuarios, redefinicao de senha e sessoes.
- `database/migrations/0001_01_01_000001_create_cache_table.php`: tabelas de cache e locks.
- `database/migrations/0001_01_01_000002_create_jobs_table.php`: tabelas de filas, lotes e tarefas com falha.
- `database/migrations/2026_11_05_002758_create_categories_table.php`: tabela de categorias.
- `database/migrations/2026_11_05_003137_create_products_table.php`: tabela de produtos, com categoria, preco, imagem e disponibilidade.
- `database/migrations/2026_11_24_000001_create_orders_table.php` e `2026_11_24_000002_create_order_items_table.php`: tabelas de pedidos e itens.
- `database/factories/UserFactory.php`: dados de teste para criar usuarios.
- `database/seeders/DatabaseSeeder.php` e `MenuSeeder.php`: dados iniciais para testar o cardapio e a API.
- `database/database.sqlite`: banco SQLite local presente no workspace; e dado local, nao codigo-fonte.
- `database/.gitignore`: evita versionar dados locais do banco.

### Configuracao, recursos, armazenamento e testes

- `config/app.php`, `auth.php`, `cache.php`, `database.php`, `filesystems.php`, `logging.php`, `mail.php`, `queue.php`, `services.php` e `session.php`: configuracoes gerais do Laravel, carregadas a partir de variaveis de ambiente quando aplicavel.
- `resources/css/app.css` e `resources/js/app.js`: recursos do frontend Vite do Laravel; nao sao os arquivos da interface Angular.
- `resources/views/welcome.blade.php`: view inicial padrao do Laravel.
- `tests/Feature/ExampleTest.php` e `tests/Unit/ExampleTest.php`: testes de exemplo do esqueleto Laravel.
- `tests/TestCase.php`: classe base dos testes Laravel.
- `storage/`: arquivos de runtime, como logs, sessoes, cache e arquivos enviados; nao e a fonte principal do codigo.
- `vendor/`: dependencias PHP instaladas pelo Composer; conteudo gerado.

## Frontend: `cardapio-frontend/`

### Configuracao e comandos

- `package.json` / `package-lock.json`: scripts, dependencias Angular e versoes travadas. Os comandos abaixo devem ser executados nesta pasta.
- `angular.json`: configuracao de build, servidor de desenvolvimento, assets, estilos e testes Angular.
- `tsconfig.json`, `tsconfig.app.json` e `tsconfig.spec.json`: configuracoes TypeScript para o projeto, aplicacao e testes.
- `.gitignore`: exclui `node_modules/`, `dist/`, cache Angular e outros artefatos gerados.
- `.editorconfig` e `.prettierrc`: convencoes de edicao e formatacao.
- `.postcssrc.json`: plugins PostCSS, incluindo Tailwind.
- `.vscode/`: configuracoes e recomendacoes do VS Code.
- `README.md`: instrucoes padrao geradas pelo Angular CLI.
- `public/favicon.ico`: icone copiado para o build.
- `dist/`, `node_modules/` e `.angular/`: saida de build, dependencias e cache; sao gerados, nao editados manualmente.

### Inicializacao e roteamento (`src/`)

- `src/index.html`: documento HTML base carregado pelo navegador.
- `src/main.ts`: inicia a aplicacao Angular com o componente raiz.
- `src/styles.css`: importa Tailwind CSS e aplica os estilos CSS globais; os templates usam as cores utilitarias padrao do Tailwind.
- `src/app/app.ts`: componente raiz que hospeda o `router-outlet`.
- `src/app/app.config.ts`: configura router e `HttpClient`.
- `src/app/app.routes.ts`: liga `/` ao cardapio, `/carrinho` ao carrinho e `/compra` ao checkout.
- `src/app/app.spec.ts`: testes de criacao da aplicacao e exibicao da rota do cardapio.

### Cardapio e busca (`src/app/`)

- `menu.ts`: componente principal; consome a busca do backend e usa pratos de exemplo como fallback.
- `menu.html`: template da tela do cardapio, composto pelos componentes reutilizaveis e classes utilitarias Tailwind responsivas.
- `menu-item.ts`: interface TypeScript que define os campos de um item (id, nome, categoria, preco e descricao).
- `menu-item-card.ts` e `menu-item-card.html`: componente reutilizavel de cartao de produto, estilizado com classes utilitarias Tailwind.
- `menu-search.ts` e `menu-search.html`: componente reutilizavel de busca e exibicao de termos recentes, estilizado com classes utilitarias Tailwind.
- `menu-api.service.ts`: cliente HTTP Angular para a busca e criacao de pedidos na API Laravel.

### Carrinho e checkout (`src/app/`)

- `cart.service.ts`: estado do carrinho em memoria, quantidades, remocao e calculo do total.
- `cart.ts` e `cart.html`: tela responsiva do carrinho, estilizada com utilitarios Tailwind.
- `checkout.ts` e `checkout.html`: selecao de Pix, dinheiro ou cartao na entrega, envio do pedido, estado de envio/erro e confirmacao. O troco e opcional e enviado apenas para dinheiro; o template usa utilitarios Tailwind.

## Comandos uteis

Frontend, a partir da raiz do repositorio:

```powershell
Set-Location C:\laragon\www\cardapio-frontend
npm install
npm start
```

O servidor Angular fica normalmente em `http://localhost:4200`. Para compilar, use `npm run build`; para executar os testes, `npm test`.

Backend, a partir da raiz do repositorio:

```powershell
Set-Location C:\laragon\www\cardapio-backend
composer install
php artisan key:generate
php artisan migrate
php artisan db:seed
php artisan serve
```
