# Rotina

card rotina apenas mostra infos dos habitos do dia daquela semana, nao é clicavel nem nada apenas visual


# Lista do dia 
**frontend**

- Button "+", modal "Nova tarefa"

Data === calendario personalizado = selecao de data Min hoje max até segunda da semana depois da proxima semana
horas === hora inicio (opcional) no formato HH:MM protegida por regex = a hora nao pode ser menor que a hora atual
prioridade === selecao = max 1
tarefa === min 4 e max 48 caracteres = sem caracter especial = max 14 tarefas por dia
+criar === notificacao ("criando tabela" "tabela criada") = para apagar a tarefa criada button "X"
X === tem certeza que deseja apagar esta tarefa = "apagar" "cancelar" ou esc e enter = "tarefa apagada" 



**core**

- Supabase
"tabela é tasks. (Ela é consultada pelo core, por exemplo, na rota de dashboard através de supabase.from('tasks').select('*'))."

- Function
"Função de Renderização: O nome da função responsável por desenhar as tarefas na tela do dashboard é renderTaskList('taskList', taskHoje).
Variável dos Dados: As tarefas específicas do dia são filtradas e armazenadas em uma variável constante chamada taskHoje (gerada a partir de S.tasks.filter(t => t.data === hoje)).
IDs do HTML (Elementos DOM): O card inteiro da lista possui o ID dashTaskCard, e o contêiner onde as tarefas são inseridas possui o ID taskList."

- Rate Limit
"Limite Rígido de Criação (14 tarefas): No back-end (tasks.controller.ts), existe um bloqueio forte. Sempre que você tenta criar uma tarefa nova, a API conta quantas tarefas já existem para aquela data específica. Se o número for igual ou maior que 15, a API recusa a criação e retorna o erro: "Limite de 14 tarefas por dia alcançado."

"(tasks.controller.ts):

validação na raiz. Tanto na rota de criação (Create) quanto na rota de edição (Update), se a tarefa ultrapassar 48 ou menos que 4 caracteres e sem caracyer especial, a API aborta a ação e retorna 400 Bad Request com a mensagem "Máximo de 48 caracteres para a tarefa". Isso blinda o banco de dados contra envios maliciosos."

"Autorização e Posse: Somente o dono das tarefas pode criar, atualizar, listar, completar ou deletar (validação rigorosa de user_id vindo do token no Supabase em todas as requisições)."

"Regex e Validação Estrita de Tempo:

Data: Aceita obrigatoriamente um input de data real e no padrão AAAA-MM-DD (com testes contra NaN e Date.parse()).
Hora: Valida via regex o padrão HH:MM garantindo que os minutos não ultrapassem 59 e a hora não ultrapasse 23."

"Bloqueio de Retroatividade Temporal:

Impede o agendamento de tasks em dias que já passaram (comparando dinamicamente e compensando com o fuso-horário local do servidor).
Impede o agendamento de tasks para o dia de hoje em horários/minutos passados, comparando os minutos desde a meia-noite (currentTotal)."



# Main card
**frontend**

- Saudação + horario + data (aqui iremos mostrar somente as saudacoes que tem)
"Madrugada (00h às 04h): 25 saudações (ex: "Coruja noturna", "Turno secreto iniciado")
Amanhecer (04h às 07h): 31 saudações (ex: "Enquanto outros dormem...", "Bom dia, madrugador")
Manhã (07h às 10h): 20 saudações (ex: "Café salvando vidas", "Bom dia, modo ativo")
Meio-dia (10h às 13h): 20 saudações (ex: "Meio do caminho", "Ainda tem energia?")
Tarde (13h às 17h): 24 saudações (ex: "Pós-almoço clássico", "Bora continuar")
Fim de Tarde (17h às 20h): 24 saudações (ex: "Últimas missões", "Hora de finalizar")
Noite (20h às 24h): 22 saudações (ex: "Hora da calmaria", "Último round do dia")"


- Streak  + streak quebrada + blocos de mes (novamente só iremos mostrar a streak por que o resto é automatico)
"O card principal do dashboard puxa a informação de streak da tabela users, mais especificamente da coluna streak."

- Motor de decisao (gera insights de acordo com os seus dados em tempo real)
|| saude e treinos || 

1 - "Nenhum treino este mês" (Crítico): Se você não treinou nenhuma vez no mês atual. (Sub: "Comece hoje — qualquer movimento conta.")

2 - "X dias sem treinar" (Crítico/Alerta Vermelho): Se você ficar 14 dias ou mais sem registrar treinos. (Sub: "Você desistiu? Seu corpo tá esperando — uma rep já basta pra voltar.")

3 - "X dias sem treinar" (Aviso Forte): Se você ficar entre 7 e 13 dias sem treinar. (Sub: "Tá acontecendo algo? Descanse se precisar — mas não some.")

4 - "Consistência caindo esta semana" (Aviso): Se a sua média histórica é boa, mas você já passou de quinta-feira tendo treinado bem menos que o normal (queda entre 34% e 65% do ritmo).

5 - "Semana um pouco abaixo do ritmo" (Aviso Leve): Parecido com o anterior, mas a queda foi pequena (até 34% abaixo da média).

6 - "Xª semana consecutiva na academia" (Positivo/Verde): Se você bater ou superar sua média semanal. Ele alterna frases como: "Disciplina é isso. Continue.", "Consistência bate intensidade toda vez."

7 - "X treinos este mês" (Info): Apenas para te manter atualizado caso você esteja num ritmo normal, sem grandes quedas ou recordes.


|| metas e planejamento ||

1 - "Sem planos de ação" (Crítico): Se você não criou nenhum mapa mental/meta. (Sub: "Sem direção, qualquer caminho serve — crie seu primeiro plano de ação.")

2 - "X planos de ação vazios" (Aviso): Se você criou metas mas não escreveu os passos/descrição dentro delas. (Sub: "Adicione uma descrição e planeje seus passos.")


|| streak ||

1 - "X dias seguidos" (Positivo/Verde): Acionado quando você entra no Minsq por 7 dias consecutivos ou mais. (Sub: "Consistência é o ativo mais valioso. Siga firme.")


|| estudos ||

1- "X horas estudadas no mês" (Positivo/Verde): Se você registrar 10 horas ou mais de estudos/foco no mês. (Sub: "X sessões registradas — ritmo acima da média.")

2 - "Nenhuma sessão registrada" (Info): Se você nunca usou o cronômetro/pomodoro do sistema.


|| financas ||

1 - "Saldo positivo este mês" (Positivo/Verde): Se você registrou entradas e o saldo final (entradas menos saídas) está no azul. (Sub: "+R$ X — você está acumulando.")

2 - "Saldo negativo no mês" (Crítico): Se você registrou gastos maiores que as entradas no mês atual. (Sub: "Saídas superam entradas em R$ X.")


|| tarefas do dia ||

1- "X% de conclusão" (Dinâmico): Mostra quantas tarefas de hoje você já marcou como feitas.
     Fica Verde (Positivo) se > 70%
     Fica Cinza (Info) se > 40% e < 70%
     Fica Laranja (Aviso) se < 40%

//// limite de 3 cards ////


- Terminal
"tarefas (hoje)"
1 - hoje/marcar/<descrição> Cria uma tarefa para o dia de hoje. (Ex: hoje/marcar/Comprar pão)
2 -hoje/marcar/<mês>/<dia>/<descrição> Cria uma tarefa para uma data no futuro. no mes e dia é só selecionar o mês desejado na lista, depois o dia, e então digitar a tarefa.

"metas e vicios"
1 - metas/meta/<título> Cria um novo card de Plano de Ação / Meta. (Ex: metas/meta/Viagens)
2 - metas/vicio/criar/<nome> Inicia um novo monitoramento de vício no seu painel. (Ex: metas/vicio/criar/Açúcar)
3 - metas/vicio/redefinir/<nome> Reinicia o relógio/contador de um vício que você já acompanha. (Ex: metas/vicio/redefinir/Açúcar)

"saude"
1 - saude/agua/<ml> Registra consumo de água na hora (em mililitros). (Ex: saude/agua/500)
2 - saude/peso/<valor> Registra um novo histórico do seu peso (entre 35kg e 300kg). (Ex: saude/peso/75.5)

"navegacao"
1 - ir/<módulo> Alterna rapidamente a tela sem usar o mouse. (Módulos aceitos: hoje, metas, financas, estudos, saude, foco, notas, analitics, perfil)

"system"
1 - customizar/visual Abre direto o painel lateral de customização visual da Dashboard (opções de Background, Tema Claro/Blackout, etc).
2 - customizar/tipografia Abre o modal global de configuração de fontes do sistema.
3 - ajuda ou help Exibe um toast resumido na tela com a lista base de comandos.


**core**

- supabase
Tabelas no Supabase (Conexão) Como o card consolida dados de vários lugares (para o Motor de Decisão / AI Insights), ele se conecta com várias tabelas simultaneamente:

users: Para pegar o nome da saudação e o número do seu streak (ofensiva).
health_logs: Para os insights de treinos e saúde.
study_sessions: Para os insights de horas de estudo.
finances: Para os insights de movimentação financeira e saldo.
tasks: Para a taxa de conclusão de tarefas daquele dia/mês.


- function
Nome das Funções / Controladores

No Core: A função que faz a busca de todas essas tabelas de uma só vez se chama summary (localizada em DashboardController.summary), que alimenta a rota principal do dashboard.
No Frontend (Dashboard):
Para montar os Insights do motor de decisão: a função se chama buildAiInsights().
Para o Terminal (registro rápido/comandos): a função acionada ao apertar Enter se chama quickAsk().
Para a Saudação: A lógica é processada diretamente no render principal e animada pela função showEntryGreeting().


- route


- rate limit
"Aviso no Insights (10 tarefas): No arquivo dashboard.html (Motor de Decisão/Insights), existe uma regra fixa que dispara um alerta amarelo sempre que você atinge ou passa de 10 tarefas no dia atual: "Dia sobrecarregado. Você tem {X} tarefas hoje. Tente reorganizar para não se sobrecarregar.""

"Console IA: Atualizei a verificação JavaScript do terminal rápido para barrar textos maiores que 48 caracteres (text.length > 48), estourando um alerta na tela sem nem chamar a API."

**temos que terminar isso ainda**




# Planos de acao
**frontend**

- Cards
exibe os cards + titulo de cada plano de ação criado no "metas"

ao clicar leva para a aba metas e abre o modal do card clicado


**core**

- supabase
A tabela chama-se plans_action. (Lá ficam guardadas as configurações do plano como plan_id, name, desc, photo_url, etc).

- function
No Core: A classe responsável por gerenciar isso se chama PlansActionController. A função que lista os planos e manda para o dashboard é a list (chamada via rota GET /api/plans_action).

No Frontend (Dashboard): A função responsável por desenhar visualmente esses planos em formato de grid dentro do card chama-se renderDashGoals(). Ela injeta os dados na div que possui o ID dashGoalsGrid (que fica dentro do card com ID dashGoalsCard).



# Estimativa de vida
**frontend**

- req idade
media maxima que o propio app coloca é de 98 anos

aqui a intencao é coletar a data de nascimento do usuario

**core**

- rate limit
Idade Mínima: 14 anos
Idade Máxima: 70 anos

- supabase
salva na tabela users, especificamente na coluna nascimento

- function
A função principal responsável por fazer o cálculo do tempo de vida, semanas restantes e gerar a barra de progresso visual é a renderDashLifeInsight() (dentro do dashboard.html).



# Frases para viver
**frontend**

- Cards
31 cards = max 50 = min 0


- +add
max 200 caracteres = min 10 caracteres

""Frases para Viver" não estão em nenhuma tabela do Supabase atualmente.

Elas estão fixas (hardcoded) diretamente no código do frontend, no arquivo pages/dashboard.html dentro de um array Javascript chamado DEFAULT_MOTIV."


**core**

- function
getMotivPhrases(): Lê as frases do armazenamento local ou carrega as opções padrão.
dashRotatePhrase(): É a função chamada quando você clica em "↻ outra", responsável por girar a roleta de frases e exibir a próxima.
renderDashPhrase(): A função interna que injeta a frase correta na div de ID dashMotivPhrase quando a página carrega.

por enquanto nao existe por que nao da para adicionar
