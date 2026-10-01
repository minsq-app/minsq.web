# Sidebar interna
**frontend**

- buscar
limit === max 30 caracteres

- lixeira
on click === abre o modo lixeira = se clicar denovo fecha o modo lixeira
modo lixeira === botao esvaziar lixeira = tem certeza "sim" "não" esc ou enter = limpa a lxieira = a lixeira fica limpa de 30 em 30 dias automaticamente = limpada ate mesmo no banco de dados = max 6 notas dentro da lixeira = se o usuario tentar apagar algo e ja tiver a lixeira cheia = o user é notificado com um modal perguntando se ele quer esvaziar a lixeira
button restaurar === restaurar a nota = caso nao tenha excedido o limite de notas 
apagar nota = apaga direto 

- importar
apenas visual no beta

- atalhos
CTRL + N === nova nota
CTRL + F === buscar
CTRL + D === duplica nota atual

- + Nova nota
cria uma nota vazia
limit === no maximo 20 notas

**core**

- supabase
O backend executa comandos no Supabase (tabela `notes`) focado em performance (usando contadores `count: 'exact'` para evitar tráfego de rede).
1. **Listagem:** `SELECT *` e limpeza passiva (Hard delete `DELETE` para notas na lixeira há > 30 dias).
2. **Lixeira:** Soft delete (`UPDATE deleted = true`) pelo método `delete()`, e Hard Delete nos métodos `purge()` e `emptyTrash()`. Limite máximo de 6 notas barrado ativamente (erro `TRASH_FULL`).
3. **Criação/Duplicação/Restauração:** Verificação de limite máximo de 20 notas ativas em toda a workspace de notas (através do `upsert` e `restore`).

---

# Editor de Nota
**frontend**

- titulo
limit === 46 caracteres = sem caracteres especiais

- tags
limits[
    quantidade === no maximo 3 tags
    limite caracteres === 35 caracteres
    nao pode usar caracteres especiais
]

- nota
limite de no maximo 2800 caracteres por nota e no maximo 500 caracteres especiais por nota

- favoritar 
limit === no maximo 5 notas favoritas

- duplicar nota
se ainda tiver espaco nas notas ele duplica a nota = senao ele notifica que nao e possivel duplicar a nota

- baixar nota
baixa a nota em .md

- apagar nota
manda a nota para a lixeira = se a lixeira estiver cheia = o usuario é notificado com um modal perguntando se ele quer esvaziar a lixeira

**core**

- rate limits (Zod Schema e Controller)
1. **Título:** Máximo de 46 caracteres e sem caracteres especiais (bloqueio via regex).
2. **Corpo da Nota:** Máximo de 2800 caracteres com filtro de segurança `.refine()` que barra caso existam mais de 500 caracteres especiais.
3. **Tags:** Máximo de 3 tags, cada uma com limite de 35 caracteres, sem caracteres especiais (regex).
4. **Favoritar (Pinned):** O `upsert` barra ativamente qualquer tentativa de favoritar uma nota caso o limite global de 5 notas favoritas já tenha sido atingido.




# Documentação do Editor de Notas (WYSIWYG)

## 1. Estrutura Visual (WYSIWYG)
O aplicativo de notas migrou de um formato de texto bruto (`<textarea>` com sintaxe Markdown) para um sistema "What You See Is What You Get" (WYSIWYG).
- O editor é baseado em um `div` com o atributo `contenteditable="true"`.
- As notas agora são formatadas nativamente no DOM e salvas diretamente como tags HTML no banco de dados, permitindo a visualização em tempo real de títulos, listas, citações e formatações de texto.
- Checklists interativas usam campos nativos `<input type="checkbox">` integrados às linhas, onde a estilização detecta cliques para riscar e esmaecer visualmente as anotações cumpridas.

## 2. Salvamento e Otimização de Performance
O sistema realiza requisições de salvamento em *background* a cada atualização. 
- Para economizar recursos de hardware e requisições ao servidor, existe um *debounce* (timer) de **2 segundos** (2000ms).
- Isso significa que o editor só acionará a API de salvamento se você fizer uma pausa de pelo menos 2 segundos ao digitar.

## 3. Segurança Contra Vulnerabilidades e XSS (Cross-Site Scripting)
Pelo fato do aplicativo injetar conteúdo HTML armazenado no banco de dados diretamente na tela dos usuários usando `innerHTML` e template literals (`` `${}` ``), essa estrutura era originalmente exposta ao ataque cibernético XSS. Um agressor poderia redigir um `script` nocivo em vez de texto e ter sua execução permitida.

### 🛡️ Defesa Aplicada (Blindagem 100%)
Para contornar essa vulnerabilidade de segurança:
- Removemos a dependência da função comum `escapeHtml` (que desarmava o HTML, mas quebrava a estilização visual).
- Adicionamos a biblioteca oficial **DOMPurify** (fornecida via CDN Cloudflare).
- **Implementação:** Antes de injetar qualquer conteúdo salvo no banco para ser exibido ao usuário (seja no editor principal ou na versão de Lixeira), o código é filtrado com `DOMPurify.sanitize(n.body)`.
- Isso garante que tags de texto e formatações (`<h1>`, `<b>`, `<input>`) funcionem livremente, enquanto atributos perigosos (como `onclick=""`) ou elementos proibidos (`<script>`) sejam totalmente aniquilados antes mesmo de tocarem a tela.

### 🛡️ Defesa em Profundidade (Backend API)
Como uma segunda camada impenetrável de segurança, a API do servidor Node.js também foi blindada.
- As bibliotecas `dompurify` e `jsdom` foram integradas no backend (pasta `/core`).
- No controlador de notas (`notes.controller.ts`), todos os conteúdos que tentam entrar no banco de dados passam obrigatoriamente por um filtro de lavagem `purify.sanitize(body)`.
- Isso barra agentes nocivos que tentem interceptar as requisições HTTP e injetar scripts de forma automatizada, ignorando o site.

## 4. Validação de Limites e Zod Schema
Foi feito um espelhamento rigoroso dos limites entre o App (Navegador) e o Servidor.

**Limites de Segurança do Controller:**
- Limite de corpo de nota: `15000` caracteres (para permitir armazenamento folgado da marcação HTML gerada).
- Limite de título: `46` caracteres.
- Limite de tags: Máximo de `3` tags por nota e `35` caracteres por tag.

**Fim da Ditadura de Títulos (Libertação de UX):**
O *Middleware Zod* e a interface frontend possuíam regras severas (Expressões Regulares - Regex) que proibiam que os títulos de notas, metas e planos possuíssem pontuação comum (como `?`, `!`, `,`). Essas travas, criadas antigamente sob a justificativa falha de segurança, foram totalmente desativadas para permitir uma escrita natural, sendo a segurança agora responsabilidade exclusiva do esterilizador DOMPurify.

## 5. Melhorias de Usabilidade do Editor

### Persistência de Checklists
As caixas de seleção agora sincronizam seus estados internos (clicado ou não clicado) diretamente no código-fonte das notas. Isso é alcançado forçando o atributo HTML real `checked="checked"` na marcação da página, para que o estado persista de forma fiel através de encerramentos e recarregamentos.

### Saída Inteligente (Enter Duplo)
O usuário pode escapar dinamicamente de blocos de formatação (Citações, Checklists e Títulos H1, H2, H3). Ao apertar a tecla `Enter` com o cursor em uma linha limpa de texto nesses formatos, o aplicativo injeta uma ordem para retroceder a formatação e devolver o cursor a um bloco limpo e padrão de Parágrafo (Div branca).
