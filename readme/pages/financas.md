# Articulamento de renda
**frontend**

- padrão
padrão inicial ===  capital operacional: 35% | reserva de emergencia: 15% | investimento: 20% | crescimento: 15% | dinheiro pessoal: 15%

- personalizado (modal de selecao de presets)
editar === só é possivel editar o ultimo step, nao tem botao voltar
lixeira === apaga o preset = tem certeza = apagar / cancelar ou esc e enter 
novo preset === ...

- modal "Novo preset" (2 step)
- step1
nome === min 2 caracteres e max 30 caracteres = sem caracteres especiais e nao pode ser igual a um preset existente 

- step2
distribuicao === precisa ter sempre 100% = contando o investimento = ou seja se tiver ativo conta como um card igual ao os outros 
nome do card === min 2 caracteres e max 36 caracteres = sem caracteres especiais nao pode ser igual a nenhum outro card 
descricao do card === min 3 e max 60 caracteres = sem caracteres especiais 
cor === 10 cores selecionaveis = pode repetir
porcentagem === max 98% min 2% = todos cards juntos devem somar 98% para ser aprovado
+investimento === opcional = unica diferenca que tem rendimento esperado ao mes que vai de 0.01% a 40%

limits === max 10 cards por preset (contando o de investimento se tiver ativo) = max 3 presets = e no backend max 100 lancamentos ou seja o usuario só vai poder fazer no maximo 120 lancamentos entre saidas, entradas, resgate e aporte no investimento conta recorrente e renda fixa, se ele mexer nesses e passar de 120 backedn bloqueia e aparece uma mensagem que ele atingiu o limite de lancamentos 

- cards normais e card de investimento
card normal === user clica e cai no modal "Nova saida" o modal serve para tirar dinheiro daquele card (valor, nome, data) {data:de hoje até 15 dias para tras | nome: min 4 e max 40 caracteres sem caracteres especiais | valor: min 1$ e max 900 mil $ | }

card investimento === user clica no card e abre o modal "investimentos" (rendimento esperado, resgate, aporte, valor do aporte/resgate, data, ) {rendimento esperado: min 0.01% e max 40% | resgate só pode tirar o valor que tem no card | aporte só pode adicionar = valor min 1$ e max 900k | data: de hoje até 15 dias para tras}


**core**

- supabase
finance_settings (Configurações Financeiras)
Esta tabela guarda as configurações globais de finanças do usuário, incluindo as regras e opções específicas do Articulamento de Renda e Renda Fixa.

Colunas Relacionadas:

user_id (uuid): Chave primária referenciando a tabela users.
art_mode (varchar): Define o modo atual do articulamento (o padrão é 'padrao').
art_presets (jsonb): Guarda os "presets" (predefinições de distribuição) criados pelo usuário para o articulamento, como regras de % para diferentes categorias.
renda_fixa_cfg (jsonb): Configurações para a Renda Fixa (guardando as informações de valor e dia de recebimento em formato JSON).
inv_toggle_on, inv_pct_mes, inv_meta_aporte: Configurações atreladas à porcentagem de investimentos e metas mensais usadas no articulamento.
criado_em (timestamp): Data de criação da configuração.

finances (Transações Financeiras)
Esta é a tabela principal que registra as entradas de renda (que alimentam o cálculo do articulamento) e as saídas (quando a renda é distribuída/articulada para outras categorias e investimentos).

Colunas:

id (uuid): Identificador único da transação.
user_id (uuid): Referência ao usuário (users).
tipo (varchar): Define se é uma 'receita' (entrada) ou 'despesa' (saída/articulamento). O backend lê as "receitas" para calcular o valor total de renda disponível para distribuir.
valor (numeric): O valor da transação em si.
categoria (varchar): A categoria para a qual o dinheiro está indo (essencial para as distribuições de cotas).
descricao (text): Detalhes textuais da transação.
data (date): A data da transação ou distribuição.
criado_em (timestamp): Quando foi criada.

Como o backend opera o Articulamento (Resumo): Quando o fluxo de "Articulamento" ocorre, o backend (principalmente nos arquivos finance.controller.ts e finance-settings.controller.ts) lê a tabela finance_settings para saber as regras atuais (art_presets, regras de investimento de 2% mínimo, 98% máximo etc.) e a tabela finances para saber a soma total das entradas (receita) disponíveis no mês para verificar se a distribuição planejada (o budget) não excede o que o usuário realmente tem de saldo livre.

- rate limit
Limites Globais de Presets
Quantidade Máxima: O usuário só pode criar, no máximo, 3 presets de articulamento.
Nome do Preset:
Deve ter entre 2 e 30 caracteres.
Não pode conter caracteres especiais (apenas letras, números e espaços).
Deve ser único (o backend barra se você tentar criar um preset com o mesmo nome de um já existente, ignorando maiúsculas e minúsculas).

Validações dos Cards dentro do Preset
Limite de Cards: Um preset pode ter no máximo 10 cards no total (já incluindo o card de investimento, se ele existir).
Distribuição / Porcentagem Total: O backend checa milimetricamente se a soma das porcentagens de todos os cards do preset dá exatamente 98%. Se a soma der 97.9% ou 98.1%, ele rejeita a criação do preset.
Regras de Porcentagem Individual: Nenhum card pode ter menos de 2% ou mais de 98%.
Nome do Card:
Deve ter entre 2 e 36 caracteres.
Sem caracteres especiais.
Não podem existir cards com nomes duplicados dentro do mesmo preset.
Descrição do Card:
Deve ter entre 3 e 60 caracteres.
Não pode conter caracteres especiais (só são permitidos letras, números, espaços, ponto e vírgula).

Card de Investimento (Dentro do Preset)
Se o preset tiver a modalidade de investimento ativada, ele é tratado como um card, e além das validações de nome, descrição e porcentagem (citadas acima), ele valida:

Rendimento Esperado (Yield): Só aceita valores entre 0.01% e 40%. Qualquer coisa fora dessa faixa é barrada pelo servidor.

Proteções de Budget (O "Cofrinho" do Card) e Limite de Transações
A Regra de Ouro do Saldo (checkBudget): Ao lançar uma "saída" ou tirar dinheiro de um dos cards (categorias) do articulamento, o backend pega a Renda Total Mensal e multiplica pela porcentagem do card. Se o valor que o usuário estiver tentando gastar for maior que a quantia disponível (budget) daquele card, o backend bloqueia a transação e avisa que não há saldo livre suficiente na categoria.
Limite de Lançamentos: Conforme definido no core, o backend não deixará o usuário fazer mais do que 120 transações ativas por vez.
Renda Fixa: Se habilitada, o backend assegura que o valor fique entre R$ 50,00 e R$ 900.000,00 e o dia do recebimento caia entre o dia 1 e 28. (Evitando o problema de fevereiro não ter dias 29, 30 ou 31).

Limites de Valor (valor)
Mínimo: R$ 1,00.
Máximo: R$ 900.000,00.
O backend devolve erro se o valor não for um número válido ou se estiver fora dessa faixa.

Limites de Data (data)
Futuro Bloqueado: A data do lançamento não pode ser no futuro (o backend compara com o today).
Passado Limitado: A data não pode ser anterior a 15 dias atrás. O backend calcula exatamente 15 dias para trás a partir da data atual e barra se for mais antigo que isso.
O backend também usa o horário de meio-dia (T12:00:00) na validação para evitar que o fuso horário (timezone) pule um dia por acidente e cause bloqueios injustos

Limites de Nome/Descrição (descricao)
Tamanho: Deve ter no mínimo 4 e no máximo 40 caracteres.
Caracteres Especiais: Usa uma Regex estrita (/^[a-zA-Z0-9\sÀ-ÿ()[\]✓.,-]+$/). Ele só permite:
Letras (com e sem acento).
Números.
Espaços.
Alguns símbolos de pontuação básicos (., ,, -).
Alguns símbolos usados internamente pelo sistema para marcar contas recorrentes ((, ), [, ], ✓).
Qualquer outro caractere (como emojis, @, #, !) será barrado com a mensagem "A descrição contém caracteres inválidos."

Limite de Resgate e Aporte (Investimentos)
Aporte: Respeita a regra geral de valor (R$ 1 a R$ 900 mil) e as regras de data (até 15 dias atrás).
(Nota Técnica: Atualmente, no código do controller finance.controller.ts, lançamentos do tipo "investimentos" ignoram a função de checkBudget, o que significa que o bloqueio de "resgatar apenas o valor que tem no card" precisa ser garantido primariamente pelo frontend, ou necessitaria de uma trava extra adicionada no backend para ler o saldo de investimentos antes de aprovar o resgate).

Correção no Limite de 120 Lançamentos (Anti-Spam)
Nas suas anotações diz "não deixará o usuário fazer mais do que 120 transações ativas por vez". Na verdade, a trava do backend (checkDailyFinanceLimit) é um limite de criação Por Dia.

O backend soma quantos lançamentos financeiros + contas recorrentes você criou naquele dia exato (a partir de 00:00).
Se passar de 120 criações num único dia, ele bloqueia. (É uma trava Anti-Spam / Anti-Abuso).
Você pode ter mil transações salvas no banco, o que não pode é criar mais de 120 em um período de 24 horas.

Limites do Modo Padrão (Sem ser via Preset)
Se o usuário estiver usando o "Modo Padrão" (articulamento nativo de 35% / 15% / 20% etc.), as configurações de investimento no backend sofrem duas validações extras na tabela finance_settings:

Porcentagem de Rendimento (inv_pct_mes): O backend só aceita números entre 0% e 20% ao mês. (Se for preenchido via preset, o limite é aquele outro de 0.01% a 40%).
Meta de Aporte (inv_meta_aporte): A trava do backend garante que o usuário não digite valores negativos (o mínimo é 0).


# Lancamentos recentes
**frontend**

- +lancamento (abre o modal de lancamento recente)
tipo === {entrada, conta recorrente, renda fixa}

entrada === (valor, nome e data)

conta recorrente === (valor da parcela, nome, parcelas, dia de cobranca, modo)

renda fixa === (valor da renda fixa, dia de renovacao)

- entrada
valor === min 1$ max 900k
nome === min 4 e max 40 caracteres sem caracteres especiais
data === de hoje até 15 dias para tras 

- conta recorrente 
valor da parcela === min 1$ max 900k
nome === min 4 max 40 caracteres sem especial
parcelas === (2X - 60X, recorrente)
2X - 60X === escolher entre 2 a 60 parcelas
recorrente === cobra todo mes no dia escolhido
dia de cobranca === entre 1 e 28

lembrando que aqui apenas notifica

- renda fixa
valor === min 50$ max 900k
dia de renovacao === entre 1 e 28 = no dia da renovacao o sistema vai fazer uma entrada automatica


- recorrentes
o recorrentes serve apenas para mostrar as contas recorrentes que o usuario cadastrou e apagar = tem certeza que deseja apagar = apagar / cancelar ou esc e enter 


- filtros
os divergentes sao :
invest === todos dias vai mostrar o valor que o investimento rendeu no dia caso seja maior que 1$
a pagar === vai mostrar a conta do mes o mes inteiro 
o resto vai funcionar normalmente



**core**

- supabase
Tabela finances (Para "Entrada")
Quando você cria um lançamento do tipo Entrada (que exige apenas valor, nome e data), ele vai direto para a tabela finances.

O campo tipo é salvo como 'entrada'.
É essa tabela que acumula seu saldo para o articulamento de renda.

Tabela recurring_bills (Para "Conta Recorrente")
Quando você cadastra uma nova Conta Recorrente, os dados vão para esta tabela separada, feita sob medida para gerenciar faturas. Ela guarda todos os detalhes de repetição:

valor (valor da parcela)
descricao (nome)
parcelas (ex: 2 a 60, ou null se for infinita)
infinito (booleano, true se for marcado como "recorrente")
dia (dia de cobrança, entre 1 e 28)
Nota: Posteriormente, quando uma conta recorrente é paga/vence, o sistema pode criar uma cópia dela na tabela finances como 'despesa', mas o cadastro original vive em recurring_bills.

Tabela finance_settings (Para "Renda Fixa")
Embora a Renda Fixa adicione dinheiro à sua conta, o cadastro dela não vai imediatamente para a tabela de finanças. Ela é salva como uma configuração dentro de finance_settings.

O backend usa a coluna renda_fixa_cfg (formato JSON) para guardar o valor (R$ 50 a R$ 900.000) e o dia (1 a 28).
A Mágica: O sistema ou cronjob lê essa tabela finance_settings todo mês e, quando chega no dia de renovacao escolhido, ele gera automaticamente um lançamento do tipo 'entrada' lá na tabela finances sem o usuário precisar fazer nada.
Resumindo:

Entrada ➔ finances
Conta Recorrente ➔ recurring_bills
Renda Fixa ➔ finance_settings (e depois gera o saldo automaticamente em finances).


- rate limit
Entrada (Transação Simples)
Usa as regras da tabela finances e validações pesadas em cima do formulário:

Valor: Estritamente entre R$ 1,00 e R$ 900.000,00.
Nome: Entre 4 e 40 caracteres. Aceita letras (com/sem acento), números, espaços e alguns símbolos (., ,, -, (), [], ✓).
Data: Não pode ser futura. E a máquina barra se a data for mais velha que 15 dias atrás.
Limite Global de Criação: Entra na soma daquela proteção Anti-Spam (não pode criar mais do que 120 registros somados de finanças+recorrentes num único dia).

Conta Recorrente
Tem proteções bem específicas no seu arquivo recurring-bills.controller.ts:

Regra Anti-Spam: Também entra na cota das 120 criações por dia.
Limite Máximo de Contas: O backend tem uma trava dura: você só pode ter, no máximo, 20 contas recorrentes cadastradas ativas. Se tentar salvar a 21ª, ele bloqueia e diz "Limite atingido: máximo de 20 contas recorrentes".
Nome: Diferente da entrada simples, aqui a Regex é MAIS RÍGIDA (/^[a-zA-Z0-9\sÀ-ÿ]+$/). Não permite traço, nem vírgula, nem parênteses. Só letras, números e espaços (4 a 40 caracteres).
Valor da Parcela: Também entre R$ 1,00 e R$ 900.000,00.
Dia de Cobrança: Restrito do dia 1 ao 28 (para evitar furos em meses curtos).
Modo de Aviso: O backend rejeita qualquer coisa diferente da string "notificar".
Parcelas (Se não for infinito): O sistema só aceita que você dívida entre 2 e 60 parcelas. Qualquer outro número é barrado.

Renda Fixa (Configuração)
Sendo gravada no finance_settings:

Valor Mínimo/Máximo: R$ 50,00 a R$ 900.000,00.
Dia de Renovação: Também estrito entre o dia 1 e 28.


# 2Cards e Historico de lancamentos
**frontend**

- saldo e saidas
saldo === mostra o saldo atual de todas entradas = caso o investimento esteja ativo o card saldo vai tirar a porcentagem do investimento (ex: 10$ 50% card1 e 50% invest === 5$ no saldo)

saidas === mostra todas saidas dos cards menos do investimento


- historico de lancamentos
baixar mes atual ou ano completo === baixa em txt 

clicando no card do mes === abre modal com todos lancamentos do mes (saldo, entradas, saidas, registros) nada clicavel apenas o botao baixar esse mes

**core**

- supabase
Saldo (Calculado)
Tabelas usadas: finances e finance_settings.
O backend vai na tabela finances e soma todas as transações que têm o tipo 'entrada'.
Depois, ele subtrai todas as transações do tipo 'saida'.
Para finalizar (e cumprir a sua regra), o backend consulta a tabela finance_settings para saber as regras do preset ativo, calcula quanto de dinheiro deveria ir para o card de "Investimento" e abate essa porcentagem do saldo total, mostrando apenas o dinheiro 100% livre.

Saídas (Calculado)
Tabela usada: finances.
O backend varre a tabela finances buscando tudo o que for do tipo 'saida'.
Ele soma todos esses valores (excluindo aportes de investimento, conforme a sua regra) e devolve para o frontend o montante total de saídas daquele mês.

Histórico de Lançamentos (Listagem e Exportação)
Tabela usada: finances.
O histórico nada mais é do que uma leitura direta (um SELECT) na tabela finances, ordenada da data mais recente para a mais antiga.
Quando o usuário clica em "baixar mês atual ou ano completo", a API (no método exportTxt) vai na tabela finances, filtra pelo período solicitado, formata linha por linha (ex: + 10,00 ou - 50,00) e cospe o arquivo .txt para download.
Resumo Simples: Tudo isso bebe da fonte da tabela finances. É ela que sustenta os 2 cards e o histórico!


- rate limit
Rate Limit Global da API (apiLimiter)
No arquivo rateLimit.middleware.ts e index.ts, o Minsq tem um guarda-costas global para todas as rotas /api/* (o que inclui as rotas de puxar o saldo e baixar o histórico).

Limite: O usuário/IP só pode fazer 300 requisições a cada 10 minutos.
Ação: Se o usuário ficar apertando F5 freneticamente na tela de finanças ou tentar usar um script de bot para derrubar o servidor baixando o .txt milhares de vezes, ao bater 301 requisições, o backend bloqueia o IP dele e retorna o erro: "error": "Muitas requisições automáticas detectadas. Acalme-se um pouco!"

Autenticação e Propriedade (Security Check)
Sempre que o frontend tenta calcular o saldo ou gerar o .txt do histórico, o backend puxa o token JWT do usuário (userId).
A query no Supabase (.eq('user_id', userId)) garante de forma rígida que o usuário "A" jamais consiga ver o saldo ou baixar o .txt dos lançamentos do usuário "B", mesmo que ele intercepte a requisição de rede.
Basicamente, para visualização de dados, a maior preocupação do backend do Minsq é Privacidade (só você vê seus dados) e Anti-DDoS (bloqueio de Flood via apiLimiter).

# Adendos Finais (Proteções Extras do Backend)

Faltou o campo mes_inicio na Conta Recorrente
Na criação de Conta Recorrente, o backend exige obrigatoriamente o envio do campo `mes_inicio` (ex: "2026-08"). Se o frontend tentar criar a conta sem esse campo, a API recusa e lança o erro de "Preencha todos os campos obrigatórios".

Edição e Exclusão (Update / Delete)
Update: Quando o usuário edita um lançamento, o backend passa o payload exatamente pelo mesmo funil da criação. Ou seja, ao editar, não dá para colocar uma data no futuro, não dá para violar a Regex, e o backend roda o checkBudget de novo para garantir que a edição não estoure o saldo do Card.
Security Check Ampliado: O backend aplica o escudo (.eq('user_id', userId)) nas rotas de Edição e Exclusão. Isso impede que um hacker intercepte a rede e mande deletar a transação pertencente a outro usuário.

Detalhe Comportamental do "Resgate" (Investimento) no Saldo
Para somar as "Receitas" que formam o Saldo, o backend faz estritamente `if (item.tipo === 'entrada')`.
Ou seja, se você fizer um Resgate de investimento (que o sistema trata como `tipo = 'investimento'` com valor positivo), ele não soma no cálculo de Receitas do Saldo. Para o dinheiro resgatado voltar ao saldo livre real, o frontend precisa estar programado para gerar uma transação separada do tipo 'entrada', do contrário ele fica fora do cálculo base do Saldo.