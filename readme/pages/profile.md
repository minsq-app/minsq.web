# Editar perfil
**frontend**

## Identidade

- nome de exibicao
min 2 e max 30 caracteres = 2 ou mais usuarios podem utilizar igual nao tem problema 

só pode no maximo 3x por semana ( o backend validar para nao passr de 3x por semana)

- username
min 3 e max 30 caracteres = cada usuario tem seu @ ou seja nao pode repetir igual e tem que ser UNIQUE, e pode trocar 1x por semana (validado por back)

lembrando que caso o usuario digite um @ que ja existe eu nao quero que ele tenha que clicar no salvar para saber se ta liberado o @ entao avise ele na hora se o @ pode ser usado

- bio
min é 0 caracteres ou seja é opcional usar a bio e o max é 100 caracteres (pode alterar no maximo 5x no mesmo dia, back deve validar isso e o front nao precisa avisar isso) 

- links sociais
aqui o limite max de caracteres é 100 caractres contando (https://www.com...) 

front nao precisa avisar somente o backeend valida o numero de caracteres e se é seguro

lembrando links como 
+18 ou jogos de azar nao sao permitidos e front deve avisar que fere os termos de boa conduta de uso e é passivo de banimento (temporario ou permanente) fora o aviso eu quero que o backend nao aceite esses links e valide o numero de caracteres

(pornhub.com, xvideos.com, fatalmodel.com, onlifans.com, privacy.com, xxx.com, ...
 bet365, blaze, sportingbet, ...)


## Aparência

- fundo da pagina
suporte a somente arquivos jpg, jpeg, png, webp e max 3mb, backend deve validar o tamanho, o formato(png...) e se o arquivo é uma imagem mesmo (nao aceite arquivos maliciosos), o front deve mostrar para o usuario quais formatos e tamanho de arquivo sao aceitos, deve avisar caso o usuario tente fazer upload de um arquivo que nao seja permitido

- efeito do cartao de perfil, modo kout e fonte de perifls
sao apenas visuais mas cuidado com exploradores de api que mandam varios coisas etc só aceite 1x de cada uma das opcoes que nos oferecemos


# foto de perfil
**frontend**

limite de no max 2mb formato jpg, jpeg, png, webp e o core deve validar se é uma imagem mesmo 


# seguidores e seguindo
**frontend**

usuario logado apenas vera, deixara de seguir, aceitara os pendentes, recusara os pendentes etc...

usuario externo que ta vendo o perfil de outro conseguira seguir ou deixar de seguir pelo botao do lado das redes, o usuario externo nao vera os pendentes 

perfis privados nao mostram quem segue ou quem seguem ele foto, nome, @ e bio e numero de seguidores sao mostrado ate no privado




# filtros (user, foco, estudos...)

**desativado na beta version**




# core

**seguranca**

1. Desativação e Exclusão de Contas (disableMe, deleteMe) ✅ Seguro: A API nunca confia apenas no token. Para desativar ou apagar uma conta, ela força o usuário a enviar a senha_atual no body da requisição, re-criptografa (suportando tanto o hash antigo quanto o novo Argon2) e só executa a exclusão se bater perfeitamente.

2. Listagem Pública (getPublicProfile) ✅ Seguro: Existe uma função blindada chamada filterUserFields que restringe cirurgicamente o que é devolvido pro frontend. É impossível que dados sensíveis como senha, email, pwd_attempts ou stripe_customer_id vazem no JSON do perfil, mesmo se um bot escanear.

3. Sessões e Segurança de Login ✅ Seguro: Quando a pessoa troca a senha ou desativa a conta, a API roda comandos como revoke_all_sessions, deslogando forçadamente todos os outros computadores e celulares conectados àquela conta.

4. Rate Limiting (Proteção contra Bots) ✅ Seguro: As rotas possuem limitadores agressivos e inteligentes, como o publicProfileLimiter (máximo de 60 visualizações de perfil por IP em 10 minutos) e o followActionLimiter (máximo de 40 clicks em "seguir" em 10 min), o que impede completamente ataques de força bruta, spam de seguidores e Data Scraping.

5. Sistema de Customização (O que acabamos de blindar) ✅ Seguro: Com os limites aplicados na nossa última alteração, fechamos a única porta que estava meio aberta. Nenhum explorador consegue sobrecarregar o banco ou fazer ataques de XSS (Cross-Site Scripting) injetando HTML nos estados/cidades ou CSS nas bordas.



 1. Identidade e Textos (Anti-Spam e Anti-Exploit)
Nome de Exibição (nome):
Tamanho Restrito: Rejeita qualquer envio com menos de 2 ou mais de 30 caracteres.
Rate Limit Específico: Travado no banco para aceitar no máximo 3 alterações por semana por usuário.
Username (handle):
Regra de Formato: Só aceita de 3 a 30 caracteres, e uma Regex rigorosa (/^[a-z0-9_]{3,30}$/) bloqueia qualquer caractere especial, forçando padrão alfanumérico ou underline.
Concorrência (UNIQUE): Antes de salvar, busca no banco. Se o @ já for de outra pessoa, bloqueia a transação imediatamente.
Rate Limit Específico: Travado para permitir apenas 1 alteração por semana.
Validação em Tempo Real: Rota dedicada (/api/users/check-handle) permite ao frontend consultar a disponibilidade instantânea do @ sem precisar salvar.
Bio (bio):
Tamanho Restrito: Limite absoluto de 100 caracteres.
Rate Limit Específico: Travado para aceitar no máximo 5 alterações no mesmo dia.
Estado, Cidade e Gênero (Anti-XSS):
Tamanho Restrito: Máximo de 50 caracteres (20 para gênero).
Filtro HTML: Apaga automaticamente os símbolos < e >, incapacitando 100% ataques de injeção de scripts (XSS).

 2. Links Sociais e Termos de Uso (Anti-NSFW / Apostas)
Tamanho Restrito: Limite global de 100 caracteres por link.
Deep Firewall de Domínios (checkBannedLinks):
Qualquer tentativa de adicionar sites +18 (Pornhub, Xvideos, Fatalmodel, Privacy, Onlyfans, etc) é interceptada.
Qualquer tentativa de adicionar cassinos/apostas (Bet365, Blaze, Sportingbet, Vaidebet, etc) é derrubada.
A API tenta quebrar a URL e olhar diretamente para o "hostname" (domínio real), então os usuários não conseguem burlar colocando https:// ou www. na frente. Se cair no filtro, retorna erro.

 3. Aparência e Customização (Anti-Injeção CSS/JSON)
Listas Brancas (Enums Estritos): O backend tem arrays fixos de "fontes válidas", "kouts válidos" e "estilos de fundo". Se um hacker interceptar a requisição e mandar o valor hack_font, a API descarta, pois não está na lista oficial de opções oferecidas.
Limpeza de Bordas e Temas: Campos como avatar_border e profile_theme passam por uma Regex que apaga tudo que não for alfanumérico ou hífen/underline. Impede injeção de propriedades CSS no seu frontend.
Travas Matemáticas: Opacidades não aceitam strings. O backend converte para Float e só aceita números entre 0.0 e 1.0.
Tamanho do JSON: O campo de customização extra recusa pacotes maiores que ~150KB para impedir estouro de memória no banco.

 4. Imagens (Foto de Perfil e Fundo)
Limites de Peso Absolutos: A verificação acontece direto no backend antes de salvar o arquivo.
avatars (Foto de Perfil): Travado no máximo absoluto de 2MB.
pagebgs (Fundo): Travado no máximo absoluto de 3MB.
Anti-Vírus (Magic Bytes): Não basta o arquivo terminar em .png. O backend lê a assinatura hexadecimal interna (cabeçalho binário) do arquivo. Se um mal-intencionado pegar um vírus .exe e renomear para foto.jpg, o backend detecta a fraude e derruba o upload.
Formatos Fixos: Rejeita qualquer coisa fora do escopo JPG, JPEG, PNG e WEBP.

 5. Seguidores e Privacidade (Controle de Acesso)
Mecânica de Estado Único: Todo "Follow" vai para uma única tabela extremamente leve, mudando apenas de pending para accepted. Isso salva processamento do servidor.
Contadores em Cache (Triggers): A contagem de seguidores não é calculada ao vivo. Ao abrir um perfil, a API puxa um número pre-calculado, aguentando tráfego altíssimo sem travar o Supabase.
Isolamento de Contas Privadas:
Se o usuário for privado, a API de "Follow" ignora qualquer comando forçado e carimba o status como pending.
A API de "Listar Seguidores" checa ativamente: "O perfil é privado? Você não é o dono e não é um seguidor aceito? Então Toma um Erro 403 (Proibido)".
Ocultação de Pendências: Apenas o ID dono do Token (logado) consegue fazer a query na API para listar as solicitações pending recebidas.

 6. Rate Limiters Globais da Rota de Perfis
apiLimiter: Máximo de 300 requests genéricos a cada 10 min.
publicProfileLimiter: Máximo de 60 visitas a perfis por IP a cada 10 minutos (Impede bots de copiarem os dados dos seus usuários em massa - Web Scraping).
followActionLimiter: Máximo de 40 ações de seguir/deixar de seguir a cada 10 minutos (Impede bots de inflarem artificialmente números de seguidores).
apiExplorerLimiter: Bane temporariamente IPs que ficam batendo em rotas que não existem tentando achar vulnerabilidades.


**supabase**

1. Tabela users (Onde mora a Identidade e a Aparência)
Esta é a tabela principal. O Supabase guarda nela todos os dados do formulário de edição e os limites de tempo.

Colunas de Identidade:

id (UUID) - O identificador único oculto do usuário.
nome (Texto) - O Nome de exibição.
handle (Texto) - O Username (@). O Supabase impõe a trava de UNIQUE aqui direto no banco. Se dois usuários tentarem pegar o mesmo @ no mesmo milissegundo, o próprio banco rejeita.
bio (Texto) - A biografia do usuário.
social1 e social2 (Texto) - Os links sociais limpos e aprovados pela API.
Colunas de Travamento de Tempo (Rate Limits em Banco): Para garantir os limites de alteração semanais/diários, o banco guarda metadados silenciosos:

nome_count (Número) e nome_week (Texto) - Conta quantas vezes trocou o nome na semana.
handle_week (Texto) - Marca a semana da última troca de @.
bio_count (Número) e bio_day (Texto) - Conta quantas vezes trocou a bio hoje.
Colunas de Aparência (Customização):

avatar e avatar_type (Texto) - A URL oficial da foto (que passou pelo limite de 2MB) e se é imagem ou gif.
avatar_border (Texto) - O estilo da borda escolhido.
profile_page_bg e profile_page_bg_img (Texto) - O estilo de fundo e a URL do fundo (3MB limit).
profile_theme, profile_kout, profile_font, profile_bg (Texto) - As escolhas visuais do cartão, todas tratadas e higienizadas.
profile_bg_opacity e profile_page_bg_opacity (Float) - A transparência matemática (0.0 a 1.0).
Colunas de Privacidade e Contagem Rápida:

perfil_publico (Booleano) - Guarda true ou false para decidir se a conta é aberta ou trancada.
seguidores_count e seguindo_count (Número) - O "Ouro" da performance. O banco guarda o número total aqui para a página carregar em 1 milissegundo, sem precisar recalcular nada.


2. Tabela follows (O Motor Social)
Esta é a tabela de junção (Relacional). Ela só existe para conectar uma pessoa à outra de forma performática.

Estrutura:

follower_id (UUID) - ID de quem apertou o botão seguir.
followed_id (UUID) - ID de quem está sendo seguido.
status (Texto) - A coluna mágica! Aceita única e exclusivamente a palavra 'accepted' ou 'pending' (Graças a uma regra CHECK embutida no Supabase).
criado_em (Timestamp) - Quando a solicitação ou o follow aconteceu.
Travas Nativas (Constraints):

Chave Primária Composta: O Supabase impede matematicamente que o Usuário A siga o Usuário B duas vezes. A tabela só aceita um único registro daquela combinação de IDs.
no_self_follow: Uma trava direta no Supabase que impede que o banco aceite uma instrução onde follower_id seja igual ao followed_id (Não dá para seguir a si mesmo).


3. Automações do Banco (Functions & Triggers)
Para evitar que sua API e seu servidor Node.js fiquem sobrecarregados, o próprio Supabase roda um script invisível sempre que alguém segue alguém:

A Função fn_follows_sync_counters: Toda vez que a tabela follows sofre um INSERT (novo seguidor), um UPDATE (pedido pending aprovado) ou um DELETE (deixou de seguir), esse gatilho do Supabase atualiza instantaneamente e silenciosamente os números de seguidores_count e seguindo_count lá na tabela users.
Resumo: O seu Supabase não guarda imagens (as imagens vão para o Storage de arquivos (S3/Buckets) e apenas a URL em texto vem para a tabela users). Todo o resto é composto por textos curtos, UUIDs e numerais, o que faz a sua conta de consumo do banco de dados ser microscópica, operando com máxima eficiência.

