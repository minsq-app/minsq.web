# Lista do dia
**frontend**

- Button "+", modal "Nova tarefa"
data === hoje (data atual) = até a proxima semana
hora de inicio (opicional) === aceita formato HH:MM protegido por regex - nao aceita hora passada
prioridade === selecao, schema só aceita as listadas
tarefa === min 4 e max 48 caracteres = sem caracter especial = max 14 tarefas por dia
+criar === notificacao ("criando tabela" "tabela criada")

- On click card, modal expansivo
editar === edita apenas o nome da tarefa = min 4 max 48 caracteres = sem caracter especial
apagar === apaga === tem certeza que deseja apagar esta tarefa = "apagar" "cancelar" ou esc e enter = "tarefa apagada" 
feito === botao feito deixa o card concluido, cinzxa e no final da lista

- ordem
cards com hora marcada tem preferencia no topo = cards com prioridade alta ou muito alta ficam acima dos com hora marcada = os sem horas ficam abaixo e os cards concluidos no final de tudo

cards de hora 13h vs as de 14h = quanto mais cedo mais no topo e quanto mais tarde mais abaixo17

- Button "planejamento futuro"
unico/fixo === unico nao se repete = fixo se repete todos anos naquela data
data === min hoje = max hoje do ano que vem
hora inicio === aceita formato HH:MM protegido por regex - nao aceita hora passada
prioridade === selecao, schema só aceita as listadas
tarefa === min 4 e max 48 caracteres = sem caracter especial = max 6 tarefas no planejamento futuro


**core**

- supabase
A Lista do Dia registra as informações na tabela chamada tasks no seu banco de dados do Supabase.

- rate limit
Trava de "Falso Futuro" (Limite de 1 Ano)
Enquanto as tarefas normais não passam do domingo da próxima semana, se a categoria for planejamento, o core libera a data, mas impõe um teto de ferro de exatamente 1 ano

Bloqueio Anti-Conclusão Prematura (O mais importante)
Não é possível "trapacear" o planejamento futuro. No momento em que você tenta alterar a tarefa passando concluida: true (seja via requisição ou clicando no card), o core antes verifica a data em que ela está alocada. Se a data for superior ao domingo da semana atual, a API te bloqueia imediatamente com o erro:

Rate Limit Estratégico (Proteção contra Spam/Sobrecarga)
Para o planejamento futuro não virar uma "lixeira" de ideias impulsivas, o core conta quantas tarefas já existem naquele dia alvo lá no futuro. Enquanto o limite de um dia normal atual é 14 tarefas, se o core percebe que a data apontada é um "planejamento futuro", o limite cai drasticamente para apenas 6 tarefas por dia

Proteção de Modificações e Conversão (Update Check)
Se você tentar pegar uma tarefa que já existe no futuro (uma tarefa de planejamento) e tentar alterar a categoria dela pra voltar a ser uma tarefa normal com data de 1 ano pra frente, o core percebe e te trava,

Isolamento e Criptografia
Assim como as demais tarefas, tudo isso passa pela verificação do userId. É impossível alguém mandar requisições para injetar planejamentos futuros na sua conta ou ler os planos que você tem para os meses que estão por vir.

"Atualizei o atributo maxlength="48" e os contadores (0/48) de todos os inputs nos modais de "Adicionar tarefa", tanto para o evento normal do dia atual, quanto para os de "planejamento futuro" que são justamente os que os atalhos H e J abrem. Agora você fisicamente não consegue digitar mais que 48 letras e nem menos que 4 na caixinha! Caracteres Especiais: Barrado se tentar eqnviar qualquer símbolo ou caractere estranho. O Regex de segurança permite apenas letras (incluindo com acentos), números e espaços."

"Back-end (Limpeza Automática): Toda vez que o dashboard carrega e faz a requisição pro servidor, ele tem uma função de "Lazy Cleanup". O servidor deleta automaticamente todas as tarefas do banco de dados que sejam anteriores à segunda-feira da semana atual. Ou seja, o sistema só armazena o histórico de tarefas da semana corrente; o que ficou pra trás é apagado permanentemente."

Bloqueios de Autenticação e Posse (Segurança)
Usuário Deslogado: Qualquer requisição sem um token válido de usuário é barrada na porta com o erro 401 - Não autorizado.

Isolamento de Dados: Ao atualizar, deletar ou concluir uma tarefa, o core sempre verifica se a tarefa pertence àquele usuário (eq('user_id', userId)). É impossível um usuário "hackear" a API para modificar ou apagar a tarefa de outra pessoa.

Bloqueios de Data (Prevenção de Viagem no Tempo)
Formato Falso: Barrado se a data não vier no formato exato AAAA-MM-DD ou se tentar mandar uma data que não existe no calendário (ex: 30 de Fevereiro).

Dias Anteriores: Se o usuário tentar agendar uma tarefa para ontem ou qualquer dia no passado, o core barra com o erro: "Não é possível agendar para um dia no passado."

Limite de Futuro: O sistema só permite agendar tarefas para a semana atual e a proxima. Se o usuário tentar agendar para uma data além desse limite (após o domingo da próxima semana), o sistema barra com o erro: "Só é possível agendar tarefas para a semana atual e a próxima."

Bloqueios de Horário
Formato de Tempo: Barrado se a hora não estiver perfeitamente no padrão HH:MM (com as horas não passando de 23 e minutos não passando de 59).

Horário que já passou: Se a tarefa for marcada para hoje, o core calcula a hora exata daquele momento. Se você tentar marcar para as 13:00h e já for 13:01h, ele bloqueia com a mensagem: "Não é possível agendar em horário que já passou hoje."

Bloqueio de Spam (Rate Limit Diário)
Limite Máximo: O servidor conta quantas tarefas o usuário já tem naquele dia exato. Se ele tentar criar a 15ª tarefa, o core recusa a requisição e devolve: "Limite de 14 tarefas por dia alcançado."

Bloqueio de Estrutura (Schema Zod)
Prioridades Inexistentes: Se a prioridade enviada não for exatamente uma das listadas no sistema ('muito_alta', 'alta', 'media', etc.), a requisição é barrada antes mesmo de executar qualquer código, protegendo o banco contra lixo estrutural.


# Rotina
**frontend**

- Button "+", modal "Adicionar a rotina"
dia da semana === selecao de segunda a domingo = min 1 e max 7
hora === formato HH:MM protegido por regex
titulo === min 3 max 40 caracteres

- Button "lixeira" (selecionar quais deletar)
ao clicar no icone de lixeira ativa o modo apagar = ao clicar no card e clicar na lixeira caí no modal de confirmação (cancelar/apagar ou esc/enter) = ao clicarna lixeira mas nao selecionar nada basta desclicar na lixeira para sair do modo apagar

**core**

- supabase
A Rotina Base registra as informações na tabela chamada routines no seu banco de dados do Supabase.

- rate limit
Bloqueios de Autenticação e Posse (Isolamento)
Token Necessário: Nenhuma requisição entra sem um userId válido (Erro 401).

Exclusão Segura: Mesmo que um hacker tente forçar a exclusão de um ID de rotina específico (seja um ou múltiplos), o core faz um delete() filtrando por .eq('user_id', userId). É literalmente impossível deletar rotinas da conta de outra pessoa.

Validações Estruturais e Anti-Quebra
Campos Obrigatórios: O servidor recusa na hora se a requisição chegar sem hora, sem título ou sem um array de dias_semana.

Dias Perfeitos: A matriz de dias tem que conter entre 1 a 7 opções. Além disso, ele varre a seleção para garantir que os números sejam estritamente entre 1 (Segunda) e 7 (Domingo). Mandar "Dia 8" causa bloqueio imediato.

Horário Exato: A hora é filtrada por Regex /^([01]\d|2[0-3]):([0-5]\d)$/. Impede horários irreais (como 25:99) exigindo o padrão limpo HH:MM.

Higiene de Conteúdo (Anti-Lixo)
Tamanho Físico: O titulo é validado para ter no mínimo 3 e no máximo 40 caracteres. Barrando envios de textos imensos que iriam destruir o layout do banco ou pesariam a rede.

Bloqueio de Caracteres Especiais: Assim como nas tarefas, o core roda um Regex no título que só permite passar Letras (com ou sem acento), Números e Espaços. Símbolos (%, @, !, *) e códigos maliciosos não entram no banco.

Bloqueio de Spam (Rate Limit Diário Inteligente)
Antes de salvar a sua nova rotina, o servidor mapeia toda a sua semana no banco de dados e agrupa a contagem dos seus hábitos dia a dia. Se você tentar cadastrar um hábito para Segunda e Terça, ele verifica quantos hábitos você já tem cadastrados nesses respectivos dias. Se qualquer um dos dias da seleção for estourar o limite rígido de 24 hábitos por dia, o sistema barra o salvamento inteiro e retorna o erro "Limite de 24 rotinas alcançado no dia selecionado".

