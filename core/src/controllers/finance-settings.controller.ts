import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export class FinanceSettingsController {
  static async get(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      const { data, error } = await supabase
        .from('finance_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Return defaults if not created yet
        return res.json({
          user_id: userId,
          inv_toggle_on: false,
          inv_pct_mes: 0.00,
          inv_meta_aporte: 0.00,
          art_mode: 'padrao',
          renda_fixa_cfg: null,
          art_presets: []
        });
      }

      res.json(data);
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async upsert(req: Request, res: Response) {
    const { inv_toggle_on, inv_pct_mes, inv_meta_aporte, art_mode, renda_fixa_cfg, art_presets } = req.body;
    try {
      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado.' });
      }

      // Validations
      if (inv_pct_mes !== undefined) {
        const pct = parseFloat(inv_pct_mes);
        if (isNaN(pct) || pct < 0 || pct > 20) {
          return res.status(400).json({ error: 'Porcentagem de rendimento deve ser entre 0 e 20% a.m.' });
        }
      }

      if (inv_meta_aporte !== undefined) {
        const meta = parseFloat(inv_meta_aporte);
        if (isNaN(meta) || meta < 0) {
          return res.status(400).json({ error: 'Meta de aporte inválida.' });
        }
      }

      if (art_presets !== undefined) {
        if (!Array.isArray(art_presets) || art_presets.length > 3) {
          return res.status(400).json({ error: 'Limite de presets atingido (máx 3).' });
        }
        
        const presetNames = new Set<string>();
        for (const preset of art_presets) {
          if (!preset.name || typeof preset.name !== 'string' || preset.name.length < 2 || preset.name.length > 30) {
            return res.status(400).json({ error: 'O nome do preset deve ter entre 2 e 30 caracteres.' });
          }
          if (!/^[a-zA-Z0-9\sÀ-ÿ]+$/.test(preset.name)) {
            return res.status(400).json({ error: `O nome do preset '${preset.name}' não pode conter caracteres especiais.` });
          }
          if (presetNames.has(preset.name.toLowerCase())) {
            return res.status(400).json({ error: `Já existe um preset com o nome '${preset.name}'.` });
          }
          presetNames.add(preset.name.toLowerCase());
          
          let totalCards = 0;
          let totalPct = 0;
          const cardNames = new Set<string>();

          if (preset.categs && Array.isArray(preset.categs)) {
            totalCards += preset.categs.length;
            for (const card of preset.categs) {
              if (!card.name || typeof card.name !== 'string' || card.name.length < 2 || card.name.length > 36) {
                return res.status(400).json({ error: 'O nome do card deve ter entre 2 e 36 caracteres.' });
              }
              if (!/^[a-zA-Z0-9\sÀ-ÿ]+$/.test(card.name)) {
                return res.status(400).json({ error: `O card '${card.name}' não pode conter caracteres especiais no nome.` });
              }
              if (cardNames.has(card.name.toLowerCase())) {
                return res.status(400).json({ error: `Nome de card duplicado: '${card.name}'.` });
              }
              cardNames.add(card.name.toLowerCase());
              
              if (!card.desc || typeof card.desc !== 'string' || card.desc.length < 3 || card.desc.length > 60) {
                return res.status(400).json({ error: `A descrição do card '${card.name}' deve ter entre 3 e 60 caracteres.` });
              }
              if (!/^[a-zA-Z0-9\sÀ-ÿ,.]*$/.test(card.desc)) {
                return res.status(400).json({ error: `A descrição do card '${card.name}' não pode conter caracteres especiais.` });
              }
              
              const pct = parseFloat(card.pct);
              if (isNaN(pct) || pct < 2 || pct > 98) {
                return res.status(400).json({ error: `A porcentagem do card '${card.name}' deve estar entre 2% e 98%.` });
              }
              totalPct += pct;
            }
          }

          if (preset.investment && typeof preset.investment === 'object') {
            totalCards += 1;
            const inv = preset.investment;
            
            // Name validation for investment card as well, if we treat it as a card that needs unique name check
            const invName = inv.name || 'Investimentos';
            if (invName.length < 2 || invName.length > 36) return res.status(400).json({ error: 'Nome do card de investimento inválido.' });
            if (cardNames.has(invName.toLowerCase())) return res.status(400).json({ error: `Nome de card duplicado: '${invName}'.` });
            cardNames.add(invName.toLowerCase());

            const desc = inv.desc || '';
            if (desc.length < 3 || desc.length > 60) return res.status(400).json({ error: 'A descrição do card de investimento deve ter entre 3 e 60 caracteres.' });

            const pct = parseFloat(inv.pct);
            if (isNaN(pct) || pct < 2 || pct > 98) {
              return res.status(400).json({ error: `A porcentagem do card de investimento deve estar entre 2% e 98%.` });
            }
            totalPct += pct;

            const yieldPct = parseFloat(inv.rate);
            if (!isNaN(yieldPct) && (yieldPct < 0.01 || yieldPct > 40)) {
              return res.status(400).json({ error: 'O rendimento esperado deve estar entre 0.01% e 40%.' });
            }
          }

          if (totalCards > 10) {
            return res.status(400).json({ error: `O preset '${preset.name}' tem ${totalCards} cards, excedendo o limite de 10.` });
          }

          // Tolerate slight floating point inaccuracies, but strictly require 98%
          if (Math.abs(totalPct - 98) > 0.01) {
            return res.status(400).json({ error: `A distribuição do preset '${preset.name}' deve somar exatamente 98% (atual: ${totalPct}%).` });
          }
        }
      }

      if (renda_fixa_cfg !== undefined && renda_fixa_cfg !== null) {
        if (typeof renda_fixa_cfg !== 'object') return res.status(400).json({ error: 'Configuração de renda fixa inválida.' });
        const val = parseFloat(renda_fixa_cfg.valor);
        if (isNaN(val) || val < 50 || val > 900000) {
          return res.status(400).json({ error: 'O valor da renda fixa deve estar entre R$ 50 e R$ 900.000.' });
        }
        const dia = parseInt(renda_fixa_cfg.dia);
        if (isNaN(dia) || dia < 1 || dia > 28) {
          return res.status(400).json({ error: 'O dia de renovação da renda fixa deve ser entre 1 e 28.' });
        }
      }

      const { data, error } = await supabase
        .from('finance_settings')
        .upsert({
          user_id: userId,
          inv_toggle_on: inv_toggle_on !== false && !!inv_toggle_on,
          inv_pct_mes: inv_pct_mes !== undefined ? parseFloat(inv_pct_mes) : 0.00,
          inv_meta_aporte: inv_meta_aporte !== undefined ? parseFloat(inv_meta_aporte) : 0.00,
          art_mode: art_mode || 'padrao',
          renda_fixa_cfg: renda_fixa_cfg || null,
          art_presets: art_presets || []
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      res.json({
        message: 'Configurações financeiras salvas com sucesso!',
        settings: data
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }
}
