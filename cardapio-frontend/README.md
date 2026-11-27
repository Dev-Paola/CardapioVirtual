# Frontend — Cardápio Virtual

Eu desenvolvi a interface com Angular 22 e TypeScript para permitir que a pessoa usuária consulte o cardápio, gerencie um carrinho e envie um pedido à API. Neste documento, foco na organização e nas decisões do frontend; a arquitetura geral e a infraestrutura ficam descritas no README da raiz.

## Arquitetura Angular e organização do código

Eu inicializo a aplicação com `bootstrapApplication` em `src/main.ts`, sem um `NgModule` raiz. Em `app.config.ts`, registro o roteador com `provideRouter` e o cliente HTTP com `provideHttpClient`. Essa composição mantém a inicialização explícita e compatível com a arquitetura standalone do Angular.

Eu uso componentes standalone para o shell da aplicação, o cardápio, os cartões de produto, a busca, o carrinho e o checkout. Cada componente declara as dependências que usa, como `RouterLink`, `CurrencyPipe` e `FormsModule`, em seu próprio `imports`. O componente raiz hospeda o `RouterOutlet`; os demais concentram apresentação e interação de cada tela.

| Responsabilidade | Arquivos principais | Como organizei |
| --- | --- | --- |
| Inicialização e navegação | `src/main.ts`, `src/app/app.config.ts`, `src/app/app.routes.ts`, `src/app/app.ts` | Inicializo a aplicação, registro providers e defino as rotas do cardápio, carrinho e checkout. |
| Componentes de interface | `src/app/menu.ts`, `src/app/menu-item-card.ts`, `src/app/menu-search.ts`, `src/app/cart.ts`, `src/app/checkout.ts` e templates `.html` correspondentes | Separei telas e componentes reutilizáveis. A busca e o cartão comunicam eventos ao componente do cardápio por `@Input` e `@Output`. |
| Serviços | `src/app/cart.service.ts`, `src/app/menu-api.service.ts` | Centralizo o estado do carrinho e o acesso HTTP à API. Os serviços são disponibilizados pela injeção de dependência do Angular. |
| Tipos de domínio e contratos HTTP | `src/app/menu-item.ts` e interfaces em `src/app/menu-api.service.ts` | Tipifico produtos exibidos, itens do carrinho, requisições e respostas da API. |

Eu mantenho os arquivos diretamente em `src/app/`, organizados por responsabilidade e nome. No estado atual, não criei subpastas chamadas `services/` ou `models/`; os serviços e tipos ficam lado a lado com os componentes.

### Standalone, injeção de dependência e reatividade

Eu adotei componentes standalone (`standalone: true`) e declaro suas dependências localmente, em vez de registrá-las em módulos Angular. Nos serviços e componentes, uso injeção pelo construtor, como `MenuApiService` recebendo `HttpClient` e `Checkout` recebendo `CartService`. Não uso a função `inject()` no código da aplicação.

Eu também não uso Signals no estado atual. Para a busca, uso `Subject<string>` e Observables do RxJS: `switchMap` troca a consulta em andamento pela mais recente, `catchError` converte falhas em um resultado local de fallback e `map` associa a resposta ao termo pesquisado. A API HTTP retorna Observables; no checkout, uso `finalize` para encerrar o estado de envio tanto em sucesso quanto em erro.

### Tipagem TypeScript e contratos da API

Eu uso `MenuItem` para os dados normalizados que a interface exibe. Em `menu-api.service.ts`, tipifico `MenuSearchResponse`, `CreateOrderRequest` e `CreateOrderResponse`, além do formato recebido para cada produto. A forma de pagamento é uma união literal (`pix`, `delivery_card` ou `delivery_cash`), o pedido contém identificadores e quantidades, e os preços da API aceitam `string | number`, pois valores decimais podem ser serializados como texto.

Essa tipagem ajuda o compilador a detectar incompatibilidades ao montar o payload, ler a resposta e converter produtos para o formato da interface. Ela não valida o JSON em tempo de execução; eu mantenho o backend como autoridade para validar e recalcular dados comerciais.

Em `tsconfig.json`, eu habilitei verificações como `noImplicitReturns`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature` e `noFallthroughCasesInSwitch`. Também configurei `strictInjectionParameters` e `strictInputAccessModifiers` para o compilador Angular. A configuração atual não declara o sinalizador global `strict: true` nem `strictTemplates`; por isso, descrevo as verificações que realmente estão habilitadas, sem afirmar que o projeto opera com todas as verificações estritas do TypeScript e dos templates.

## Estado do carrinho, checkout e resiliência

### Carrinho e confirmação do pedido

Eu mantenho o carrinho em `CartService`, um serviço singleton disponibilizado com `providedIn: 'root'`. O estado é mantido em memória durante a navegação: adicionar um produto incrementa a quantidade se ele já estiver presente; `decrease` reduz a quantidade ou remove o item ao chegar a zero; `remove` exclui um produto e `clear` esvazia a lista. O getter `total` soma preço local multiplicado pela quantidade.

Esse total e os preços apresentados no carrinho são apenas uma prévia visual para a pessoa usuária. No checkout, eu envio somente `product_id`, `quantity`, forma de pagamento e, para dinheiro na entrega, o valor de troco. Não envio preço calculado pelo navegador como fonte de verdade; a API refaz os cálculos com os dados do catálogo.

Em `Checkout.confirmOrder`, eu impeço envios simultâneos e não envio um carrinho vazio. Enquanto aguardo a resposta, ativo `isSubmitting` e desabilito o botão. O contrato do backend confirma a criação com HTTP `201`; quando o `HttpClient` emite uma resposta de sucesso, eu guardo os dados de confirmação, limpo o carrinho e exibo o número e o total do pedido. O código reage ao sucesso da requisição; não faz uma comparação explícita do campo `status` com `201`.

Eu só limpo o estado local depois dessa confirmação porque uma falha de validação, rede ou servidor não deve descartar os itens que a pessoa ainda pode tentar enviar novamente. Em erros HTTP, apresento a mensagem recebida ou uma mensagem adequada ao status, e mantenho o carrinho. A requisição tem timeout de 30 segundos; se ele ocorrer, informo que a confirmação pode ser incerta e recomendo verificar se o pedido foi registrado antes de tentar novamente.

### Busca e fallback local

Eu inicio a busca do cardápio com uma chamada à API e exibo estados de carregamento e de indisponibilidade. `MenuApiService.search` chama `GET /api/menu/search`; quando há resposta, `Menu` converte os produtos para `MenuItem` e atualiza os resultados e buscas recentes.

Se a chamada falhar, meu `catchError` mantém o fluxo ativo e encaminha a busca para `applyLocalSearch`. Esse método filtra os itens em memória por nome, categoria ou descrição. Inicialmente, `Menu` contém quatro produtos de demonstração; se uma resposta da API já tiver sido carregada, o fallback usa a lista que está atualmente em memória. A propriedade `apiUnavailable` aciona um aviso no template, para que eu deixe claro que os resultados são locais e a aplicação continue utilizável.

Eu uso `switchMap` para que uma busca nova substitua a anterior e impeça que respostas antigas sobrescrevam os resultados mais recentes. O histórico local de buscas remove duplicados sem diferenciar maiúsculas de minúsculas e conserva até cinco termos. Quando a API responde, combino esse histórico com os termos retornados pelo backend.

## Configuração do workspace e comandos

### Arquivos de configuração

| Arquivo | Papel na aplicação |
| --- | --- |
| `angular.json` | Eu configuro os builders de build, servidor e testes, a entrada `src/main.ts`, os estilos globais e os assets de `public/`. `ng build` usa produção por padrão, aplica hash aos arquivos e avisa quando o bundle inicial ultrapassa 500 kB (erro acima de 1 MB) ou os estilos de um componente ultrapassam 4 kB (erro acima de 8 kB). A configuração de desenvolvimento desativa otimizações, preserva source maps e é usada por `ng serve`; o builder de testes integra a suíte unitária. |
| `tsconfig.json` | Eu centralizo as opções do TypeScript e do compilador Angular, incluindo alvo ES2022, verificações de tipos e referências às configurações específicas da aplicação e dos testes. |
| `tsconfig.app.json` / `tsconfig.spec.json` | Eu separo os arquivos compilados para a aplicação dos testes. A configuração dos testes inclui os tipos globais do Vitest. |
| `package.json` | Eu declaro dependências, versões e scripts npm. `start`, `build` e `test` são atalhos para `ng serve`, `ng build` e `ng test`; também mantenho scripts para build contínuo e execução local do CLI. |
| `package-lock.json` | Eu registro a árvore resolvida de dependências para tornar instalações reproduzíveis com npm. |

### Instalar dependências

Eu executo os comandos dentro de `cardapio-frontend/`:

```powershell
npm install
```

`npm install` lê `package.json` e `package-lock.json`, resolve e instala Angular, TypeScript, RxJS e ferramentas de desenvolvimento em `node_modules/`. O lockfile reduz variações entre instalações.

### Servir a aplicação durante o desenvolvimento

```powershell
npm start
```

Eu uso `npm start` para executar o script `start` definido em `package.json`, que chama `ng serve`. O Angular CLI usa o builder de servidor declarado em `angular.json`, compila a configuração de desenvolvimento e disponibiliza a aplicação normalmente em `http://localhost:4200`, com atualização automática durante a edição.

Também posso executar o CLI diretamente:

```powershell
ng serve
```

`ng serve` inicia o servidor local do Angular. Sem argumentos adicionais, usa a configuração de desenvolvimento padrão da aplicação; ele serve a interface para desenvolvimento e não substitui um build de produção.

### Gerar o build

```powershell
npm run build
```

Eu executo o script `build` do `package.json`, configurado para chamar `ng build`. O builder compila e empacota a aplicação para publicação, usando por padrão a configuração `production` indicada em `angular.json`. A saída é gerada em `dist/`; o Angular aplica otimizações e hash e verifica os limites configurados para o tamanho do bundle inicial e dos estilos dos componentes.

Também posso chamar diretamente o comando do CLI:

```powershell
ng build
```

`ng build` produz o mesmo build de produção padrão sem passar pelo atalho npm. Para desenvolvimento, `angular.json` também define uma configuração separada com source maps e sem otimização.

### Executar os testes do frontend

```powershell
npm test
```

Eu uso o script `test` do `package.json`, que executa `ng test`. O builder de testes do Angular e a configuração do workspace executam os testes unitários com Vitest; `tsconfig.spec.json` disponibiliza seus tipos globais. Os testes atuais cobrem a inicialização e rota do cardápio, além do checkout em sucesso, rejeição HTTP e falha de conexão. No checkout, uso `HttpTestingController` para simular respostas sem depender da API em execução.

Também posso iniciar o mesmo runner diretamente:

```powershell
ng test
```

`ng test` é o comando do Angular CLI chamado pelo script npm. Ele compila e executa os testes definidos no projeto; não inicia a interface para uso manual.
