import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export class SupportController {
  // Lista todos os tickets do usuário logado
  static async listTickets(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      const { data: tickets, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      res.json(tickets || []);
    } catch (err: any) {
      console.error('[SupportController.listTickets] Erro:', err.message);
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // Cria um ticket autenticado associado ao usuário logado
  static async createTicket(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      const { nome, email_contato, assunto, mensagem } = req.body;

      if (!email_contato || !assunto || !mensagem) {
        return res.status(400).json({ error: 'E-mail de contato, assunto e mensagem são obrigatórios.' });
      }

      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: userId,
          nome: nome || null,
          email_contato,
          assunto,
          mensagem,
          status: 'aberto',
          lido: false
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        message: 'Ticket de suporte aberto com sucesso no banco de dados.',
        ticket
      });
    } catch (err: any) {
      console.error('[SupportController.createTicket] Erro:', err.message);
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  // Envio de contato público (sem autenticação)
  static async publicContact(req: Request, res: Response) {
    try {
      const { nome, email_contato, assunto, mensagem } = req.body;

      if (!email_contato || !assunto || !mensagem) {
        return res.status(400).json({ error: 'E-mail de contato, assunto e mensagem são obrigatórios.' });
      }

      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: null,
          nome: nome || null,
          email_contato,
          assunto,
          mensagem,
          status: 'aberto',
          lido: false
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        message: `Mensagem de contato recebida de ${email_contato} no banco de dados. Retornaremos em breve.`,
        ticket
      });
    } catch (err: any) {
      console.error('[SupportController.publicContact] Erro:', err.message);
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
