# Mail
**frontend**

-  campo de Mail
max 50 caracteres

aceita apenas emails com {
    @gmail.com
    @outlook.com
    @hotmail.com
    @live.com
    @icloud.com
    @yahoo.com
}

validado por front e backend nao aceita a req se nao tiver esses requisitos

if reqs.pass === true => proximo campo (no caso vai cair no confirm-account.html para confirmar se o email realmenbte exite)

- estrutura

se email passar pelo campo mail as 2 exigencias vai cair no confirm-account.html {
  se email for novo cairá no onboarding e depois cairá no app
  se email for já cadastrado cairá no app direto
}

**core**

- supabase

1. Tabela users
Esta é a tabela principal. O fluxo que o backend faz nela é o seguinte:

Busca (Select): Assim que a requisição chega, o backend procura na tabela users se já existe uma linha onde a coluna email seja igual ao e-mail digitado.
Se o usuário NÃO existe (Novo Usuário):
O backend cria (Insert) uma nova linha provisória para ele na tabela users.
Ele preenche o e-mail, gera um @handle automático e, o mais importante, salva o código de 6 dígitos gerado (criptografado) na coluna verification_code.
Ele define a coluna verification_code_expires_at (validade de 15 minutos) e deixa a coluna confirmado como false.
Se o usuário JÁ existe (Login/Recuperação):
O backend apenas atualiza (Update) a linha dele na tabela users.
Ele gera um novo código de 6 dígitos, salva em verification_code e atualiza a validade em verification_code_expires_at.
Resumo do fluxo de validação: Quando o usuário digita o código na tela seguinte (confirm-account.html), o backend volta na tabela users, compara o código digitado com o que está salvo em verification_code. Se bater, ele muda a coluna confirmado para true e apaga o código por segurança.

2. Tabela sessions
Esta tabela só é tocada depois que o usuário digita o código corretamente e ganha acesso ao aplicativo.

Criação de Sessão (Insert): Para que o usuário não tenha que digitar o e-mail e pedir código toda vez que abrir o app amanhã ou depois, o backend cria um "Refresh Token".
Ele salva uma linha na tabela sessions contendo o user_id (vinculando com a tabela users), o token gerado (hasheado por segurança em refresh_token_hash), o ip_address (IP da pessoa) e a data de validade (expires_at).
É essa tabela que permite você ter a função de "Encerrar sessão de todos os dispositivos".
Resumindo: O e-mail digitado usa a tabela users para checar existência, salvar o código OTP (One Time Password) e validar quem ele é. E usa a tabela sessions para manter o usuário conectado depois do sucesso.


- rate limit

1. Validação Estrutural (A "Porta de Entrada")
Antes mesmo do backend encostar no banco de dados, a requisição passa pelo Zod (auth.schema.ts), que aplica:

Tamanho Máximo: O e-mail não pode ter mais de 50 caracteres. Impede ataques de buffer overflow ou sobrecarga de leitura no banco.
Domínios Rigorosos (Whitelist): Uma Regex bloqueia qualquer requisição que não termine exatamente com @gmail.com, @outlook.com, @hotmail.com, @live.com, @icloud.com ou @yahoo.com. Se não for um desses, a API devolve Erro 400 na hora.
Normalização Automática: O backend faz .trim() e .toLowerCase() automaticamente para evitar e-mails duplicados só porque o usuário usou letras maiúsculas ou espaços sem querer.

2. Limite de Requisições (Rate Limiting)
Para evitar que alguém use seu sistema para disparar SPAM ou derrubar seu servidor (rateLimit.middleware.ts):

Por IP (forgotIpLimiter): Um mesmo IP só pode pedir o envio de códigos 10 vezes a cada 15 minutos. Isso bloqueia robôs/DDoS gerais.
Por Conta/E-mail (forgotAccountLimiter): Um mesmo e-mail só pode receber 3 pedidos por hora. Isso previne um ataque chamado Email Bombing (quando alguém usa seu site pra encher a caixa de entrada de outra pessoa com spam de códigos).

3. Proteção do Código OTP (One Time Password)
O código de 6 dígitos que vai pro e-mail tem segurança nível bancário (auth.controller.ts):

Tempo de Vida Curto: O código expira de forma estrita após 15 minutos (verification_code_expires_at).
Criptografia Argon2: O código não é salvo em texto limpo no Supabase. Ele sofre um hash com Argon2. Se um hacker vazar o banco de dados, ele não consegue saber quais são os códigos que estão ativos.
Anti Força-Bruta (5 Tentativas): Há um sistema de monitoramento na memória. Se o usuário (ou um script hacker) errar o código 5 vezes seguidas, o backend se defende apagando o código do banco de dados na hora. O atacante é forçado a voltar para o passo 1 e pedir um novo e-mail.

4. Gestão e Bloqueio de Contas
Se o usuário tentar logar e a coluna banido dele estiver true no Supabase, o sistema encerra qualquer validação de sessão futura dele.



# Continuar com o Google
**frontend**

O que o SEU Backend PRECISA fazer:
Você nunca deve confiar apenas no frontend dizendo "o Google deixou ele entrar". Seu backend tem que fazer o seguinte trabalho:

Verificação de Integridade (Validação do Token): O seu backend recebe o Token do Google e usa uma biblioteca (como a Google Auth Library) para verificar a assinatura criptográfica. Isso garante que o token foi realmente emitido pelo Google e não forjado por um hacker.
Criação ou Sincronização de Conta: O backend lê o e-mail do token e verifica no seu próprio banco de dados. O usuário já existe? Se sim, faz o login. Se não, o backend tem que criar o usuário novo no seu banco.
Geração do Seu Próprio Token (Sessão): O token do Google serve apenas para o momento do login. Após validar quem é a pessoa, o seu backend deve gerar o seu próprio token (ex: um JWT da Minsq) para o usuário usar durante a navegação no aplicativo.
Limitações e Regras de Negócio (O que você perguntou): O Google não sabe quem foi banido no seu app. Seu backend precisa verificar:
Este usuário foi banido nos nossos Termos de Uso?
O sistema de criação de contas está pausado/limitado no momento? (Você pode querer limitar quantas contas novas podem ser criadas por IP para evitar bots, mesmo com Google).
Rate Limiting (Limite de Requisições): Limitar quantas vezes o endpoint /api/auth/verify-otc (o seu endpoint de login do Google) pode ser chamado, para evitar ataques de força bruta ou negação de serviço (DDoS) no seu servidor.

se email passar pelo google {
  se email for novo cairá no onboarding e depois cairá no app
  se email for já cadastrado cairá no app direto
}


**core**

- supabase

1. Tabela users
Assim que o Google responde dizendo "Autenticação aprovada, este é o e-mail 

joao@gmail.com
", o backend faz o seguinte:

Busca (Select): Ele checa se já existe um usuário na tabela users com esse e-mail.
Se o usuário NÃO existe (Novo Usuário):
O backend cria (Insert) uma nova linha para ele na tabela users.
A diferença principal: A coluna confirmado já vai direto como true! (Porque o Google já validou que o e-mail é dele, então não precisamos enviar nenhum código).
Ele não gera verification_code nem senha.
O backend marca esse usuário internamente como isNewUser = true para avisar o frontend que ele deve ir para a tela de Onboarding em vez do App direto.
Se o usuário JÁ existe:
O backend não faz nenhum Update. Ele simplesmente confia e pega os dados daquele usuário para seguir em frente.
2. Tabela sessions
Assim como no login manual, depois de reconhecer o usuário na tabela users:

Criação de Sessão (Insert): O backend chama a função createSession e salva uma linha na tabela sessions.
Isso vincula o user_id a um Token para o navegador, salvando o ip_address, user_agent e a validade. É o que mantém a pessoa logada sem precisar clicar no botão do Google a cada clique que der dentro do site.
Resumo: O "Continuar com o Google" consulta a tabela users e, se for novo, insere direto como confirmado = true. Logo em seguida, ele pula a parte de enviar códigos por e-mail e já faz o Insert na tabela sessions para liberar o acesso imediatamente.


- rate limit

1. Limite de Requisições (Rate Limiting)
As 3 rotas responsáveis pelo Google (/google, /google/callback e /verify-otc) estão envoltas pelo loginIpLimiter.
Isso significa que a sua API barra automaticamente qualquer IP que tente disparar o botão do Google dezenas de vezes por minuto. Previne abuso, sobrecarga do servidor e tentativas de DDoS (derrubar o servidor).

2. Bloqueio de Falsificação (Anti-CSRF via "State")
A integração usa o parâmetro state: true na configuração do passport.ts.
O que isso faz: Ele manda uma chave secreta para o Google e exige que o Google devolva a mesma chave no final do processo. Isso impede que hackers forjem links para enganar seus usuários e vinculá-los à contas maliciosas.

3. A "Ponte Segura" OTC (One Time Code)
Esse é um dos sistemas mais inteligentes do seu código para evitar que os dados sejam interceptados quando a janela pop-up do Google fecha e volta pro seu site:

Quando o Google aprova o login, o backend não envia o seu Token Principal de cara.
Em vez disso, ele cria um OTC (One Time Code) na memória RAM do servidor (um código aleatório muito grande, como a8f3b2...).
Esse OTC tem validade de apenas 30 segundos e só pode ser lido uma única vez.
A janela pop-up pega esse OTC rápido, envia para a tela original, e essa tela troca o OTC pelo Token Real de Sessão (na rota /verify-otc). Assim que a troca é feita, o OTC é destruído para sempre.

4. Proteção da Sessão e Contas Banidas
Depois que a ponte segura termina, o sistema de sessão é idêntico ao do e-mail. Ele cria o Token (hasheado com Argon2) e salva na tabela sessions.
Se o usuário estiver marcado como banido = true no seu banco de dados, não importa se ele usou o Google; a sessão dele será rejeitada assim que tentar acessar o app.


# Termos

**Termos de Uso**


**Politica de Privacidade**