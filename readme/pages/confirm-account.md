# Code 

codigo possui maiuscula, minuscula, numeros e caracteres especiais [
    nao é obrigatorio que possuia tudo junto no codigo é aleatorio
    o codigo é protegido por backend, hash etc
    quem valida o codigo é o backend
]

cloudflare valida se nao é um robo

limite de no maximo 4 tentativa por codigo solicitado 

# Reenviar codigo

só pode reenviar codigo de 60 em 60 segundos

maximo 3 reenvios (sem contar o envio automatico inicial)

se o usuario fazer as 4 tentativa de codigo ele é blqoeuado e tera que esperar os segundos de cooldwon do reenvio de codigo backend protege tudo os limites


# supabase

A página e a lógica de confirm-account usam única e exclusivamente a tabela users no Supabase.

Nós não criamos uma tabela separada só para os códigos, porque seria um desperdício de performance. Ao invés disso, todos os controles e limites ficam em colunas de segurança diretamente dentro do registro do próprio usuário na tabela users.

Aqui estão as colunas exatas da tabela users que a funcionalidade usa nos bastidores para aplicar aquelas regras:

verification_code: Guarda o "Hash" Argon2 do código de 6 dígitos que foi gerado.
verification_code_expires_at: Diz até que dia/hora (15 min) aquele código vale.
code_attempts: Conta quantas vezes o usuário errou aquele código (bateu 4, ele anula o código acima).
code_resends: Conta quantas vezes o usuário apertou em "Reenviar código" (bateu 3, ele bloqueia reenvios novos).
code_last_sent_at: Salva os milissegundos exatos do último envio, e é com isso que o backend sabe se já se passaram 60 segundos ou não para bloquear o botão.
confirmado: A chave mestre. Quando tudo dá certo, o backend muda isso de false para true e zera as outras colunas.


# Proteções e Segurança

1. **Anti-Bot (Cloudflare Turnstile):** 
Embutido na página de solicitar código e validar código. Bloqueia scripts e robôs automatizados antes mesmo da requisição chegar no nosso backend.

2. **Proteção contra Brute-Force de Código (Adivinhação):**
Se o atacante tentar chutar o código de 6 dígitos e errar 4 vezes, o backend anula/queima o código ativo. Ele será obrigado a pedir um novo código, caindo nas regras de limite de reenvio.

3. **Proteção contra Email Bombing (Spam de Caixa de Entrada):**
- **Cooldown (Espera):** O usuário é bloqueado de pedir novos códigos se o último pedido foi feito há menos de 60 segundos.
- **Teto de Reenvios:** Máximo de 3 cliques em "Reenviar Código". Após isso, um bloqueio severo de 15 minutos é aplicado para aquela conta.

5. **Criptografia Forte (Argon2id):**
Nenhum código OTP ou senha fica visível no banco de dados. Tudo usa `Argon2id`, o algoritmo de hash mais recomendado atualmente, impossibilitando que um invasor (mesmo tendo acesso ao banco) leia os códigos.

6. **Defesa contra Anti-Timing Attacks (Enumeração de E-mails):**
Se um hacker tentar fazer login com um e-mail que não existe para descobrir quem é cadastrado no Minsq (medindo os milissegundos que o servidor demora para responder), o backend vai simular um cálculo falso de criptografia Argon2 só para atrasar a resposta e "enganar" o robô do atacante.

7. **Limpeza Automática de Contas "Zumbis":**
Se alguém criar a conta (e-mail falso ou verdadeiro) mas nunca digitar o código de verificação, o backend apaga automaticamente esse usuário do banco de dados após **48 horas**. Mantém o banco limpo e evita travamento de handles/nomes.

8. **Alerta de Segurança (Login Suspeito):**
Toda vez que um login é feito com sucesso, um e-mail é disparado para o dono da conta contendo:
- Mapa geolocalizado do acesso.
- Cidade, Região e País.
- IP real e tipo de Navegador/Dispositivo usado.

9. **Botão de Revogação de Emergência (Kill-Switch):**
Se o usuário não reconhecer o login, o e-mail de alerta possui um botão vermelho "Fui invadido". Ao clicar, o sistema intercepta os parâmetros `session_id` e `user_id`, destrói imediatamente aquela sessão logada, e exibe uma tela confirmando o bloqueio para que o invasor seja deslogado em tempo real.
