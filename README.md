# Cardápio Virtual

Eu desenvolvi este projeto como um sistema de cardápio digital com consulta de produtos e criação de pedidos. Meu foco foi separar responsabilidades entre interface e API, manter o servidor como fonte confiável dos valores comerciais e tornar verificáveis as regras centrais por meio de testes automatizados.

## Visão geral e arquitetura

Eu dividi a solução em duas aplicações independentes que se comunicam por HTTP:

| Aplicação | Tecnologias | Responsabilidade |
| --- | --- | --- |
| `cardapio-backend/` | Laravel 13, PHP 8.3 | Expor a API, validar entradas, consultar o catálogo, calcular e persistir pedidos. |
| `cardapio-frontend/` | Angular 22, TypeScript | Apresentar o cardápio, gerenciar carrinho e checkout e consumir a API. |

Escolhi esse desacoplamento para manter regras de negócio e persistência fora da interface. O frontend envia identificadores de produtos, quantidades e dados de pagamento; o backend valida a solicitação e determina os valores com base no catálogo persistido. Essa fronteira permite evoluir a interface sem transformar o navegador em autoridade sobre preços ou estado do pedido. A API usada pela interface está configurada em `http://localhost:8000/api`.

O frontend não está incluído no `docker-compose.yml`: eu o executo separadamente com o servidor de desenvolvimento Angular. No ambiente local, a API é publicada pelo Nginx na porta `8000`, enquanto a interface fica normalmente disponível na porta `4200`.

### Infraestrutura Docker

Eu defini no `docker-compose.yml` os serviços abaixo:

| Serviço | Função no ambiente |
| --- | --- |
| `db` | MySQL 8.0 para persistir catálogo, pedidos e demais dados relacionais. O volume nomeado `db_data` conserva os dados entre reinicializações dos containers. |
| `redis` | Redis para a fila Laravel consumida pelo worker. O serviço também fica disponível para outras conexões Redis configuradas pela aplicação. |
| `backend` | Imagem PHP 8.3-FPM, compilada a partir de `cardapio-backend/Dockerfile`. O container executa o Laravel e expõe FastCGI na porta interna `9000`, sem publicar essa porta diretamente no host. |
| `web` | Nginx recebe HTTP na porta `8000` do host, serve o front controller Laravel e encaminha a execução PHP para `backend:9000`. |
| `queue-worker` | Executa `php artisan queue:work redis --tries=3 --timeout=90` para consumir tarefas da fila Redis. `--tries=3` limita cada tarefa a três tentativas; `--timeout=90` define o tempo máximo de execução em segundos. |

Eu configurei healthchecks para o MySQL, Redis e PHP-FPM. O MySQL é verificado com `mysqladmin ping` a cada cinco segundos, com timeout de três segundos, até vinte tentativas e período inicial de trinta segundos. O Redis responde a `redis-cli ping`, com verificações a cada cinco segundos e até dez tentativas. O PHP-FPM é verificado tentando abrir uma conexão local na porta `9000`, a cada cinco segundos, com timeout de três segundos, até dez tentativas e período inicial de sessenta segundos.

O Compose usa `depends_on` com `condition: service_healthy` para que o PHP aguarde banco e Redis, o Nginx aguarde o backend e o worker aguarde backend e Redis. Isso coordena a inicialização; não substitui tratamento de indisponibilidade durante a operação.

O código do backend é montado nos containers para desenvolvimento. O Nginx recebe esse volume somente para leitura; o PHP-FPM e o worker usam o código do projeto. As portas `3306` e `6379` também são publicadas no host para desenvolvimento local.

> **Segurança:** as credenciais declaradas diretamente no Compose são valores de desenvolvimento. Eu não considero essa configuração apropriada para produção. Em implantações reais, configure segredos fora do repositório, restrinja portas e acessos, desligue o modo debug e use credenciais fortes.

## Decisões de engenharia, segurança e regras de negócio

### Criação de pedidos: validação e confiança nos dados

Eu concentrei a validação HTTP em `OrderController::store`. A rota `POST /api/orders` exige entre 1 e 50 itens; cada `product_id` deve ser inteiro, distinto e existente; cada quantidade deve ser um inteiro entre 1 e 99. A forma de pagamento deve ser `pix`, `delivery_card` ou `delivery_cash`. `change_for` é numérico, limitado e permitido somente para pagamento em dinheiro na entrega. Falhas de validação da API são devolvidas como JSON com status `422`.

O controller injeta `OrderService`, encaminha somente os dados validados e responde `201 Created` quando a criação termina. Separar essa camada da persistência deixa o controller responsável pelo protocolo HTTP e o serviço responsável pelo fluxo de negócio.

Em `OrderService::create`, eu busco os produtos pelo identificador no próprio banco e monto o pedido a partir dessa consulta. Não uso `price`, `unit_price`, `line_total` ou nome recebidos do navegador para precificar. Esses campos podem ser adulterados, estar desatualizados ou representar um preço que nunca foi autorizado pelo catálogo. O cliente envia identificadores e quantidades; o servidor verifica se cada produto ainda existe e está ativo, e usa seu nome e preço atuais.

Para reduzir consultas repetidas, o serviço busca os produtos da solicitação em conjunto, indexa o resultado pelo ID e percorre os itens para calcular os valores. Faço os cálculos em centavos inteiros (`price * 100`, arredondado) para evitar acúmulo de imprecisão de ponto flutuante em valores monetários. O total do pedido é a soma dos totais de linha, e não um total calculado pelo frontend.

Se um produto não existir na consulta ou estiver inativo, o serviço lança `ValidationException`. A rota também verifica a existência do ID antes de chamar o serviço; a verificação do serviço protege a regra de negócio no próprio ponto de criação, inclusive em chamadas que não passam pelo controller. Para dinheiro na entrega, se o cliente informar troco, o valor deve ser igual ou superior ao total.

### Atomicidade e snapshot histórico

Eu envolvi a leitura dos produtos e a gravação do pedido em `DB::transaction`. Assim, uma exceção durante a operação interrompe a transação e evita deixar pedido ou itens parcialmente persistidos. A consulta utiliza `lockForUpdate` para bloquear as linhas dos produtos enquanto a transação está em andamento nos bancos que implementam esse bloqueio, como o MySQL usado no Compose. Isso reduz a janela para alteração concorrente do produto entre a leitura do preço e a gravação.

Depois de calcular todos os itens, eu crio o registro de `orders` com o total calculado, a forma de pagamento, o troco e o estado inicial `pending`; em seguida, gravo cada `order_item`. O snapshot em cada item inclui `product_name`, `unit_price`, `quantity` e `line_total`. Escolhi persistir nome e preço unitário no momento da compra para preservar a referência histórica mesmo que o cadastro do produto mude posteriormente. A chave `product_id` pode ficar nula quando o produto é removido, sem apagar os dados comerciais fotografados no item.

O fluxo registra a forma de pagamento, mas não captura pagamentos nem integra um gateway. Pix e pagamentos na entrega são informações do pedido, não uma transação financeira processada pelo sistema.

### Consulta do cardápio e histórico de busca

Em `MenuController::search`, eu valido `q` como string opcional de até 100 caracteres e removo espaços das extremidades. A consulta retorna somente produtos ativos, carrega a categoria junto com os produtos e, quando há termo, procura correspondências no nome, descrição ou nome da categoria. Os resultados são ordenados pelo nome. A resposta JSON inclui o termo normalizado, resultados e buscas recentes.

Eu injetei `SearchHistoryService` para isolar a manutenção do histórico da consulta ao catálogo. O serviço ignora termos vazios, elimina a ocorrência anterior de um termo, coloca a nova ocorrência no início e limita a lista a dez itens. Esse histórico vive apenas em memória: não é gravado no banco e não é compartilhado entre processos ou usuários. Portanto, não o trato como histórico persistente nem como armazenamento de dados pessoais.

## Estratégia de testes automatizados

Eu uso PHPUnit por meio do runner do Laravel. `RefreshDatabase` prepara o schema para cada teste e isola os dados, evitando que os registros de um caso contaminem os seguintes. O `phpunit.xml` define SQLite em memória para a suíte; assim, os testes não dependem do MySQL do Compose.

### `tests/Unit/OrderServiceTest.php`

Criei três testes que exercitam o `OrderService` diretamente:

| Caso de teste | O que eu verifico |
| --- | --- |
| Recalcular preços do banco | Envio nome e preços adulterados junto do item e confirmo que nome, preço unitário, total da linha e total do pedido vêm do produto persistido. |
| Preservar o snapshot do item | Crio o pedido, altero depois o nome e o preço do produto e confirmo que o item mantém os valores originais, inclusive no banco. |
| Rejeitar produto indisponível | Incluo um produto ativo e um inativo, espero `ValidationException` e verifico que não há pedido nem itens persistidos após a falha. |

O último caso verifica a exceção dentro da operação transacional e o estado final sem registros. Como a implementação valida todos os produtos antes de inserir o pedido, esse caso não simula uma falha de banco ocorrida depois de uma gravação parcial.

### `tests/Feature/OrderControllerTest.php`

Criei cinco testes de feature que enviam requisições HTTP com `postJson('/api/orders', ...)`:

| Caso de teste | Resposta e asserções |
| --- | --- |
| Carrinho vazio | `422 Unprocessable Entity` e erro de validação no campo `items`. |
| Payload incompleto | `422` e erro em `items.0.quantity`. |
| Produto inexistente | `422` e erro em `items.0.product_id`. |
| Forma de pagamento inválida | `422` e erro em `payment_method`. |
| Criar pedido válido | `201 Created`, campos calculados no JSON e `assertDatabaseHas` nas tabelas `orders` e `order_items`. |

Eu crio `Category` e `Product` diretamente pelos models nos testes, com os campos definidos nas migrations; não dependo de factories customizadas. O teste de sucesso confirma no banco o total, a forma de pagamento, o estado inicial, o produto e os valores históricos do item.

## Guia de execução e comandos de terminal

### Preparar e iniciar backend e banco

Eu executo os comandos abaixo na raiz do repositório, onde está o `docker-compose.yml`.

**1. Criar a configuração local**

```powershell
Copy-Item .\cardapio-backend\.env.example .\cardapio-backend\.env
```

`Copy-Item` copia o exemplo para `.env`, a configuração local carregada pelo Laravel, que não deve ser versionada. Antes de iniciar os serviços, eu ajusto o arquivo para o ambiente Docker:

| Variável | Valor local | Motivo |
| --- | --- | --- |
| `APP_ENV` / `APP_DEBUG` | `local` / `true` | Habilita configuração e detalhes de desenvolvimento; não uso `APP_DEBUG=true` em produção. |
| `APP_URL` | `http://localhost:8000` | Define a URL local publicada pelo Nginx. |
| `DB_CONNECTION` / `DB_HOST` | `mysql` / `db` | Seleciona MySQL e o nome do serviço resolvido na rede interna do Compose. |
| `DB_PORT` / `DB_DATABASE` | `3306` / `cardapio` | Aponta para a porta e o banco configurados no serviço MySQL. |
| `DB_USERNAME` / `DB_PASSWORD` | `root` / `root` | Correspondem à configuração atual do Compose, somente para desenvolvimento local. |
| `QUEUE_CONNECTION` / `REDIS_HOST` | `redis` / `redis` | Direciona as filas para Redis e usa o nome do serviço como host interno. |
| `REDIS_PORT` | `6379` | Corresponde à porta interna padrão do Redis neste Compose. |

Eu gero `APP_KEY` com Artisan no passo 4, depois de iniciar o container PHP.

**2. Construir e iniciar os serviços principais**

```powershell
docker compose up -d --build db redis backend web
```

`docker compose` seleciona o Compose; `up` cria e inicia os serviços informados e suas dependências. `db`, `redis`, `backend` e `web` são os nomes definidos no YAML. `--build` constrói a imagem local do backend antes de iniciá-lo; `-d` mantém os containers em segundo plano. Eu deixo o worker para depois da instalação das dependências PHP, pois ele inicia um comando Artisan.

**3. Instalar as dependências PHP**

```powershell
docker compose exec backend composer install
```

`exec` executa um processo em um container já iniciado; `backend` identifica o container de aplicação. `composer install` instala as dependências nas versões travadas em `composer.lock`, disponibilizando `vendor/` pelo volume compartilhado com o host.

**4. Gerar a chave da aplicação**

```powershell
docker compose exec backend php artisan key:generate
```

`php artisan` executa o console do Laravel no container `backend`; `key:generate` cria e grava `APP_KEY` no `.env` montado. O framework usa essa chave em recursos como criptografia da aplicação.

**5. Criar as tabelas e inserir dados de demonstração**

```powershell
docker compose exec backend php artisan migrate --seed
```

`migrate` aplica as migrations pendentes no banco configurado, MySQL neste ambiente. `--seed` também executa o `DatabaseSeeder`, que chama o `MenuSeeder` e inclui dados de catálogo e o usuário de exemplo definido pelo seeder.

**6. Iniciar o consumidor da fila**

```powershell
docker compose up -d queue-worker
```

`queue-worker` é o nome do serviço que executa `queue:work redis`; `up` o inicia e verifica suas dependências. `-d` o mantém em segundo plano. O worker consome tarefas da fila Redis, com três tentativas e timeout de 90 segundos conforme os argumentos definidos no Compose.

### Executar os testes do backend

```powershell
docker compose exec backend php artisan test
```

Eu uso `php artisan test` como ponto de entrada para a suíte de testes do Laravel; por baixo, o runner executa PHPUnit. O `phpunit.xml` define `DB_CONNECTION=sqlite` e `DB_DATABASE=:memory:`, então os testes rodam em banco temporário em memória, não nas tabelas MySQL locais. `RefreshDatabase` prepara o schema e isola os casos.

Também posso chamar PHPUnit diretamente:

```powershell
docker compose exec backend ./vendor/bin/phpunit
```

Esse comando executa o binário PHPUnit instalado por Composer no container. Sem opções adicionais, ele lê `phpunit.xml` e executa as suítes `Unit` e `Feature`.

### Executar o frontend Angular

Em outro terminal, na raiz do projeto:

```powershell
Set-Location .\cardapio-frontend
npm install
npm start
```

`Set-Location` muda o diretório para o frontend. `npm install` instala as dependências declaradas em `package.json` e travadas em `package-lock.json`. `npm start` executa o script `start`, configurado como `ng serve`, e inicia o servidor de desenvolvimento Angular; não gera um build de produção. A interface fica normalmente em `http://localhost:4200` e chama a API em `http://localhost:8000/api`.

### Encerrar os containers

```powershell
docker compose down
```

`down` para e remove os containers e a rede do projeto. Eu não incluo `-v` (remoção de volumes), portanto o volume nomeado `db_data` permanece e conserva os dados do banco para a próxima inicialização.
