# Metas
**frontend**

- Button "+" abre modal "Nova meta"
titulo da meta === min 3 e max 28 caracteres = sem caracter especial
metas === max 7 metas


- Card da meta criada
Icones
alterar foto === sem nenhum ou min 40kb e max 2mb = jpg, jpeg ou png = "foto alterada"
apagar meta === "certeza que deseja apagar esta meta" = "apagar" "cancelar" ou esc e enter = "meta apagada"


- Modal da meta criada
nome da meta === min 3 e max 28 caracteres = sem caracter especial = "meta atualizada"
descricao da meta === min 8 e max 1000 caracteres = com caracteres especiais = "descricao atualizada"

**core**

- supabase
Salvas na tabela plans_action. Principais colunas: plan_id, name, desc (texto do card), e photo_url. (Nota: Antigamente existia uma tabela chamada goals, mas ela foi desativada e a funcionalidade foi unificada na plans_action).

- rate limit
Limite de Quantidade (Banco de Dados / Controller)
A API puxa todas as metas com o seu ID de usuário. Se você já possuir 7 metas, o PlansActionController bloqueia a requisição de insert na hora com um erro 400.

Validação da Capa (Uploads Controller)
O arquivo bate no UploadsController e a pasta destino category-covers é checada:

Tamanho: Rejeita instantaneamente < 40KB ou > 2MB.
Formato: Apenas arquivos com MIME Type de image/jpeg ou image/png são permitidos. Tentar enviar WebP ou outro formato resulta em rejeição. (Ausência de arquivo também é aceita).

Título da Meta (Zod Middleware)
O planActionSchema captura o campo name (título) antes do banco:

Se tiver menos de 3 ou mais de 28 caracteres: erro de validação.
O regex /^[a-zA-Z0-9\sÀ-ÿ]+$/ varre o campo, rejeitando qualquer traço de caracteres especiais.

Descrição da Meta (Controller e Zod)
O Zod garante que o campo desc tenha no máximo 1000 caracteres (aceitando formatações livres/caracteres especiais normalmente).
O PlansActionController também faz uma checagem customizada: se o campo for enviado e não estiver vazio, ele tem que ter no mínimo 8 caracteres.

- Rate Limiting (Anti-Spam):

A rota de upload da foto da meta tem um limite estrito de no máximo 10 envios por minuto vindo do mesmo IP. Se alguém tentar inundar seu Supabase com fotos, o servidor corta a conexão.
As rotas normais de criar/editar também passam pelo apiLimiter global que impede ataques de negação de serviço (DDoS).
Isolamento de Usuário (Multitenancy):

A sua meta nunca vai vazar ou ser editada por outro usuário. O middleware authMiddleware extrai o seu user_id do Token JWT e obriga o banco de dados a olhar apenas para as metas que são criptograficamente suas. Mesmo que um hacker tente passar o ID da sua meta na requisição dele, o backend dá erro de não autorizado ou simplesmente não encontra o arquivo.
Garantia de Estrutura Obrigatória:

O Zod e o Controller não deixam você mandar um "fantasma" para o banco. Se a requisição chegar sem os identificadores obrigatórios (cat_id e name), a requisição é morta com erro 400 antes de bater no banc0.



# Plano de ação
**frontend**

- Button "+" do plano de ação abre o modal "Novo plano de ação"
titulo do plano de ação === min 3 e max 36 caracteres = sem caracter especial
mindmaps === max 6 mindmaps


- Card do plano de ação criado
Icones
alterar foto === sem nenhum ou min 100kb e max 2mb = jpg, jpeg ou png = "foto alterada"
editar nome === min 3 e max 36 caracteres = sem caracter especial = "nome alterado"
apagar meta === "certeza que deseja apagar esta meta" = "apagar" "cancelar" ou esc e enter = "meta apagada"


- Mindmap do plano de ação criado
centralizar mindmap
apagar badge selecionado

max caracteres por badge = "min 3 e max 52 caracteres = sem caracter especial"
max nós por plano de ação = 150 n


**core**

- supabase
Salvas na tabela mindmaps. Principais colunas: map_id, title, nodes (um JSON com todos os botõezinhos do mapa), scale, pan e photo.

- rate limiting
Limite de Quantidade (Banco de Dados / Controller) A API conta quantos mapas mentais existem atrelados ao seu ID de usuário no momento da criação. Se você já possuir 6 planos de ação, o MindmapsController bloqueia a requisição de insert com um erro 400.

Validação da Capa (Uploads Controller) A imagem é enviada para a pasta destino mindmap-covers e passa pela mesma checagem de peso:

Tamanho: Rejeita instantaneamente < 40KB ou > 2MB.
Formato: Apenas arquivos com MIME Type de image/jpeg ou image/png são permitidos. Tentar enviar WebP ou outro formato resulta em rejeição. (Ausência de arquivo também é aceita).

Título do Plano de Ação (Zod Middleware) O mindmapSchema bloqueia as rotas de criação (POST) e edição (PATCH), capturando o campo title:

Se tiver menos de 3 ou mais de 36 caracteres: erro de validação.
O regex /^[a-zA-Z0-9\sÀ-ÿ]+$/ varre o título, rejeitando qualquer tentativa de enviar caracteres especiais.

Limites dos Nós e Badges (Zod Middleware) É aqui que o Zod brilha no mindmap. Ele entra dentro do JSON antes de salvar no banco e impõe:

Max 150 Nós: Se a requisição tiver um array com mais de 150 elementos (bolinhas), ele derruba o salvamento.
Validação Individual: Ele checa o campo text de cada uma das bolinhas enviadas. Obriga que o texto tenha entre 3 e 52 caracteres e joga a mesma barreira Regex (/^[a-zA-Z0-9\sÀ-ÿ]+$/) para proibir caracteres especiais dentro dos nós.

Segurança Global (Middlewares Isolados)

O validateRequest destrói qualquer campo extra ou lixo não mapeado que tentem enviar via JSON.
O authMiddleware isola suas tabelas por Token JWT, enquanto o Rate Limiting global pune abusos e DDoS contra as rotas de mindmap.


# Controle de vicio
**frontend**

- Button "+" registrar vicio
nome do vicio === min 4 e max 38 caracteres = sem caracter especial
descricao === min 6 e max 80 caracteres = sem caracteres especiais

resetar timer === botão de resetar = tem certeza que deseja resetar o timer "resetar" "cancelar" ou esc e enter = "timer resetado"
apagar vicio === botão apagar = tem certeza que deseja apagar este vicio "apagar" "cancelar" ou esc e enter = "vicio apagado"

Marcas
Menos de 1 hora: 🌱 Cada minuto é uma vitória. Você começou!
De 1h a 6 horas: 💪 Você está resistindo! O desejo passa em breve.
De 6h a 12 horas: 🔥 Meio dia de força! Seu cérebro está se adaptando.
De 12h a 24 horas: ⚡ Quase 24h! Você está quebrando o ciclo.
De 24h a 48 horas (1 a 2 dias): 🏆 1 dia completo! A neuroplasticidade está agindo.
De 48h a 72 horas (2 a 3 dias): 💎 2 dias! Os receptores de dopamina estão se recuperando.
De 72h a 168 horas (3 a 7 dias): 🚀 Mais de 3 dias! O hábito novo está se formando.
De 168h a 336 horas (1 a 2 semanas): 🌟 Uma semana inteira! Você está redefinindo quem é.
Mais de 336 horas (Mais de 14 dias): 👑 Lendário. Você provou que é maior que qualquer vício.


**core**

- supabase
Salvos na tabela addictions. Principais colunas: addiction_id, nome, desc_text e started_at (que é de onde o cronômetro começa a contar o tempo que você está limpo).

- rate limit
Validação de Dados do Vício (Zod Middleware) O addictionSchema atua como um escudo nas rotas de criação (POST) e atualização (PATCH), inspecionando cada campo enviado antes de gravar no banco:

Nome do Vício (nome): Rejeita qualquer texto que tenha menos de 4 ou mais de 38 caracteres. O campo passa por uma Regex (/^[a-zA-Z0-9\sÀ-ÿ]+$/) que bloqueia imediatamente a inserção de caracteres especiais.
Descrição do Vício (desc_text): Da mesma forma, rejeita textos menores que 6 ou maiores que 80 caracteres. Aplica a mesma Regex para proibir totalmente o uso de caracteres especiais ou símbolos.

Integridade do Cronômetro

O backend garante que o started_at gravado na criação ou no reinício (reset) siga o formato ISO restrito de data/hora ditado pelo servidor, evitando manipulações no tempo de progresso.

Segurança Global (Middlewares Isolados)

Bloqueio de Lixo: O validateRequest corta qualquer chave JSON intrusa enviada na requisição, garantindo que o banco de dados receba apenas o formato exato.
Isolamento de Dados: O authMiddleware garante que todos os vícios listados, editados ou apagados pertençam estritamente ao user_id autenticado pelo Token JWT, impossibilitando que um usuário acesse os dados de outro.
Proteção Anti-DDoS: As requisições do controle de vícios estão debaixo do guarda-chuva do apiLimiter global, evitando spam de criações ou resets via scripts maliciosos.