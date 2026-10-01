# Meta diaria
**frontend**

- hora e min
(minimo 0 e max 18h)


**core**

- supabase 
A Meta Diária (junto com os tempos personalizados do seu timer e suas estatísticas de longo prazo) fica salva na tabela study_settings.

Dentro dessa tabela no Supabase, a meta de horas é gravada especificamente na coluna daily_goal_min. Como o próprio nome da coluna diz, ela converte e salva a meta sempre em minutos inteiros no banco de dados (por exemplo, se você colocar 2h, ele salva o número 120).

Lembrando que essa linha na tabela também é única e exclusiva por usuário (protegida pela coluna user_id), então só existe um registro ativo de configurações por pessoa!

- rate limit
Trava Mínima/Máxima: O backend rejeita qualquer meta diária (daily_goal_min) que seja inferior a 20 minutos ou superior a 1080 minutos (exatas 18 horas).

Sanitização de Tipo: Bloqueia strings inválidas, texto puro e valores negativos de meta.
Proteção de Estatísticas: Os atributos agregados do usuário (como total de horas de vida, recorde do melhor dia e pomodoros no dia) possuem barreira anti-negativo, impedindo que requisições forjem dados para diminuir os totais ou colocar números que quebrem a estatística.



# Timer de foco
**frontend**

- 25 pomodoro
25 min de foco = 5 min de descanso a cada ciclo = apos 4 ciclos 15-30min descanso

- 50 deep focus
50min de concetracao ininterrupta = e 15 a 25 min de descanso a cada ciclo

- custom
nome do tempo === min 2 e max 36 caracteres = sem especial
foco === H : M = max 4h e min 30min
descanso === M = min 5 min e max 50min


- selecao de materia
seleciono apenas as materias criadas no card materias

- start
pause = cancelar(tem certeza) = finalizar = nao é possivel finalizar com menos de 20min de foco passado = >20 salva no sessoes recentes


**core**

- supabase 
Tabela: study_settings
Os modos personalizados do timer (seu nome, minutos de foco e de descanso) e suas estatísticas do timer não ficam em uma tabela separada. Eles são salvos junto com a Meta Diária dentro da mesma tabela study_settings.
Coluna: lifetime_stats

O Supabase usa essa coluna como um formato JSON flexível. Dentro do JSON lifetime_stats, os seus timers ficam guardados no formato de um array chamado custom_modes (Ex: [{ name: "Foco Pessoal", focusMin: 30, restMin: 5 }]). Tudo isso agrupado pela coluna de proteção user_id.

- rate limit
Como o cronômetro sincroniza o progresso diretamente no study_plans ao pausar/marcar tópicos, a rota do backend atua como um tanque de guerra contra corrupção dos dados de estudo:

Limite de Módulos: Bloqueia absolutamente qualquer array que ultrapasse 30 módulos de estudo.
Limite de Tópicos: Se dentro de um módulo o array de tarefas (tasks) ultrapassar 20 itens, a requisição é negada.
Limpeza de Títulos e Tópicos: O backend recalcula o tamanho cortando espaços invisíveis (trim).
Trava de Caracteres Módulo: Título do módulo forçado a ficar entre 3 e 58 caracteres.
Trava de Caracteres Tópico: Descrição do tópico forçada entre 3 e 58 caracteres.
Blindagem Regex Anti-Especial: O título do módulo aceita letras, números, espaços, hífen, underscore, ponto, vírgula, dois-pontos, ponto-e-vírgula, exclação, interrogação, ordinais (ºª°) e parênteses `()`. O tópico aceita os mesmos, exceto parênteses. Emojis, @, #, $, %, &, *, {} e similares são destruídos.
Integridade Atômica: Se a lista de estudo tiver 29 módulos perfeitos e 1 tópico corrompido ou acima do limite de caracteres, o backend derruba o salvamento inteiro.


# Sessoes recentes
**frontend**

salva o automaticamente 
nao é possivel excluir e nem editar 
salva o nome da materia = tempo de estudo = tempo total passado = data


**core**

- supabase
Tabela: study_sessions
Cada sessão que atinge os 20 minutos vira uma linha individual (um registro único) nesta tabela, protegida pela coluna user_id.

Colunas estruturais:

titulo: Salva a descrição (caso não tenha descrição, cai no padrão "Foco").
duracao_min: Salva apenas o tempo de foco contínuo convertido em número inteiro (ex: 25).
categoria: Salva o nome da matéria exata que estava selecionada.
data: Salva o dia da sessão, usando formato internacional para padronização no banco (YYYY-MM-DD).
criado_em: Grava automaticamente e exatemente o segundo em que a sessão foi inserida no banco pelo timer, o que é usado para ordená-las da mais nova para a mais antiga.

- rate limit
Barreira de Tempo: A API bloqueia e recusa salvar no banco de dados qualquer sessão de foco que não tenha atingido pelo menos 20 minutos completos (evita poluição da database com cliques acidentais). O máximo permitido é de 1080 min (18h) contínuos.
Obrigatoriedade de Categoria: Rejeita requisições se a sessão não estiver linkada ao nome de uma matéria (não pode ser vazia).
Imutabilidade Absoluta (A principal): O backend foi construído sem rotas de DELETE ou UPDATE para o controlador de sessões. Uma sessão gravada não pode ser hackeada, apagada nem maquiada. Ela entra no banco de dados e fica selada de forma definitiva.
Trava de Excesso Diário: (Proteção Anti-Spam) O backend roda uma subquery de contagem. Se o usuário já possuir 3 sessões grandes registradas no mesmo dia, a API devolve um Erro 400 avisando que o limite diário de sessões no histórico foi atingido, não salvando a quarta.


# Anotacoes
**frontend**

- +nota
cria uma nota sem nada e abre automaticamente, se a nota continuar vazia e ou nao preecher os requisitos a baixo ela nao sera salva
materia/contexto === min 3 e max 25 caracteres = sem caracter especial
anotacao === min 4 e max 500 caracteres

limit: maximo 15 notas

- modal "nota criada"
apagar === tem certeza = apagar/cancelar ou esc/enter
titulo (materia/contexto) e anotacao é a mesma regra de limite de caracteres do +nota


**core**

- supabase
Tabela: study_notes
Assim como as sessões, cada nota cria um registro (linha) individual e exclusivo daquele usuário (user_id).
Colunas estruturais:
note_id: Um código único gerado para identificar e evitar duplicidade naquela nota exata.
subject: Onde vai o nome da matéria/contexto (título).
content: Onde vai o corpo da anotação (descrição).
criado_em e editado_em: Datas/Horas (timestamps) de quando você abriu a nota e quando foi a sua última modificação para ordenar na interface.

- rate limit
Teto do plano: Antes de gravar qualquer nota nova, a API faz um .count() no Supabase. Se houver 15 anotações ativas, a requisição é interceptada e bloqueada, obrigando a exclusão de anotações antigas.
Blindagem de Assunto (Contexto): Exige no mínimo 3 e no máximo 25 caracteres. Possui regex /[^a-zA-Z0-9À-ÿ ]/ para rejeitar especiais e também bloqueia [\r\n] (evitando injeção de quebra de linhas maliciosas no título do card).
Blindagem de Corpo de Texto: Exige no mínimo 4 caracteres e trava duramente no limite máximo absoluto de 500 caracteres, bloqueando anotações bíblicas que possam inflar o consumo do banco.


# Materias
**frontend**

- +nova 
nome da materia === min 2 max 38 = sem caracteres especiais = nao pode ser igual a outra materia
upload === apenas png, jpg, jpeg, e webp = max 2mb

limite === 16 materias max

- modal "materia criada"
ordenar/em processo === autoexplicativo = apenas visual
novo modulo === titulo do modulo = min 3 e max 58 = aceita: letras, números, ponto, dois-pontos, vírgula, !, ?, º/ª, () e / = apagar = sim/nao ou esc/enter
+topico === titulo === min 3 e max 58 caracteres = aceita: letras, números, ponto, dois-pontos, vírgula, !, ?, º/ª, (), /, [], {}, <>, ^ e ~ = apagar = sim/nao ou esc/enter = atalho: enter cria mais um topico

comportamento ao fechar modal === ao fechar o modal, nenhum dado é enviado ao backend automaticamente. o usuário deve clicar no botão salvar explicitamente

botao salvar === aparece somente quando ha alteracoes nao salvas (dirty state) = fica ao lado do botao ordenar = ao clicar, forca blur em qualquer input ativo, limpa modulos e topicos vazios, envia para o backend e some depois do sucesso

limites === 30 modulos por materia
            20 topicos por modulo




**core**

- supabase
Nesta arquitetura, a matéria e o que tem dentro dela foram divididos no Supabase em duas tabelas diferentes por questão de performance e segurança:

I. A capa da matéria:

Tabela: study_tracks
Salva estritamente a "casca" (o card) da matéria na tela principal.
Colunas estruturais:
track_id: O ID único desta matéria.
name: O título da matéria (ex: Biologia).
icon: O arquivo de capa salvo em formato de texto longo (base64).
description: Subtítulo descritivo.

II. O conteúdo da matéria (Módulos e Tópicos):

Tabela: study_plans
É a tabela que faz o "Planner" e o timer operarem. Ela possui a coluna de chave track_id que lida com a conexão: se uma matéria for apagada em study_tracks, tudo no study_plans que tiver o mesmo track_id é deletado em cascata.
Coluna estrutural principal: modules (Formato JSON).
Em vez de criar 30 linhas para módulos e centenas de linhas para tópicos, o banco de dados guarda toda a sua lista de estudo em um único objeto de texto JSON de alta velocidade na coluna modules. Toda vez que você altera um título de tópico ou o timer dá um check "✓" na tarefa, ele atualiza diretamente o valor dentro desse JSON.

- rate limit
Teto Máximo: Barreira igual a das notas. Conta e bloqueia no limite de 16 matérias criadas.
Validação Anti-Duplicidade Dinâmica: Antes de salvar, a API procura (ilike case-insensitive) em todo o banco do usuário se já existe alguma matéria criada com aquele mesmo nome exato. Se houver, a criação ou edição sofre bloqueio de "Duplicidade de Matéria".
Comprimento de Nome: Restrito ao corredor estrito de 2 a 38 caracteres.
Sanitização de Nome: Passa na mesma restrição severa de caracteres especiais (impede SQL Injection e quebra de grid). Se tiver descrição na matéria, a descrição fica cravada em 25 caracteres máximos.
Blindagem Pesada de Upload: Quando o frontend tenta subir o "ícone" ou "imagem" da matéria em formato base64:
O servidor varre a string e destrói a requisição se ela não iniciar perfeitamente com a tag data:image/png, data:image/jpeg ou data:image/webp (recusa PDFs, .exe e malwares).
O servidor mede o comprimento inteiro do arquivo gerado e usa a barreira de 2.800.000 caracteres da string base64 para fechar a porta na cara de arquivos cuja imagem original possuísse mais de 2 Megabytes. Não tem como engasgar o servidor com uploads massivos.

# Alterações Recentes (Sessões de UI/UX)

- **Persistência de Scroll no Modal de Módulos:** Adicionada lógica nativa para salvar e restaurar instantaneamente a posição de rolagem (`scrollTop`) do container durante recriações de DOM (como apagar ou criar tópicos), neutralizando qualquer salto abrupto para o topo ou efeito visual de "piscada".
- **Validação Relaxada de Caracteres Especiais:** 
  - A barra inclinada (`/`) e os parênteses `()` agora são permitidos na estrutura primária dos Módulos.
  - Os caracteres especiais `[]`, `{}`, `<>`, `^` e `~` tiveram restrições suspensas exclusivamente para o uso interno de Tópicos. A regra segue rigorosa no backend (API Zod Schema) mas com esses escapes liberados.
- **Proporção Visual do Modal:** Ajuste de área útil. A altura de expansão máxima da janela interna de tópicos foi encurtada de `70vh` para `64vh`, melhorando a proporção respirável na janela do navegador.
- **Amortecimento de Scroll Wheel:** Uma escuta (`eventListener('wheel')`) foi pendurada estritamente no container de matérias. Ela capta o input mecânico de rolagem do usuário e amortece forçadamente sua velocidade para 40% da original, melhorando a mira de leitura dentro da matéria.
- **Refatorações do Planner no Timer de Foco:**
  - Inserido suporte a colapso e expansão em tempo real de módulos dentro de uma sessão ativa através de cliques limpos no cabeçalho.
  - Removidos falsos positivos de digitação: clique nos títulos de módulo sofrem `pointer-events: none` para impedir cursores piscantes que sugerissem edição bloqueada.
  - **Fim da Retração Indesejada:** A atualização da barra de progresso (ex: "2/5 tópicos concluídos") operava destruindo a view anterior e chamando um rebuild limpo baseado no banco de dados, o que resetava a abertura dos módulos para "fechados". Substituído por injeção direta via DOM manipulation no texto e nas marcações, isolando a visualização e impedindo o módulo de retrair sozinho.
