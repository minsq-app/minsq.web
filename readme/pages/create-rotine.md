# Criar Rotina
**frontend**

- titulo da rotina
nome === min 3 e max 46 caracteres

- guardar rotina
salva a rotina  após validar se todos os limites foram cumpridos


- exercicio personalizado
nome === min 3 e max 46 caracteres
tipo de exercicio === selecionar apenas um dentre os apresentados = banco só salva se for um tipo válido
adicionar foto === min 9kb e max 1mb = formato png, jpg, webp
grupo muscular === backend valida o maximo é 3 

limit === max 8 exercicios personalizados 

se tudo estiver correto cria o exercicio personalizado e fica visivel no "todos exercicios" e "buscar exercicios"

- filtro
-Cardio
-Pescoço
-Pescoço (Flexores)
-Pescoço (Extensores)
-Trapézio
-Trapézio Superior
-Trapézio Médio
-Trapézio Inferior
-Peito
-Peito Superior
-Peito Médio
-Peito Inferior
-Ombro
-Ombro Anterior
-Ombro Medial
-Ombro Posterior
-Bíceps
-Bíceps Cabeça Longa
-Bíceps Cabeça Curta
-Braquial
-Braquiorradial
-Tríceps
-Tríceps Cabeça Longa
-Tríceps Cabeça Lateral
-Tríceps Cabeça Medial
-Antebraço
-Antebraço Flexores
-Antebraço Extensores
-Costas
-Latíssimo do Dorso
-Redondo Maior
-Redondo Menor
-Romboides
-Eretores da Espinha
-Abdômen
-Reto Abdominal Superior
-Reto Abdominal Inferior
-Transverso Abdominal
-Lombar
-Lombar (Eretores)
-Quadrado Lombar
-Glúteos
-Glúteo Máximo
-Glúteo Médio
-Glúteo Mínimo
-Quadríceps
-Reto Femoral
-Vasto Lateral
-Vasto Medial
-Vasto Intermédio
-Posterior de Coxa
-Bíceps Femoral
-Semitendíneo
-Semimembranáceo
-Adutores
-Adutor Longo
-Adutor Curto
-Adutor Magno
-Grácil
-Abdutores
-Tensor da Fáscia Lata
-Glúteo Médio (Abdutor)
-Panturrilha
-Gastrocnêmio Medial
-Gastrocnêmio Lateral
-Sóleo

- buscar exercicios
limit === max 100 caracteres limitado no front 

- todos exercicios
on click === cria o card ao lado do exercicio = um clique cria se der outro click tira = limit nao pode adicionar um exercicio 2 vezes limitado por front e back

limit === max 12 exercicios na rotina 


- card do exercicio selecionado
nota === max 90 caracteres
temporizador de descanso === backend só aceita formatos validos de segundos e minutos que esta na lista
serie === aquecimento, normal, falha = banco só aceita um desses tipos
kg === max 600kg 
reps === max 200 reps
duracao === no max 18 horas
velocidade === no max 30
rpm medio === no max 40
adicionar series === max 10 series por exercicio

- exericios diferentes
1. Apenas Repetições (Sem Carga/KG)
Aparece apenas o campo "REPS"

Sissy Squat Unilateral com Assistência
Hiperextensão Lombar
Band Pullaparts
Aberturas no TRX
Flexão na Handstand
Muscle Up
Fundos nas Argolas
Ring Pull Up
2. Apenas Duração
Aparece apenas o campo "DURAÇÃO" (ex: 00:30)

Prancha Abdominal
Pular Corda
Boxe (Cardio)
3. Carga (KG) + Duração
Usado para exercícios de isometria com carga extra

Pendurado na Barra com Peso
4. Velocidade + Duração
Usado para as máquinas focadas no ritmo de passada

Esteira (Cardio)
Simulador de Escadas (Cardio)
5. RPM Médio + Duração
Usado para registrar cadência de pedalada

Bicicleta (Cardio)


**core**

- supabase

1. Tabela foco_routines
Esta é a tabela principal que armazena a rotina final montada pelo usuário.

Operações que faz:
SELECT (Count): Antes de salvar, conta quantas rotinas o usuário tem para barrar se passar de 24.
INSERT: Salva a rotina inteira caso passe nos testes de validação.
Colunas utilizadas:
user_id: Usado em todas as queries para garantir o isolamento (Row Level Security).
name: String com o nome da rotina (ex: "Treino A").
duration_min: Número inteiro (soma do tempo estimado da rotina).
folder_id: UUID (Opcional, caso o usuário crie a rotina dentro de uma pasta).
exercises: JSONB. É aqui que a mágica acontece. O banco salva todos os 12 exercícios, com suas anotações, temporizadores de descanso e o array de até 10 séries (com kg, reps, duração, rpm, tipo) num único pacote JSON super leve.

2. Tabela foco_custom_exercises
Esta é a tabela que acabamos de criar para gerenciar os exercícios que não existem nativamente no aplicativo e que o usuário cria via modal.

Operações que faz:
SELECT (Count): Conta se o usuário já atingiu o limite de 8 exercícios criados.
INSERT: Salva os dados e a imagem (limitada a 1mb) do exercício novo.
Colunas utilizadas:
user_id: Vinculado ao criador (ninguém vê o exercício personalizado do outro).
name: O nome que ele deu.
type: A categoria do exercício (ex: "Repetição + peso").
muscles: Array em texto com até 3 músculos alvo.
photo_base64: String de texto longa com a foto codificada.

3. Tabela foco_folders (Referência)
A página de Criar Rotina não cria ou deleta pastas, mas ela lê (folder_id) para saber se a rotina que está sendo salva deve ser guardada avulsa ou dentro de uma pasta específica que o usuário abriu.
Resumo da Ópera: Todo o sistema de Criar Rotina é extremamente enxuto no banco de dados. Ele não fica criando dezenas de tabelas de "séries" ou "ligações". Toda a complexidade estrutural de um treino fica encapsulada num JSON na coluna exercises da tabela foco_routines, o que deixa o seu banco ultra-rápido e barato de manter!


- rate limit

Proteções Globais de API e Banco
Autenticação Obrigatória: Nenhuma rota funciona se não tiver um token JWT válido de usuário logado (Tenant Isolation / RLS ativo em todas as tabelas).
Anti-Spam de Rotinas (Database Limit): O usuário pode ter no máximo 24 rotinas criadas. O servidor barra a criação da 25ª, evitando que alguém lote o banco.
Anti-Spam de Exercícios (Database Limit): O limite absoluto é de 8 exercícios personalizados criados por usuário.


Proteções do Card da Rotina (createRoutine)
Nome da Rotina: Bloqueia nomes vazios, menores que 3 ou maiores que 46 caracteres.
Payload Vazio: A API retorna erro se o array de exercícios chegar vazio.
Limite de Exercícios: O backend quebra a requisição se o array enviado tiver mais de 12 exercícios.
Prevenção de Duplicatas: O backend varre o array de exercícios; se o usuário enviar dois exercícios com o mesmo nome na mesma rotina, ele bloqueia (impede bugs no front-end).

Proteções Internas de cada Exercício e Séries
Anotações (Notas): Limite máximo rígido de 90 caracteres por nota.
Temporizador de Descanso: O backend tem uma "Whitelist" (lista branca). Ele só aceita valores exatos como Desligado, 00:05, 01:30, etc. Se tentarem injetar um texto malicioso aí, o servidor recusa.
Limite de Séries: Absolutamente máximo de 10 séries por exercício.
Tipos de Série: Apenas as palavras warmup, normal ou failure entram no banco.
Carga e Repetição (Sanity Check):
Peso (KG) máximo de 600.
Repetições máximas de 200.
Cardio e Duração (Sanity Check):
Velocidade: Máximo de 30.
RPM: Máximo de 40.
Duração (Tempo): Máximo de 18 horas de cálculo (1080 minutos).


Proteções de Exercício Personalizado (createCustomExercise)
Nome: Min 3, Max 46 caracteres.
Tipo Fake: Validação estrita. O servidor não aceita tipos inventados, apenas os 6 definidos no seu HTML (ex: 'Repetição + peso', 'Duração').
Flood de Músculos: Bloqueia se o usuário tentar atrelar mais de 3 grupos musculares.
Barreira de Upload de Imagem (Anti-Malware e Storage):
O backend lê o cabeçalho do Base64 para garantir que é uma IMAGEM REAL (image/png, image/jpeg, image/webp).
O servidor converte a string Base64 em bytes matematicamente para travar fotos com menos de 50kb (evitar pixels mortos) e maiores de 1MB (evitar estourar o banco de dados/banda larga).
