import { Request, Response } from 'express';
import crypto from 'crypto';
import { supabase, filterUserFields, filterUserPayload, formatUser, existingColumns } from '../config/supabase';
import { hashPasswordArgon2, verifyToken, pendingFingerprint } from '../utils/crypto';
import { findByEmail } from '../utils/email';
import { createSession } from './auth.controller';
import { invalidateAuthCache } from '../middlewares/auth.middleware';
import { isOwnAssetUrl } from '../utils/assetUrl';
// Helper to get or create a mock user

export class UserController {
  static async me(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      const { data: user, error } = await supabase
        .from('users')
        .select(filterUserFields('*'))
        .eq('id', userId)
        .single();

      if (error) throw error;
      res.json(formatUser(user));
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async heartbeat(req: Request, res: Response) {
    try {
      const sessionId = (req as any).sessionId;
      if (!sessionId) return res.status(401).json({ error: 'Sessão inválida.' });

      const { error } = await supabase
        .from('sessions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Heartbeat Error]', err.message);
      res.status(500).json({ error: 'Erro ao processar heartbeat.' });
    }
  }

  static async checkHandle(req: any, res: Response) {
    try {
      let handle = req.query.handle as string;
      if (!handle) return res.json({ available: false, error: 'Handle é obrigatório.' });
      
      handle = handle.replace(/^@/, '').toLowerCase();

      const isAdmin = req.userRole === 'admin' || req.userRole === 'dev';
      const minLength = isAdmin ? 1 : 3;

      if (handle.length < minLength || handle.length > 30) {
        return res.json({ available: false, error: `Formato inválido. Use de ${minLength} a 30 caracteres.` });
      }

      const reservedHandles = [
        // Reservados do sistema
        'admin', 'suporte', 'minsq', 'root', 'system', 'sysadmin', 'administrator', 'mohi', 'null', 'bot',
        // +18 e NSFW
        'xvideos', 'pornhub', 'onlyfans', 'fatalmodel', 'redtube', 'brazzers', 'privacy'
      ];
      if (reservedHandles.includes(handle)) {
        return res.json({ available: false, error: 'Este nome de usuário é reservado.' });
      }

      const formattedHandle = '@' + handle;

      const { data: existingUser, error } = await supabase
        .from('users')
        .select('id')
        .eq('handle', formattedHandle)
        .maybeSingle();

      if (error) throw error;
      res.json({ available: !existingUser });
    } catch (err: any) {
      console.error('[Check Handle Error]', err.message);
      res.status(500).json({ error: 'Erro ao verificar o handle.' });
    }
  }

  static async completeOnboarding(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
      }

      const tokenStr = authHeader.split(' ')[1];
      const decoded = verifyToken(tokenStr, 'onboarding');
      
      if (!decoded?.pendingEmail) {
        return res.status(401).json({ error: 'Token inválido para onboarding.' });
      }

      const pendingEmail: string = decoded.pendingEmail;
      const { handle, conheceu_por } = req.body;

      if (!handle || typeof handle !== 'string') {
        return res.status(400).json({ error: 'Handle é obrigatório.' });
      }

      // Remove @ inicial e força letras minúsculas
      const rawHandle = handle.replace(/^@/, '').toLowerCase();
      const minLength = 3;

      if (rawHandle.length < minLength || rawHandle.length > 30) {
        return res.status(400).json({ error: `O nome de usuário deve ter entre ${minLength} e 30 caracteres.` });
      }

      // Validação de caracteres
      const handleRegex = /^[a-z0-9_.]+$/;
      if (!handleRegex.test(rawHandle)) {
        return res.status(400).json({ error: 'O nome de usuário só pode conter letras minúsculas, números, sublinhado (_) e ponto (.).' });
      }

      const reservedHandles = [
        'admin', 'suporte', 'minsq', 'root', 'system', 'sysadmin', 'administrator', 'mohi', 'null', 'bot',
        'xvideos', 'pornhub', 'onlyfans', 'fatalmodel', 'redtube', 'brazzers', 'privacy'
      ];
      if (reservedHandles.includes(rawHandle)) {
        return res.status(400).json({ error: 'Este nome de usuário é reservado e não pode ser utilizado.' });
      }

      const validSources = ['YouTube', 'Instagram', 'TikTok', 'X', 'GitHub', 'Outros'];
      if (conheceu_por && !validSources.includes(conheceu_por)) {
        return res.status(400).json({ error: 'Opção de origem inválida.' });
      }

      const formattedHandle = '@' + rawHandle;

      // Checa as duas formas do e-mail (normalizada e crua): contas antigas foram gravadas com ponto.
      const already = await findByEmail('users', pendingEmail, 'id');
      if (already) return res.status(409).json({ error: 'Esta conta já existe.' });

      const { data: taken } = await supabase.from('users').select('id').eq('handle', formattedHandle).maybeSingle();
      if (taken) return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });

      const { data: pendente } = await supabase.from('pendente').select('*').eq('email', pendingEmail).maybeSingle();
      if (!pendente) return res.status(400).json({ error: 'Cadastro pendente não encontrado.' });

      // Mesmo cálculo do verifyEmail/Google: identifica a linha (id + created_at), não o código/expiração.
      if (pendingFingerprint(pendente) !== decoded.sfp) {
        return res.status(409).json({ error: 'Cadastro alterado. Refaça o processo.' });
      }

      const userPayload = filterUserPayload({
        email: pendingEmail, 
        nome: pendente.nome || rawHandle, 
        nascimento: pendente.nascimento ?? null,
        role: 'user', 
        confirmado: true, // a posse do e-mail já foi provada (código ou Google) antes de chegar aqui
        streak: 0, 
        tema: 'dark', 
        handle: formattedHandle,
        avatar: (pendingEmail[0] || 'U').toUpperCase(), 
        avatar_type: 'initial', 
        conheceu_por
      });

      const { data: newUser, error: insertError } = await (supabase
        .from('users')
        .insert(userPayload)
        .select(filterUserFields('*'))
        .single() as any);

      if (insertError) {
        if (insertError.code === '23505') {
          return res.status(409).json({ error: 'Conflito ao criar a conta. Ela pode já ter sido criada por outra aba.' });
        }
        throw insertError;
      }

      await supabase.from('pendente').delete().eq('id', pendente.id);

      const payload = { id: newUser.id, email: newUser.email };
      const { token } = await createSession(newUser.id, payload, req, res);

      return res.json({ token, user: formatUser(newUser) });
    } catch (err: any) {
      console.error('[Complete Onboarding Error]', err.message);
      res.status(500).json({ error: 'Erro interno ao finalizar onboarding.' });
    }
  }

  static async updateMe(req: Request, res: Response) {
    const {
      nome, bio, tema, avatar_url,
      handle, social1, social2,
      profile_page_bg, profile_page_bg_img,
      profile_kout, profile_font,
      profile_bg, profile_bg_opacity,
      profile_page_bg_opacity,
      avatar_border, profile_theme,
      avatar_type, avatar, customization_json,
      nascimento, estado, cidade, genero,
      perfil_publico
    } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      const { data: currentUser } = await supabase.from('users').select('*').eq('id', userId).single();
      if (!currentUser) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const updateData: any = {};
      const now = new Date();
      const weekNumber = Math.ceil((((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);
      const currentWeek = `${now.getFullYear()}-W${weekNumber}`;
      const currentDay = now.toISOString().split('T')[0];

      if (nome !== undefined && nome !== currentUser.nome) {
        if (typeof nome !== 'string' || nome.length < 2 || nome.length > 30) {
          return res.status(400).json({ error: 'O nome de exibição deve ter entre 2 e 30 caracteres.' });
        }
        let nCount = currentUser.nome_count || 0;
        let nWeek = currentUser.nome_week || '';
        if (nWeek !== currentWeek) { nCount = 0; nWeek = currentWeek; }
        if (nCount >= 3) return res.status(429).json({ error: 'Você só pode alterar o nome 3 vezes por semana.' });
        updateData.nome_count = nCount + 1;
        updateData.nome_week = nWeek;
        updateData.nome = nome;
      }

      if (bio !== undefined && bio !== currentUser.bio) {
        if (typeof bio !== 'string' || bio.length > 100) return res.status(400).json({ error: 'A bio não pode exceder 100 caracteres.' });
        let bCount = currentUser.bio_count || 0;
        let bDay = currentUser.bio_day || '';
        if (bDay !== currentDay) { bCount = 0; bDay = currentDay; }
        if (bCount >= 5) return res.status(429).json({ error: 'Você só pode alterar a bio 5 vezes ao dia.' });
        updateData.bio_count = bCount + 1;
        updateData.bio_day = bDay;
        updateData.bio = bio;
      }

      if (tema !== undefined) {
        if (typeof tema !== 'string' || !/^[a-zA-Z0-9_-]{1,20}$/.test(tema)) return res.status(400).json({ error: 'Tema inválido.' });
        updateData.tema = tema;
      }
      if (perfil_publico !== undefined) updateData.perfil_publico = perfil_publico === true || perfil_publico === 'true';
      if (avatar_url !== undefined) {
        if (avatar_url && avatar_url !== '') {
          if (String(avatar_url).length > 512) return res.status(400).json({ error: 'URL do avatar excede o limite.' });
          try {
            const u = new URL(avatar_url);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') {
              return res.status(400).json({ error: 'URL do avatar deve usar http ou https.' });
            }
            if (!isOwnAssetUrl(avatar_url)) {
              return res.status(400).json({ error: 'Host de avatar não permitido.' });
            }
            updateData.avatar_url = avatar_url;
          } catch (e) {
            return res.status(400).json({ error: 'URL do avatar inválida.' });
          }
        } else {
          updateData.avatar_url = avatar_url;
        }
      }

      if (handle !== undefined && handle !== currentUser.handle && existingColumns.includes('handle')) {
        let cleanHandle = handle.trim().toLowerCase();
        if (!cleanHandle.startsWith('@')) cleanHandle = `@${cleanHandle}`;

        const isAdmin = (req as any).userRole === 'admin' || (req as any).userRole === 'dev';
        const minLength = isAdmin ? 1 : 3;
        
        const handleRegex = new RegExp(`^@[a-z0-9_.]{${minLength},30}$`);
        if (!handleRegex.test(cleanHandle)) {
          return res.status(400).json({ error: `Handle do usuário inválido. Deve ter entre ${minLength} e 30 caracteres alfanuméricos, underline ou ponto, e começar com @.` });
        }

        let hWeek = currentUser.handle_week || '';
        if (hWeek === currentWeek) {
          return res.status(429).json({ error: 'Você só pode alterar o username 1 vez por semana.' });
        }

        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('handle', cleanHandle)
          .neq('id', userId)
          .maybeSingle();

        if (existingUser) {
          return res.status(400).json({ error: 'Este handle/username já está em uso.' });
        }
        updateData.handle_week = currentWeek;
        updateData.handle = cleanHandle;
      }

      const checkBannedLinks = (url: string) => {
        if (!url) return true;
        const banned = [
          'xvideos.com', 'xvideos.red', 'pornhub.com', 'xhamster.com', 'xnxx.com',
          'onlyfans.com', 'fatalmodel.com', 'privacy.com.br', 'socialmediagirls.com',
          'sambaporno.com', 'animeshentai.biz', 'hentaistube.com', 'thehentai.net',
          'cameraprive.com', 'hyper.cool', 'shokka.com', 'thisvid.com',
          'photoacompanhantes.com', 'muitohentai.com', 'pornocarioca.com',
          'betano.bet.br', 'sportingbet.bet.br', 'betboo.bet.br', 'novibet.bet.br',
          'betfair.bet.br', 'pix.bet.br', 'esportesdasorte.bet.br', 'betnacional.bet.br',
          'kto.bet.br', 'superbet.bet.br', 'bet365.bet.br', 'betboom.bet.br',
          'br4bet.bet.br', 'estrelabet.bet.br', 'betsson.bet.br', 'vaidebet.bet.br',
          '1xbet.bet.br', 'betcaixa.bet.br', 'betvip.bet.br', 'betpix365.bet.br'
        ];

        try {
          let parseUrl = url;
          if (!parseUrl.startsWith('http://') && !parseUrl.startsWith('https://')) {
            parseUrl = 'https://' + parseUrl;
          }
          const u = new URL(parseUrl);
          const hostname = u.hostname.toLowerCase();
          for (const word of banned) {
            if (hostname === word || hostname.endsWith('.' + word)) return false;
          }
        } catch (e) {
          const lowerUrl = url.toLowerCase();
          for (const word of banned) {
            if (lowerUrl.includes(word)) return false;
          }
        }
        return true;
      };;

      if (social1 !== undefined && social1 !== currentUser.social1) {
        if (social1.length > 100) return res.status(400).json({ error: 'Link social 1 excede 100 caracteres.' });
        if (!checkBannedLinks(social1)) return res.status(400).json({ error: 'O link social 1 contém domínios não permitidos pelos Termos de Uso.' });
        updateData.social1 = social1;
      }
      if (social2 !== undefined && social2 !== currentUser.social2) {
        if (social2.length > 100) return res.status(400).json({ error: 'Link social 2 excede 100 caracteres.' });
        if (!checkBannedLinks(social2)) return res.status(400).json({ error: 'O link social 2 contém domínios não permitidos pelos Termos de Uso.' });
        updateData.social2 = social2;
      }

      if (profile_page_bg !== undefined) {
        if (profile_page_bg !== 'default' && profile_page_bg !== 'image' && profile_page_bg !== 'black') {
          if (profile_page_bg.length > 512) return res.status(400).json({ error: 'Opção de fundo inválida' });
        }
        updateData.profile_page_bg = profile_page_bg;
      }
      if (profile_page_bg_img !== undefined) {
        if (typeof profile_page_bg_img !== 'string' || profile_page_bg_img.length > 2048) return res.status(400).json({ error: 'A URL do fundo excede o limite permitido.' });
        if (profile_page_bg_img) {
          try {
            if (!isOwnAssetUrl(profile_page_bg_img)) return res.status(400).json({ error: 'Host de fundo não permitido.' });
          } catch(e) { return res.status(400).json({ error: 'URL do fundo inválida.' }); }
        }
        updateData.profile_page_bg_img = profile_page_bg_img.replace(/[<>"]/g, '');
      }

      if (profile_kout !== undefined) {
        const validKouts = ['none', 'black', 'purple', 'pink', 'red', 'white', 'blue'];
        if (!validKouts.includes(profile_kout)) return res.status(400).json({ error: 'Estilo de kout inválido' });
        updateData.profile_kout = profile_kout;
      }
      if (profile_font !== undefined) {
        const validFonts = ['dmsans', 'orbitron', 'cinzel', 'bebas', 'marker', 'playfair', 'rajdhani', 'chakra', 'inter', 'spacegrotesk', 'fraunces', 'firacode', 'syne', 'caveat', 'syncopate', 'montserrat', 'pressstart', 'pixelify'];
        if (!validFonts.includes(profile_font)) return res.status(400).json({ error: 'Fonte inválida' });
        updateData.profile_font = profile_font;
      }
      if (profile_bg !== undefined) {
        const validBgStyles = ['vidro', 'blackout', 'offwhite', 'transparente'];
        if (!validBgStyles.includes(profile_bg)) return res.status(400).json({ error: 'Estilo de fundo inválido' });
        updateData.profile_bg = profile_bg;
      }
      if (profile_bg_opacity !== undefined) {
        const op = parseFloat(profile_bg_opacity);
        if (isNaN(op) || op < 0 || op > 100) return res.status(400).json({ error: 'Opacidade inválida.' });
        updateData.profile_bg_opacity = op;
      }
      if (profile_page_bg_opacity !== undefined) {
        const pop = parseFloat(profile_page_bg_opacity);
        if (isNaN(pop) || pop < 0 || pop > 100) return res.status(400).json({ error: 'Opacidade da página inválida.' });
        updateData.profile_page_bg_opacity = pop;
      }
      if (avatar_border !== undefined) {
        if (String(avatar_border).length > 30) return res.status(400).json({ error: 'Estilo de borda inválido.' });
        updateData.avatar_border = String(avatar_border).replace(/[^a-zA-Z0-9_-]/g, '');
      }
      if (profile_theme !== undefined) {
        if (String(profile_theme).length > 30) return res.status(400).json({ error: 'Tema inválido.' });
        updateData.profile_theme = String(profile_theme).replace(/[^a-zA-Z0-9_-]/g, '');
      }
      if (avatar_type !== undefined) {
        if (!['image', 'gif', 'none', 'photo', 'initial'].includes(avatar_type)) return res.status(400).json({ error: 'Tipo de avatar inválido.' });
        updateData.avatar_type = avatar_type;
      }
      if (avatar !== undefined) {
        if (typeof avatar !== 'string' || avatar.length > 2048) return res.status(400).json({ error: 'URL do avatar excede 2048 caracteres.' });
        if (avatar.startsWith('http')) {
          try {
            if (!isOwnAssetUrl(avatar)) return res.status(400).json({ error: 'Host de avatar não permitido.' });
          } catch(e) { return res.status(400).json({ error: 'URL de avatar inválida.' }); }
        }
        updateData.avatar = avatar.replace(/[<>"]/g, '');
      }
      if (estado !== undefined) {
        const validEstados = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO', 'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'];
        const estStr = String(estado).replace(/[<>]/g, '').trim();
        if (estStr !== '' && !validEstados.includes(estStr)) {
          return res.status(400).json({ error: 'Estado inválido. O backend só aceita estados oficiais.' });
        }
        updateData.estado = estStr;
      }
      if (cidade !== undefined) {
        if (typeof cidade !== 'string') return res.status(400).json({ error: 'Cidade deve ser texto.' });
        if (cidade.length > 50) return res.status(400).json({ error: 'A cidade deve ter no máximo 50 caracteres.' });
        updateData.cidade = cidade.replace(/[<>]/g, '');
      }
      if (genero !== undefined) {
        const genStr = String(genero).replace(/[<>]/g, '').trim().toLowerCase();
        if (genStr !== '' && genStr !== 'masculino' && genStr !== 'feminino') {
          return res.status(400).json({ error: 'O gênero só pode ser "masculino" ou "feminino".' });
        }
        updateData.genero = genStr;
      }
      if (customization_json !== undefined) {
        if (customization_json && typeof customization_json === 'object') {
          const strSize = JSON.stringify(customization_json).length;
          if (strSize > 150000) { // ~150KB limit
            return res.status(400).json({ error: 'O tamanho dos dados de customização excede o limite.' });
          }
          // Ignora frases personalizadas, o sistema agora usa apenas as originais
          if (customization_json.motiv_phrases !== undefined) {
            delete customization_json.motiv_phrases;
          }
        }
        updateData.customization_json = customization_json;
      }
      if (nascimento !== undefined) {
        if (nascimento) {
          let parsedDateStr = nascimento;
          if (nascimento.includes('/')) {
            const parts = nascimento.split('/');
            if (parts.length === 3) {
              parsedDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
          const birthDate = new Date(parsedDateStr);
          const age = new Date().getFullYear() - birthDate.getFullYear();
          if (isNaN(age) || age < 14 || age > 70) {
            return res.status(400).json({ error: 'Data de nascimento inválida. A idade deve estar entre 14 e 70 anos.' });
          }
          updateData.nascimento = parsedDateStr;
        } else {
          updateData.nascimento = null;
        }
      }


      const cleanUpdatePayload = filterUserPayload(updateData);
      let user;

      // PROTECAO BACKEND: Fetch currentUser and compare to only update changed fields
      if (currentUser) {
        for (const key of Object.keys(cleanUpdatePayload)) {
          if (key === 'customization_json') {
            if (JSON.stringify(cleanUpdatePayload[key]) === JSON.stringify(currentUser[key])) {
              delete cleanUpdatePayload[key];
            }
          } else {
            if (cleanUpdatePayload[key] === currentUser[key]) {
              delete cleanUpdatePayload[key];
            }
          }
        }
      }

      if (Object.keys(cleanUpdatePayload).length > 0) {
        const { data, error } = await supabase
          .from('users')
          .update(cleanUpdatePayload)
          .eq('id', userId)
          .select(filterUserFields('*'))
          .single();

        if (error) throw error;
        user = data;
      } else {
        const { data, error } = await supabase
          .from('users')
          .select(filterUserFields('*'))
          .eq('id', userId)
          .single();

        if (error) throw error;
        user = data;
      }

      res.json({
        message: 'Perfil de usuário atualizado com sucesso no Supabase!',
        user: formatUser(user)
      });
    } catch (err: any) {
      console.error('[Internal Error]', err);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }


  static async uploadAvatar(req: Request, res: Response) {
    res.status(501).json({ error: 'Funcionalidade não implementada.' });
  }

  static async disableMe(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const code = req.body.code;
      if (!code) return res.status(400).json({ error: 'Código de verificação é obrigatório.' });

      const { data: userRow } = await supabase.from('users').select('verification_code, verification_code_expires_at').eq('id', userId).maybeSingle();
      if (!userRow || !userRow.verification_code || new Date(userRow.verification_code_expires_at) < new Date()) {
        return res.status(400).json({ error: 'Código expirado ou inválido.' });
      }

      const digest = crypto.createHash('sha256').update(code.trim().toUpperCase()).digest();
      const expected = Buffer.from(userRow.verification_code, 'hex');
      if (digest.length !== expected.length || !crypto.timingSafeEqual(digest, expected)) {
        return res.status(400).json({ error: 'Código inválido.' });
      }

      // Limpa o código para não ser reusado
      await supabase.from('users').update({ verification_code: null, ativo: false }).eq('id', userId);

      // Revogar todas as sessões para forçar logout global
      await supabase
        .from('sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('revoked_at', null);

      invalidateAuthCache({ userId });
      res.clearCookie('refresh_token');
      res.json({ message: 'Conta desativada com sucesso.' });
    } catch (err: any) {
      console.error('[UserController.disableMe] Erro:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async deleteMe(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const code = req.body.code;
      if (!code) return res.status(400).json({ error: 'Código de verificação é obrigatório.' });

      const { data: userRow } = await supabase.from('users').select('verification_code, verification_code_expires_at').eq('id', userId).maybeSingle();
      if (!userRow || !userRow.verification_code || new Date(userRow.verification_code_expires_at) < new Date()) {
        return res.status(400).json({ error: 'Código expirado ou inválido.' });
      }

      const digest = crypto.createHash('sha256').update(code.trim().toUpperCase()).digest();
      const expected = Buffer.from(userRow.verification_code, 'hex');
      if (digest.length !== expected.length || !crypto.timingSafeEqual(digest, expected)) {
        return res.status(400).json({ error: 'Código inválido.' });
      }

      // Deletar os arquivos do Storage
      const { data: files } = await supabase.storage.from('uploads').list(userId);
      if (files && files.length > 0) {
        const filePaths = files.map(f => `${userId}/${f.name}`);
        await supabase.storage.from('uploads').remove(filePaths);
      }

      // Excluir conta
      const { error: delErr } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (delErr) throw delErr;

      invalidateAuthCache({ userId });
      res.clearCookie('refresh_token');
      res.json({ message: 'Conta excluída permanentemente.' });
    } catch (err: any) {
      console.error('[UserController.deleteMe] Erro:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async exportData(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const [
        { data: user },
        { data: tasks },
        { data: notes },
        { data: finances },
        { data: focus },
        { data: health },
        { data: study }
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('tasks').select('*').eq('user_id', userId),
        supabase.from('notes').select('*').eq('user_id', userId),
        supabase.from('finances').select('*').eq('user_id', userId),
        supabase.from('focus_sessions').select('*').eq('user_id', userId),
        supabase.from('health_logs').select('*').eq('user_id', userId),
        supabase.from('study_sessions').select('*').eq('user_id', userId)
      ]);

      const { senha, verification_code, verification_code_expires_at, code_attempts, code_resends, known_locations, storage_bytes, banido, suspeito, shadowban, failed_login_attempts, locked_until, ...safeUser } = (user || {}) as any;

      const exportData = {
        user: safeUser,
        tasks: tasks || [],
        notes: notes || [],
        finances: finances || [],
        focus: focus || [],
        health: health || [],
        study: study || []
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="minsq_export.json"');
      res.send(JSON.stringify(exportData, null, 2));
    } catch (err: any) {
      console.error('[UserController.exportData] Erro:', err.message);
      res.status(500).json({ error: 'Erro interno na exportação de dados.' });
    }
  }

  static async getPublicProfile(req: Request, res: Response) {
    const identifier = req.params.id || req.params.identifier;
    const callerId = (req as any).userId;
    try {
      // Remover account_number da lista pública (A5)
      const user = await UserController.resolveUserByIdentifier(
        identifier,
        'id, nome, handle, bio, streak, criado_em, tema, avatar, avatar_type, avatar_border, profile_theme, profile_page_bg, profile_page_bg_img, profile_kout, profile_font, profile_bg, profile_bg_opacity, profile_page_bg_opacity, social1, social2, perfil_publico, seguidores_count, seguindo_count'
      );

      if (user === 'invalid') {
        return res.status(400).json({ error: 'Identificador inválido.' });
      }
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      if (user.perfil_publico === false && user.id !== callerId) {
        let isAcceptedFollower = false;
        if (callerId) {
          const { data } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', callerId)
            .eq('following_id', user.id)
            .eq('status', 'accepted')
            .maybeSingle();
          if (data) isAcceptedFollower = true;
        }

        if (!isAcceptedFollower) {
          // Devolver apenas informações básicas se o perfil for privado
          return res.json({
            id: user.id,
            nome: user.nome,
            handle: user.handle,
            avatar: user.avatar,
            avatar_type: user.avatar_type,
            perfil_publico: false
          });
        }
      }

      res.json(formatUser(user));
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Helper interno: resolve um identificador de usuário (UUID OU @handle)
  // pra linha crua do banco, com os mesmos critérios de validação usados
  // em getPublicProfile. Reaproveitado por toda a mecânica de seguir pra
  // não duplicar (e não divergir) a lógica de resolução de identificador.
  // Retorna: 'invalid' (formato ruim), null (não encontrado) ou o registro.
  // ─────────────────────────────────────────────────────────────────────
  private static async resolveUserByIdentifier(identifier: any, fields: string): Promise<any | null | 'invalid'> {
    if (typeof identifier !== 'string' || identifier.length < 1 || identifier.length > 40) {
      return 'invalid';
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const selectFields = filterUserFields(fields);

    if (isUUID) {
      const { data, error } = await supabase
        .from('users')
        .select(selectFields)
        .eq('id', identifier)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    // Handles são sempre gravados em minúsculo (ver updateMe), então
    // normalizamos aqui pra URL funcionar independente de maiúsculas/minúsculas.
    const normalized = identifier.trim().toLowerCase();
    if (!/^@?[a-z0-9_.]{1,30}$/.test(normalized)) {
      return null;
    }

    if (existingColumns.includes('handle')) {
      const rawHandle = normalized.startsWith('@') ? normalized.slice(1) : normalized;
      const prefixedHandle = `@${rawHandle}`;

      const { data, error } = await supabase.from('users').select(selectFields)
        .in('handle', [prefixedHandle, rawHandle]).limit(1);
      if (error) throw error;
      if (data?.[0]) return data[0];
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────
  // MECÂNICA DE SEGUIR
  //
  // Regra de segurança que vale para TODOS os métodos abaixo: quem está
  // agindo (o "eu") vem sempre de req.userId, decodificado do JWT pelo
  // authMiddleware. Nunca é aceito um id de "quem está seguindo" vindo do
  // body ou de outro lugar controlado pelo cliente — só o alvo (quem vai
  // ser seguido/aceito/rejeitado) vem da URL, e mesmo assim sempre validado
  // contra o banco antes de qualquer escrita.
  // ─────────────────────────────────────────────────────────────────────

  static async followUser(req: Request, res: Response) {
    try {
      const myId = (req as any).userId;
      if (!myId) return res.status(401).json({ error: 'Não autorizado.' });

      const target = await UserController.resolveUserByIdentifier(req.params.id, 'id, perfil_publico');
      if (target === 'invalid') return res.status(400).json({ error: 'Identificador inválido.' });
      if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
      if (target.id === myId) return res.status(400).json({ error: 'Você não pode seguir a si mesmo.' });

      // Idempotente: se já existe uma relação (pending ou accepted), apenas
      // devolve o estado atual em vez de tentar recriar/alterar — evita que
      // um duplo clique derrube um follow já aceito de volta pra pending.
      const { data: existing, error: existingErr } = await supabase
        .from('follows')
        .select('status')
        .eq('follower_id', myId)
        .eq('followed_id', target.id)
        .maybeSingle();
      if (existingErr) throw existingErr;

      if (existing) {
        return res.json({ status: existing.status });
      }

      const status = target.perfil_publico === false ? 'pending' : 'accepted';
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: myId, followed_id: target.id, status });

      if (error) throw error;
      res.json({ status });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async unfollowUser(req: Request, res: Response) {
    try {
      const myId = (req as any).userId;
      if (!myId) return res.status(401).json({ error: 'Não autorizado.' });

      const target = await UserController.resolveUserByIdentifier(req.params.id, 'id');
      if (target === 'invalid') return res.status(400).json({ error: 'Identificador inválido.' });
      if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });

      // Serve tanto pra "deixar de seguir" (status accepted) quanto pra
      // "cancelar minha solicitação" (status pending) — sempre restrito à
      // minha própria relação (follower_id = myId).
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', myId)
        .eq('followed_id', target.id);

      if (error) throw error;
      res.json({ status: 'none' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async getFollowStatus(req: Request, res: Response) {
    try {
      const myId = (req as any).userId;
      if (!myId) return res.status(401).json({ error: 'Não autorizado.' });

      const target = await UserController.resolveUserByIdentifier(req.params.id, 'id');
      if (target === 'invalid') return res.status(400).json({ error: 'Identificador inválido.' });
      if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });

      if (target.id === myId) return res.json({ status: 'self' });

      const { data, error } = await supabase
        .from('follows')
        .select('status')
        .eq('follower_id', myId)
        .eq('followed_id', target.id)
        .maybeSingle();
      if (error) throw error;

      res.json({ status: data ? data.status : 'none' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  private static async listFollowConnections(req: Request, res: Response, direction: 'followers' | 'following') {
    try {
      const myId = (req as any).userId;
      if (!myId) return res.status(401).json({ error: 'Não autorizado.' });

      const target = await UserController.resolveUserByIdentifier(req.params.id, 'id, perfil_publico');
      if (target === 'invalid') return res.status(400).json({ error: 'Identificador inválido.' });
      if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });

      // Perfil privado: só o próprio dono OU seguidores aceitos enxergam a lista
      if (target.perfil_publico === false && target.id !== myId) {
        const { data: rel } = await supabase
          .from('follows')
          .select('status')
          .eq('follower_id', myId)
          .eq('followed_id', target.id)
          .single();

        if (!rel || rel.status !== 'accepted') {
          return res.status(403).json({ error: 'Este perfil é privado.' });
        }
      }

      const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10) || 30, 1), 50);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const relationColumn = direction === 'followers' ? 'followed_id' : 'follower_id';
      const otherColumn = direction === 'followers' ? 'follower_id' : 'followed_id';

      const { data: rows, error } = await supabase
        .from('follows')
        .select(otherColumn)
        .eq(relationColumn, target.id)
        .eq('status', 'accepted')
        .order('criado_em', { ascending: false })
        .range(from, to);
      if (error) throw error;

      const ids = (rows || []).map((r: any) => r[otherColumn]);
      if (ids.length === 0) return res.json([]);

      const { data: users, error: uErr } = await supabase
        .from('users')
        .select(filterUserFields('id, nome, handle, avatar, avatar_type, avatar_border'))
        .in('id', ids);
      if (uErr) throw uErr;

      res.json((users || []).map(formatUser));
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async listFollowers(req: Request, res: Response) {
    return UserController.listFollowConnections(req, res, 'followers');
  }

  static async listFollowing(req: Request, res: Response) {
    return UserController.listFollowConnections(req, res, 'following');
  }

  static async listFollowRequests(req: Request, res: Response) {
    try {
      const myId = (req as any).userId;
      if (!myId) return res.status(401).json({ error: 'Não autorizado.' });

      const page = parseInt(String(req.query.page || '1'), 10) || 1;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10) || 30, 1), 50);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: rows, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('followed_id', myId)
        .eq('status', 'pending')
        .order('criado_em', { ascending: false })
        .range(from, to);
      if (error) throw error;

      const ids = (rows || []).map((r: any) => r.follower_id);
      if (ids.length === 0) return res.json([]);

      const { data: users, error: uErr } = await supabase
        .from('users')
        .select(filterUserFields('id, nome, handle, avatar, avatar_type'))
        .in('id', ids);
      if (uErr) throw uErr;

      res.json((users || []).map(formatUser));
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async acceptFollowRequest(req: Request, res: Response) {
    try {
      const myId = (req as any).userId; // sempre do token, nunca do param
      if (!myId) return res.status(401).json({ error: 'Não autorizado.' });
      const { followerId } = req.params;

      // Trava de segurança: só localiza (e só depois altera) um pedido cujo
      // followed_id seja exatamente o dono do token. Isso impede que o
      // usuário A aceite/rejeite um pedido dirigido ao usuário B, mesmo que
      // A descubra o followerId de outra pessoa.
      const { data: pedido, error: findErr } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', followerId)
        .eq('followed_id', myId)
        .eq('status', 'pending')
        .maybeSingle();
      if (findErr) throw findErr;
      if (!pedido) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const { error } = await supabase
        .from('follows')
        .update({ status: 'accepted' })
        .eq('follower_id', followerId)
        .eq('followed_id', myId);
      if (error) throw error;

      res.json({ status: 'accepted' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async rejectFollowRequest(req: Request, res: Response) {
    try {
      const myId = (req as any).userId; // sempre do token, nunca do param
      if (!myId) return res.status(401).json({ error: 'Não autorizado.' });
      const { followerId } = req.params;

      const { data: pedido, error: findErr } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', followerId)
        .eq('followed_id', myId)
        .eq('status', 'pending')
        .maybeSingle();
      if (findErr) throw findErr;
      if (!pedido) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('followed_id', myId);
      if (error) throw error;

      res.json({ status: 'none' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // --- Gerenciamento de Sessões ---

  static async getSessions(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      // O authMiddleware normalmente anexa o sessionId ao request se for uma rota autenticada stateful
      // Caso contrário, precisaremos obter do token de alguma forma. Assumindo que authMiddleware coloca em req.sessionId
      const currentSessionId = (req as any).sessionId;

      const { data: sessions, error } = await supabase
        .from('sessions')
        .select('id, created_at, last_used_at, ip_address, user_agent')
        .eq('user_id', userId)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('last_used_at', { ascending: false });

      if (error) throw error;

      // Marcar a sessão atual
      const result = (sessions || []).map(s => ({
        ...s,
        is_current: s.id === currentSessionId
      }));

      res.json(result);
    } catch (err: any) {
      console.error('[UserController.getSessions] Erro:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async revokeSession(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { sessionId } = req.params;

      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const { error } = await supabase
        .from('sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .is('revoked_at', null);

      if (error) throw error;
      invalidateAuthCache({ sessionId });

      res.json({ message: 'Sessão encerrada com sucesso.' });
    } catch (err: any) {
      console.error('[UserController.revokeSession] Erro:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async revokeAllSessions(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const currentSessionId = (req as any).sessionId;

      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      let query = supabase
        .from('sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('revoked_at', null);

      // Não revogar a própria sessão atual, se estiver disponível
      if (currentSessionId) {
        query = query.neq('id', currentSessionId);
      }

      const { error } = await query;
      if (error) throw error;
      invalidateAuthCache({ userId, exceptSessionId: currentSessionId });

      res.json({ message: 'Todas as outras sessões foram encerradas com sucesso.' });
    } catch (err: any) {
      console.error('[UserController.revokeAllSessions] Erro:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
