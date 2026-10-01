# Dieta
**frontend**

- Button "configurar" 
nome da dieta === min 3 e max 30 caracteres = sem caracteres especiais, nao pode ser igual a outra dieta = max 7 dietas

- Button "tres linhas horizontais"
+adicionar refeição === min 2 e max 8 refs por dieta
apagar dieta === tem certeza = apagar / cancelar = ou esc e enter

card da ref:
nome da ref === min 3 e max 30 caracteres = sem caracteres especiais = nao pode ser igual a outra ref
horario === o horario definido vai fazer a dieta expandir
nome do alimento === min 3 e max 30 caracteres = sem caracteres especiais 
gramas === min 1g e max 999g
+adicionar alimento === max 22 alimentos e min 1 alimento
macros === (kcal, prot, carb, gord)
limit, if kcal for menor que 0 ou maior que 9000 kcal retorna erro
prot menor que 0g ou maior que 600g retorna erro
carb menor que 0g ou maior que 1000g retorna erro
gord menor que 0g ou maior que 500g retorna erro


**core**

- supabase
Tabela health_settings (Onde a Dieta fica)
Esta é a tabela principal para armazenar as configurações do usuário. Em vez de ter múltiplas tabelas para dietas, refeições e alimentos separadamente, o aplicativo usa a flexibilidade do PostgreSQL com JSONB.

Coluna diet_config (JSONB): Guarda toda a árvore estrutural da dieta. É aqui dentro que as suas dietas, refeições, lista de alimentos e horários ficam aninhados em formato JSON.
Coluna water_goal: Salva a meta de água diária (agora em ml).
Coluna weight_goal: Salva a meta de peso (em kg).
Coluna workout_weeks: Salva os esquemas e dias de treino.

abela health_logs (Onde o Histórico fica)
Esta tabela é usada para registrar o "dia a dia" (ações contínuas e repetitivas).

Quando você clica em "+ Adicionar Água" ou "+ Registrar Peso", os dados vão para cá.
Coluna tipo: Define o que é esse registro ('agua', 'peso', 'treino').
Coluna dados_json: Guarda o valor flexível daquele log (ex: {"quantidade": 2500} para água ou {"peso": 75.5} para a balança).
Coluna data: O dia que o log foi registrado.
Resumindo: A sua dieta em si (nomes das refeições, gramas e calorias dos alimentos) está toda salva num objeto JSON gigante dentro da coluna diet_config da tabela health_settings!

Se precisar editar os dados brutos no painel do Supabase, você só precisa ir na tabela health_settings, pegar a linha correspondente ao seu user_id e olhar o campo diet_config.

- rate limit
Estrutura Geral:

Dietas: Limite máximo de 7 dietas criadas.
Refeições: Cada dieta deve ter entre 2 e 8 refeições.
Alimentos: Cada refeição deve ter no mínimo 1 e no máximo 22 alimentos.

Nomes e Textos:

Nome da Dieta / Refeição / Alimento: O tamanho precisa ter entre 3 e 30 caracteres.
Segurança (Anti-injeção e Sujeira): Os 3 tipos de nomes bloqueiam caracteres especiais (só aceitam letras, incluindo acentos, números e espaços).
Duplicidade: O backend barra se tentar criar uma Dieta com nome igual a outra Dieta, ou uma Refeição com o nome de outra já existente naquela mesma dieta.

Valores Nutricionais (Macros e Gramas):

Gramas (por alimento): Só pode ser entre 1g e 999g.
Calorias (Kcal) da refeição: Entre 0 e 9000 kcal.
Proteínas (Prot) da refeição: Entre 0g e 600g.
Carboidratos (Carb) da refeição: Entre 0g e 1000g.
Gorduras (Gord) da refeição: Entre 0g e 500g.
Se a interface frontend tentar falhar, der erro, for burlada ou alguém tentar forçar um POST manual pra sua API que desrespeite qualquer uma dessas regrinhas, o servidor aborta a operação inteira e retorna erro 400 (Bad Request) recusando a injeção dos dados no banco.


# Hidratação
**frontend**

- +adicionar
adicionaar agua === min 50ml e max 1000ml

- meta diaria
meta diarias === min 1000ml e max 8000ml


**core**

- supabase
A Meta Diária (Tabela health_settings)
Quando você clica na meta de água e digita 2000ml, ela vai para a tabela health_settings.


Coluna water_goal: É aqui que o backend grava esse número (agora em mililitros).
Assim como a Dieta, fica atrelado ao seu user_id, sendo uma configuração global sua (não importa o dia que você abra, a meta vai carregar daqui).

O Consumo do Dia (Tabela health_logs)
Quando você clica em "+ Adicionar" e informa que bebeu mais 250ml, o aplicativo vai para a tabela health_logs (a tabela do "histórico") registrar essa evolução.

Coluna tipo: Fica marcada como 'agua'.
Coluna data: O dia exato em que você bebeu (ex: 2026-08-24).
Coluna dados_json: O backend guarda a quantidade total do dia aqui dentro, no formato {"quantidade": 2250}.
Como o backend faz a mágica de somar a água? Sempre que você manda 250ml para o servidor (via botão Adicionar), o backend olha na tabela health_logs, acha a linha do tipo 'agua' com a data de hoje. Ele pega o JSON, vê quanto você já tinha bebido (ex: 2000), vê que você tentou adicionar os 250ml permitidos, soma tudo e atualiza (faz um Upsert) a linha de hoje colocando {"quantidade": 2250}!

Pode copiar lá pro seu saude.md na parte da Hidratação - Supabase!


- rate limit
Meta Diária de Água (health_settings)

A meta de água só pode ser salva se o número estiver entre 1000ml e 8000ml. Se o frontend enviar 900ml ou 9000ml, o servidor recusa.


Limite Máximo Diário (health_logs)

A soma total da água que você bebeu no dia (mesmo que você adicione de pouquinho em pouquinho) não pode ultrapassar 8000ml. O banco bloqueia qualquer soma que estoure esse limite.

Trava Anti-Fraude de Adição Diária (health_logs)

Lembra que você pediu para a adição ser "mínimo 50ml e máximo 1000ml"? O backend verifica isso de forma muito inteligente: antes de salvar, ele busca no banco de dados quanto você já tinha bebido hoje e faz a conta matemática para saber o tamanho do novo gole que está entrando na requisição.
Se a diferença (o tamanho do gole) for menor que 50ml ou maior que 1000ml, o backend joga o erro 400 Bad Request e aborta a adição.
Essa última regra é um escudo de proteção fortíssimo: significa que nem mesmo um script malicioso mandando dados diretos pra sua API consegue adicionar 2000ml de uma vez!


# Peso corporal
**frontend**

- +registrar
peso === min 40kg max 300kg
meta de peso === min 50kg e max 130kg

- historico
apenas visual

**core**

- supabase
A Meta de Peso (Tabela health_settings)
Quando você define que quer chegar aos 65kg, isso é salvo na tabela health_settings.

Coluna weight_goal: O backend grava a meta em quilos aqui. Como é uma configuração contínua, ela fica nessa tabela mestre junto com a meta de água e as configurações de dieta.

O Histórico de Peso (Tabela health_logs)
Sempre que você sobe na balança e clica em "+ Registrar", o aplicativo joga essa informação para a tabela health_logs (para ir montando o seu gráfico de evolução).

Coluna tipo: Fica marcada como 'peso'.
Coluna data: O dia do registro (ex: 2026-08-24).
Coluna dados_json: O backend armazena o peso daquele dia em formato JSON, ficando assim: {"peso": 70.5}.
Diferente da água (que o backend soma os goles), no caso do peso o backend cria ou substitui o registro do dia. Se você registrar 70kg de manhã e depois registrar 69kg à noite no mesmo dia, o Supabase descarta o antigo e mantém o mais recente (limitado a no máximo 2 edições por dia, para evitar spam no banco de dados).

- rate limit
Limite da Meta de Peso (health_settings)

Se uma requisição tentar salvar uma meta de peso menor que 50kg ou maior que 130kg, o backend devolve o erro 400 Bad Request na hora e não altera a configuração no banco.

Limites Biológicos do Registro de Peso (health_logs)

Ao receber o JSON de um novo peso registrado (ou atualizado) no dia, o servidor verifica se o número enviado faz sentido biológico para um humano usando o app.
Se o peso informado for menor que 40kg ou maior que 300kg, a requisição é abortada e nada é salvo no banco de dados.


Anti-Spam de Registros (health_logs)

Para evitar que algum script fique criando dezenas de marcações de peso no mesmo dia inflando o banco de dados, o backend faz uma contagem rápida na tabela.
Ele permite no máximo 2 registros de peso por dia (uma oscilação comum para quem pesa de manhã e à noite). Se a pessoa ou sistema tentar registrar o peso pela terceira vez no mesmo dia, o servidor barra com a mensagem "Limite atingido: máximo de 2 registros de peso por dia."