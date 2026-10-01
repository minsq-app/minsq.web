# username

verificado por backend

nao aceita caracteres especiais apenas letras, numeros e underline "_" e ponto "."

tamanho: min 3 e max 30 caracteres

# voce conheceu nós por onde

aqui o backend só salva as opcoes listadas pelo site nao aceita outras requisicoes

# supabase

O onboarding usa apenas uma única tabela: a tabela users.

Assim como no caso do confirm-account, o onboarding não cria linhas novas em outras tabelas. Ele apenas atualiza os dados daquele usuário específico que acabou de validar o e-mail.

Aqui estão as colunas exatas da tabela users que o onboarding atualiza e para que servem:

handle: É aqui que fica o username oficial com a "@" na frente (ex: @roberto). É essa coluna que o backend vasculha para garantir que não existam dois arrobas iguais.
nome: Guarda o nome cru, sem o arroba, apenas por conveniência visual para a tela (ex: roberto). Posteriormente o usuário poderá mudar o nome de exibição no perfil dele, sem afetar o handle.
conheceu_por: Salva a string exata de origem (ex: YouTube, TikTok, Outros), validada por nossa lista de opções, ajudando nas métricas de onde seu público está vindo.

# Proteções e Segurança

1. **Autenticação Obrigatória (Sessão):**
Nenhuma das rotas de Onboarding (nem a de checar nome, nem a de salvar) pode ser acessada de forma anônima. O backend exige um Token JWT válido da sessão. Se um atacante tentar burlar sem estar logado, recebe Erro 401 (Unauthorized).

2. **Prevenção contra Falsidade Ideológica (Maiúsculas/Minúsculas):**
Para evitar que alguém registre `Roberto` e outra pessoa registre `roberto` (Homoglyph attacks), o frontend e o backend aplicam `.toLowerCase()` instantaneamente. O banco de dados só vê e salva letras minúsculas, garantindo unicidade absoluta.

3. **Validação Estrutural (Regex):**
Bloqueio pesado de caracteres especiais maliciosos ou espaços. O backend passa um pente fino (Regex `/^[a-z0-9_.]+$/`) que chuta qualquer coisa que não seja letras de "a-z", números de "0-9", sublinhado ou ponto final.

4. **Bloqueio de Palavras Reservadas e Filtro NSFW (Blacklist):**
Foi implementada uma lista negra (`blacklist`) dividida em dois eixos:
- Nomes do Sistema (Falsidade ideológica): `admin`, `suporte`, `minsq`, `root`, `system`, etc.
- Palavras +18 (Profanity Filter): `xvideos`, `pornhub`, `onlyfans`, `fatalmodel`, `redtube`, `brazzers`, `privacy`.
Se um usuário tentar usar qualquer um desses, o sistema bloqueia imediatamente informando que o nome é reservado.

5. **Rate Limiting Anti-Spam (check-handle):**
A rota que checa a disponibilidade do nome enquanto a pessoa digita (`/check-handle`) possui um rate limit específico no backend configurado para um máximo de 60 requisições por minuto por IP. Isso impede que robôs consigam bombardear a rota para descobrir nomes disponíveis através de força-bruta (dicionário de nomes).

6. **Sanitização de Dados (Whitelist de Origem):**
A resposta de "Por onde nos conheceu" não é um texto livre. O backend possui um Array com a lista exata das opções oferecidas (`YouTube`, `Instagram`, `TikTok`, etc). Se um hacker tentar injetar códigos maliciosos ou textos aleatórios via API nesse campo, a requisição é negada com Erro 400.

7. **Prevenção de Colisão de Nomes:**
Antes de salvar, o sistema cruza os dados com o Supabase. Se dois usuários enviarem o mesmo `@nome` na mesma fração de segundo, o banco de dados e o controlador impedem a sobreposição, garantindo que o nome vá apenas para quem clicou primeiro.
