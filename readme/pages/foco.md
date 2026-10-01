# Rotina
**frontend**

- Nova rotina
leva para a page "create-rotine"


- Nova pasta
nome === min 3 e max 48 caracteres
X === apagar pasta cancelar ou apagar esc ou enter para confirmar

limit === max 6 pastas 

- X
apagar tem certeza? cancelar ou apagar esc ou enter para confirmar

- On click rotina criada
copiar === o copiar copia todos exercicios e series (Agachamento Zercher (3 séries)) em formato de lista um em baxio do outro
editar === desabilitado na versao beta por enquanto
compartilhar rotina === desabilitado na versao beta por enquanto

restante apenas visual

- calendario e estatisticas 
apenas visual

bloquear a ceta de ir alem do mes atual no backend


**core**

- supabase 
foco_folders:

Salva as pastas criadas pelo usuário.
Armazena as informações básicas como id, name, user_id e a data de criação.

foco_routines:

Armazena as rotinas de treino.
Contém os dados como name, duration_min, o folder_id (para saber em qual pasta a rotina está), e um array/JSON com todos os exercises (exercícios, séries, repetições, etc) vinculados a ela.


focus_sessions:

Guarda o registro das sessões de estudo/concentração (Pomodoro).
Armazena a duração (duracao_min), o tipo da sessão e a data. Usado para gerar aquelas estatísticas de tempo focado e quantidade de sessões.


- rate limit
Isolamento de Dados (Tenant Isolation)
eq('user_id', userId) em 100% das queries: O sistema NUNCA confia no que vem do cliente. Para apagar, ler ou criar qualquer pasta ou rotina, o backend injeta o userId extraído do token de autenticação seguro. É impossível que o "Usuário A" apague ou sequer veja as pastas do "Usuário B", mesmo que o Usuário A descubra o ID da pasta.

 Autenticação Obrigatória
Middleware de Auth (authMiddleware): Absolutamente todas as rotas de foco (/sessions, /folders, /routines) estão protegidas. Se a requisição não vier com um token válido de login, ela morre antes mesmo de chegar no controlador (retornando erro 401).


 Validação e Bloqueios de Abuso (Limites)
O backend faz contagens exatas (count: 'exact') diretamente no banco ANTES de permitir novas inserções para evitar que encham seu Supabase de lixo:

Limite de Pastas: Checa se o usuário já tem 6 pastas. Se tiver, recusa a requisição (Erro 400).
Limite de Rotinas: Checa se o usuário já tem 24 rotinas. Se tiver, recusa a requisição.
Limite de Exercícios: O array de exercícios enviado não pode estar vazio, não pode ser nulo, e não pode ultrapassar 10 itens.


Sanitização e Validação de Texto
Nome de Pastas:
Remove espaços vazios inúteis (trim()).
Bloqueia textos com menos de 3 ou mais de 48 caracteres.
Prevenção de Duplicatas: Faz uma busca no banco ignorando maiúsculas e minúsculas (ilike) para garantir que você não crie duas pastas chamadas "Perna" e "perna".
Rotinas: Bloqueia submissões de rotinas sem nome

Controle Autoritário de Datas
O servidor não confia cegamente no horário do celular/computador do usuário. Se o frontend não enviar uma data válida para a Sessão de Foco, o backend assume o controle e injeta a data/hora segura do próprio servidor (new Date().toISOString()).

Rate Limiting (Middleware Global)
Como o seu core já conta com o arquivo rateLimit.middleware.ts, a API barra metralhadoras de requisição. Se algum usuário tentar rodar um script malicioso para ficar enviando centenas de pedidos de "criar rotina" no mesmo segundo, o middleware intercepta o excesso de carga pelo IP, blindando o Supabase.