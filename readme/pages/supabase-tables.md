| tablename             |
| --------------------- |
| addictions            |
| admin_security_logs   |
| bug_reports           |
| challenges            |
| direct_messages       |
| feedbacks             |
| finance_settings      |
| finances              |
| foco_cardio           |
| foco_custom_exercises |
| foco_folders          |
| foco_routines         |
| focus_sessions        |
| follows               |
| fraud_signals         |
| friendships           |
| gyms                  |
| health_logs           |
| health_settings       |
| mindmaps              |
| notes                 |
| notifications         |
| page_views            |
| plans                 |
| plans_action          |
| recurring_bills       |
| routines              |
| sessions              |
| streak_coins          |
| streaks               |
| study_notes           |
| study_plans           |
| study_sessions        |
| study_settings        |
| study_tracks          |
| subscriptions         |
| support_tickets       |
| system_config         |
| tasks                 |
| user_flags            |
| users                 |

regras
-- ==========================================
-- 1. ADDICTIONS
-- ==========================================
ALTER TABLE public.addictions ENABLE ROW LEVEL SECURITY;

-- Remove política se já existir (para evitar erro ao rodar 2x)
DROP POLICY IF EXISTS "Usuários gerenciam seus próprios vícios" ON public.addictions;
CREATE POLICY "Usuários gerenciam seus próprios vícios"
ON public.addictions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 2. ADMIN SECURITY LOGS
-- ==========================================
ALTER TABLE public.admin_security_logs ENABLE ROW LEVEL SECURITY;
-- Sem políticas para "authenticated". Totalmente fechado para o frontend.
-- Apenas o backend (service_role) terá acesso.

-- ==========================================
-- 3. BUG REPORTS
-- ==========================================
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem reportar bugs" ON public.bug_reports;
CREATE POLICY "Usuários podem reportar bugs"
ON public.bug_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem ver os próprios bugs reportados" ON public.bug_reports;
CREATE POLICY "Usuários podem ver os próprios bugs reportados"
ON public.bug_reports
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ==========================================
-- 4. CHALLENGES
-- ==========================================
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver desafios onde é criador ou oponente" ON public.challenges;
CREATE POLICY "Ver desafios onde é criador ou oponente"
ON public.challenges
FOR SELECT
TO authenticated
USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

DROP POLICY IF EXISTS "Criar desafios como criador" ON public.challenges;
CREATE POLICY "Criar desafios como criador"
ON public.challenges
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Atualizar status do desafio" ON public.challenges;
CREATE POLICY "Atualizar status do desafio"
ON public.challenges
FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id OR auth.uid() = opponent_id)
WITH CHECK (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- ==========================================
-- 5. DIRECT MESSAGES
-- ==========================================
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
-- Sem políticas para "authenticated". Totalmente fechado para o frontend.
-- Conforme documentação interna, leitura/escrita são feitas pelo backend via service_role.

-- ==========================================
-- 6. FEEDBACKS
-- ==========================================
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
-- Sem políticas para "authenticated". 
-- O acesso será feito pelo backend usando a service_role.

-- ==========================================
-- 7. FINANCE SETTINGS
-- ==========================================
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam próprias configs financeiras" ON public.finance_settings;
CREATE POLICY "Usuários gerenciam próprias configs financeiras"
ON public.finance_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 8. FINANCES (Extrato)
-- ==========================================
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam as próprias finanças" ON public.finances;
CREATE POLICY "Usuários gerenciam as próprias finanças"
ON public.finances
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 9. FOCO CARDIO
-- ==========================================
ALTER TABLE public.foco_cardio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam os próprios cardios" ON public.foco_cardio;
CREATE POLICY "Usuários gerenciam os próprios cardios"
ON public.foco_cardio
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 10. FOCO CUSTOM EXERCISES
-- ==========================================
ALTER TABLE public.foco_custom_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam seus próprios exercícios" ON public.foco_custom_exercises;
CREATE POLICY "Usuários gerenciam seus próprios exercícios"
ON public.foco_custom_exercises
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 11. FOCO FOLDERS
-- ==========================================
ALTER TABLE public.foco_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam as próprias pastas de foco" ON public.foco_folders;
CREATE POLICY "Usuários gerenciam as próprias pastas de foco"
ON public.foco_folders
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 12. FOCO ROUTINES
-- ==========================================
ALTER TABLE public.foco_routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam as próprias rotinas" ON public.foco_routines;
CREATE POLICY "Usuários gerenciam as próprias rotinas"
ON public.foco_routines
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 13. FOCUS SESSIONS
-- ==========================================
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam o próprio histórico de sessões" ON public.focus_sessions;
CREATE POLICY "Usuários gerenciam o próprio histórico de sessões"
ON public.focus_sessions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 14. FOLLOWS (Sistema de Seguidores)
-- ==========================================
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Qualquer um logado pode ver quem segue quem
DROP POLICY IF EXISTS "Qualquer usuário logado pode ler conexões" ON public.follows;
CREATE POLICY "Qualquer usuário logado pode ler conexões"
ON public.follows
FOR SELECT
TO authenticated
USING (true);

-- Só pode seguir usando o próprio ID
DROP POLICY IF EXISTS "Usuários só podem seguir os outros como eles mesmos" ON public.follows;
CREATE POLICY "Usuários só podem seguir os outros como eles mesmos"
ON public.follows
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id);

-- Pode aceitar pedidos (se for o seguido) ou dar unfollow/bloquear
DROP POLICY IF EXISTS "Usuários podem atualizar seus relacionamentos" ON public.follows;
CREATE POLICY "Usuários podem atualizar seus relacionamentos"
ON public.follows
FOR UPDATE
TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = followed_id)
WITH CHECK (auth.uid() = follower_id OR auth.uid() = followed_id);

DROP POLICY IF EXISTS "Usuários podem remover relacionamentos" ON public.follows;
CREATE POLICY "Usuários podem remover relacionamentos"
ON public.follows
FOR DELETE
TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = followed_id);

-- ==========================================
-- 15. FRAUD SIGNALS
-- ==========================================
ALTER TABLE public.fraud_signals ENABLE ROW LEVEL SECURITY;
-- Sem políticas públicas (frontend não acessa). 
-- Logs de fraude serão gerados pelo backend/admin (via service_role).

-- ==========================================
-- 16. FRIENDSHIPS (Amizades)
-- ==========================================
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Qualquer um logado pode ver a rede de amigos
DROP POLICY IF EXISTS "Qualquer usuário logado pode ler amizades" ON public.friendships;
CREATE POLICY "Qualquer usuário logado pode ler amizades"
ON public.friendships
FOR SELECT
TO authenticated
USING (true);

-- Só pode solicitar amizade como si mesmo
DROP POLICY IF EXISTS "Usuários criam amizades como si mesmos" ON public.friendships;
CREATE POLICY "Usuários criam amizades como si mesmos"
ON public.friendships
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Pode aceitar (se for o friend_id) ou gerenciar a amizade
DROP POLICY IF EXISTS "Usuários gerenciam suas próprias amizades" ON public.friendships;
CREATE POLICY "Usuários gerenciam suas próprias amizades"
ON public.friendships
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = friend_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Usuários podem desfazer amizades" ON public.friendships;
CREATE POLICY "Usuários podem desfazer amizades"
ON public.friendships
FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ==========================================
-- 17. GYMS (Academias Parceiras)
-- ==========================================
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

-- Usuários apenas LEEM as academias (INSERT/UPDATE/DELETE bloqueados para eles)
DROP POLICY IF EXISTS "Usuários podem ver as academias" ON public.gyms;
CREATE POLICY "Usuários podem ver as academias"
ON public.gyms
FOR SELECT
TO authenticated
USING (true);
-- Nota: o seu painel Admin continuará conseguindo editar tudo usando a service_role.

-- ==========================================
-- 18. HEALTH LOGS
-- ==========================================
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam seus logs de saúde" ON public.health_logs;
CREATE POLICY "Usuários gerenciam seus logs de saúde"
ON public.health_logs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 19. HEALTH SETTINGS
-- ==========================================
ALTER TABLE public.health_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas configs de saúde" ON public.health_settings;
CREATE POLICY "Usuários gerenciam suas configs de saúde"
ON public.health_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 20. MINDMAPS
-- ==========================================
ALTER TABLE public.mindmaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam seus mapas mentais" ON public.mindmaps;
CREATE POLICY "Usuários gerenciam seus mapas mentais"
ON public.mindmaps
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 21. NOTES (Anotações)
-- ==========================================
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas próprias anotações" ON public.notes;
CREATE POLICY "Usuários gerenciam suas próprias anotações"
ON public.notes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 22. NOTIFICATIONS (Notificações)
-- ==========================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas notificações" ON public.notifications;
CREATE POLICY "Usuários gerenciam suas notificações"
ON public.notifications
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 23. PAGE VIEWS (Analytics)
-- ==========================================
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Permite ao app do usuário gravar uma visualização de página, 
-- mas NÃO permite que ele leia o analytics inteiro.
DROP POLICY IF EXISTS "Usuários podem registrar views" ON public.page_views;
CREATE POLICY "Usuários podem registrar views"
ON public.page_views
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 24. PLANS (Planos de Assinatura)
-- ==========================================
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Usuários apenas LEEM os planos disponíveis para compra
DROP POLICY IF EXISTS "Qualquer logado pode ver os planos" ON public.plans;
CREATE POLICY "Qualquer logado pode ver os planos"
ON public.plans
FOR SELECT
TO authenticated
USING (true);

-- ==========================================
-- 25. PLANS ACTION (Planos de Ação)
-- ==========================================
ALTER TABLE public.plans_action ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam seus planos de ação" ON public.plans_action;
CREATE POLICY "Usuários gerenciam seus planos de ação"
ON public.plans_action
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 26. RECURRING BILLS (Contas recorrentes)
-- ==========================================
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas contas recorrentes" ON public.recurring_bills;
CREATE POLICY "Usuários gerenciam suas contas recorrentes"
ON public.recurring_bills
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 27. ROUTINES (Rotinas)
-- ==========================================
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas rotinas" ON public.routines;
CREATE POLICY "Usuários gerenciam suas rotinas"
ON public.routines
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 28. SESSIONS (Sessões/Aparelhos logados)
-- ==========================================
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas próprias sessões" ON public.sessions;
CREATE POLICY "Usuários gerenciam suas próprias sessões"
ON public.sessions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 29. STREAK COINS (Medalhas de Ofensiva)
-- ==========================================
ALTER TABLE public.streak_coins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas próprias moedas" ON public.streak_coins;
CREATE POLICY "Usuários gerenciam suas próprias moedas"
ON public.streak_coins
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 30. STREAKS (Ofensivas)
-- ==========================================
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas próprias ofensivas" ON public.streaks;
CREATE POLICY "Usuários gerenciam suas próprias ofensivas"
ON public.streaks
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 31. STUDY NOTES (Anotações de Estudo)
-- ==========================================
ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas próprias notas de estudo" ON public.study_notes;
CREATE POLICY "Usuários gerenciam suas próprias notas de estudo"
ON public.study_notes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 32. STUDY PLANS (Planos de Estudo)
-- ==========================================
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam seus próprios planos de estudo" ON public.study_plans;
CREATE POLICY "Usuários gerenciam seus próprios planos de estudo"
ON public.study_plans
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 33. STUDY SESSIONS (Sessões de Estudo)
-- ==========================================
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas sessões de estudo" ON public.study_sessions;
CREATE POLICY "Usuários gerenciam suas sessões de estudo"
ON public.study_sessions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 34. STUDY SETTINGS (Configurações de Estudo)
-- ==========================================
ALTER TABLE public.study_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas configurações de estudo" ON public.study_settings;
CREATE POLICY "Usuários gerenciam suas configurações de estudo"
ON public.study_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 35. STUDY TRACKS (Trilhas de Estudo)
-- ==========================================
ALTER TABLE public.study_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas próprias trilhas" ON public.study_tracks;
CREATE POLICY "Usuários gerenciam suas próprias trilhas"
ON public.study_tracks
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 36. SUBSCRIPTIONS (Assinaturas)
-- ==========================================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários veem a própria assinatura" ON public.subscriptions;
CREATE POLICY "Usuários veem a própria assinatura"
ON public.subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 37. SUPPORT TICKETS (Chamados de Suporte)
-- ==========================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam os próprios chamados" ON public.support_tickets;
CREATE POLICY "Usuários gerenciam os próprios chamados"
ON public.support_tickets
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 38. SYSTEM CONFIG (Configurações Globais)
-- ==========================================
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Aplicativo apenas lê as configs (ex: ver se está em manutenção)
DROP POLICY IF EXISTS "Qualquer um pode ler as configs" ON public.system_config;
CREATE POLICY "Qualquer um pode ler as configs"
ON public.system_config
FOR SELECT
TO public
USING (true);

-- ==========================================
-- 39. TASKS (Tarefas)
-- ==========================================
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam as próprias tarefas" ON public.tasks;
CREATE POLICY "Usuários gerenciam as próprias tarefas"
ON public.tasks
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 40. USER FLAGS (Flags do Usuário)
-- ==========================================
ALTER TABLE public.user_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam as próprias flags" ON public.user_flags;
CREATE POLICY "Usuários gerenciam as próprias flags"
ON public.user_flags
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 41. USERS (Perfis Públicos)
-- ==========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Leitura do perfil é pública para quem tem conta (rede social/amigos)
DROP POLICY IF EXISTS "Usuários podem ver perfis públicos" ON public.users;
CREATE POLICY "Usuários podem ver perfis públicos"
ON public.users
FOR SELECT
TO authenticated
USING (true);

-- Edição apenas do próprio perfil
DROP POLICY IF EXISTS "Usuários só editam o próprio perfil" ON public.users;
CREATE POLICY "Usuários só editam o próprio perfil"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Caso você crie o usuário via frontend
DROP POLICY IF EXISTS "Usuários podem inserir o próprio perfil" ON public.users;
CREATE POLICY "Usuários podem inserir o próprio perfil"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

