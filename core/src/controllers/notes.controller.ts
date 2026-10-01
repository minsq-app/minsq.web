import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// Helper to get or create a mock user

// Helper to format DB note to client format
function formatNote(n: any) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    tags: n.tags || [],
    pinned: n.pinned,
    deleted: n.deleted,
    deletedAt: n.deleted_at ? new Date(n.deleted_at).getTime() : undefined,
    created: new Date(n.created_at).getTime(),
    updated: new Date(n.updated_at).getTime()
  };
}

export class NotesController {
  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      // Limpeza passiva da lixeira (notas há mais de 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      await supabase
        .from('notes')
        .delete()
        .eq('user_id', userId)
        .eq('deleted', true)
        .lt('deleted_at', thirtyDaysAgo.toISOString());

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      res.json((data || []).map(formatNote));
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async upsert(req: Request, res: Response) {
    const { id, title, body, tags, pinned, deleted, deletedAt, created } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      if (!id) {
        return res.status(400).json({ error: 'Note ID is required.' });
      }

      // Validações de tamanho e limites de string/array (Espelhando o Frontend)
      if (title && typeof title === 'string' && title.length > 46) {
        return res.status(400).json({ error: 'O título não pode ter mais que 46 caracteres.' });
      }

      if (body && typeof body === 'string' && body.length > 15000) { // 15000 permite HTML estruturado com margem segura
        return res.status(400).json({ error: 'O conteúdo da nota excedeu o limite máximo.' });
      }

      if (tags) {
        if (!Array.isArray(tags)) {
          return res.status(400).json({ error: 'Formato de tags inválido.' });
        }
        if (tags.length > 3) {
          return res.status(400).json({ error: 'Máximo de 3 tags por nota.' });
        }
        for (const t of tags) {
          if (typeof t !== 'string' || t.length > 35) {
            return res.status(400).json({ error: 'Cada tag deve ter no máximo 35 caracteres.' });
          }
        }
      }

      // Removed old global ID ownership check to prevent race conditions.
      // With the new (user_id, id) composite PK, conflicts are securely handled per user.
      const { data: existingNote } = await supabase
        .from('notes')
        .select('id, user_id, pinned, deleted')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();

      const isNewNote = !existingNote;

      // 1. Bloqueio de 20 notas: Se for uma nota nova (e não deletada) OU se for uma nota existente sendo restaurada (deleted: false)
      if (!deleted && (isNewNote || existingNote.deleted)) {
        const { count: activeCount } = await supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('deleted', false);
          
        if (activeCount !== null && activeCount >= 20) {
          return res.status(400).json({ error: 'Limite máximo de 20 notas atingido.' });
        }
      }

      // 2. Bloqueio de 6 notas na Lixeira: Se estiver indo para a lixeira (nova já deletada, ou existente sendo apagada via upsert)
      if (deleted && (isNewNote || !existingNote.deleted)) {
        const { count: trashCount } = await supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('deleted', true);
          
        if (trashCount !== null && trashCount >= 6) {
          return res.status(400).json({ error: 'TRASH_FULL' });
        }
      }

      if (pinned && (!existingNote || !existingNote.pinned)) {
        const { count: pinnedCount } = await supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('pinned', true)
          .eq('deleted', false);
          
        if (pinnedCount !== null && pinnedCount >= 5) {
          return res.status(400).json({ error: 'Limite máximo de 5 notas favoritas atingido.' });
        }
      }

      const payload: any = {
        id,
        user_id: userId,
        title: title || '',
        body: purify.sanitize(body || ''),
        tags: tags || [],
        pinned: !!pinned,
        deleted: !!deleted,
        deleted_at: deletedAt ? new Date(deletedAt).toISOString() : null,
        updated_at: new Date().toISOString()
      };

      if (created) {
        payload.created_at = new Date(created).toISOString();
      }

      const { data, error } = await supabase
        .from('notes')
        .upsert(payload, { onConflict: 'user_id,id' })
        .select()
        .single();

      if (error) throw error;
      res.json({
        message: 'Nota salva com sucesso no Supabase!',
        note: formatNote(data)
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async delete(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      
      // Checar limite da lixeira
      const { count: trashCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('deleted', true);
        
      if (trashCount !== null && trashCount >= 6) {
        return res.status(400).json({ error: 'TRASH_FULL' });
      }

      const { data, error } = await supabase
        .from('notes')
        .update({
          deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      res.json({
        message: 'Nota movida para a lixeira.',
        note: formatNote(data)
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async restore(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }

      // Checar limite de notas ativas ao restaurar
      const { count: activeCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('deleted', false);
        
      if (activeCount !== null && activeCount >= 20) {
        return res.status(400).json({ error: 'Você já possui o máximo de 20 notas ativas. Não é possível restaurar.' });
      }

      const { data, error } = await supabase
        .from('notes')
        .update({
          deleted: false,
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      res.json({
        message: 'Nota restaurada com sucesso.',
        note: formatNote(data)
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async purge(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      res.json({ message: 'Nota excluída permanentemente.' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async emptyTrash(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) { return res.status(401).json({ error: 'Não autorizado.' }); }
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('deleted', true)
        .eq('user_id', userId);

      if (error) throw error;
      res.json({ message: 'Lixeira esvaziada com sucesso.' });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
