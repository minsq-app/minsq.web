import { z } from 'zod';

export const studySettingsSchema = z.object({
  daily_goal_min: z.number().int().min(0).max(1080).optional().nullable(),
  lifetime_stats: z.any().optional().nullable(),
  pomodoros_today: z.number().int().min(0).max(100).optional().nullable(),
  pomodoro_date: z.string().optional().nullable()
});

export const studyTrackSchema = z.object({
  track_id: z.string().uuid("ID inválido").or(z.string().max(50)),
  name: z.string().min(2, "Mínimo 2 caracteres").max(38, "Máximo de 38 caracteres").regex(/^[a-zA-Z0-9À-ÿ\s\-_]+$/, "Sem caracteres especiais"),
  icon: z.string().max(50000, "Ícone muito grande").optional().nullable(),
  description: z.string().max(25, "Máximo de 25 caracteres").optional().nullable()
});

export const studyNoteSchema = z.object({
  note_id: z.string().max(50),
  subject: z.string().max(100).optional().nullable(),
  content: z.string().max(10000),
  criado_em: z.string().optional().nullable(),
  editado_em: z.string().optional().nullable()
});

export const studyPlanSchema = z.object({
  track_id: z.string().max(50),
  modules: z.array(z.object({
    id: z.string().max(50),
    name: z.string().min(3, "Mínimo 3 caracteres").max(58, "Máximo 58 caracteres").regex(/^[a-zA-Z0-9À-ÿ\s\-_.,:;!?ºª°()\/]+$/, "Caractere não permitido no módulo"),
    collapsed: z.boolean().optional(),
    tasks: z.array(z.object({
      text: z.string().min(3, "Mínimo 3 caracteres").max(58, "Máximo 58 caracteres").regex(/^[^<>]+$/, "Caracteres HTML (< ou >) não permitidos"),
      done: z.boolean().optional()
    })).max(20, "Máximo de 20 tópicos por módulo").optional()
  })).max(30, "Máximo de 30 módulos por matéria").optional().nullable()
});

export const studySessionSchema = z.object({
  trilha: z.string().max(50).optional().nullable(),
  descricao: z.string().max(255).optional().nullable(),
  duracao_min: z.union([z.number().int().min(20, "Mínimo 20 minutos").max(1440), z.string().regex(/^\d+$/).transform(val => Number(val))]),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)").optional().nullable()
});

export const recurringBillSchema = z.object({
  bill_id: z.string().max(50).optional(),
  descricao: z.string().max(100).optional(),
  valor: z.union([z.number(), z.string().regex(/^\d+(\.\d{1,2})?$/)]).transform(val => Number(val)).optional(),
  dia: z.union([z.number().int().min(1).max(28), z.string().regex(/^\d+$/).transform(val => Number(val))]).optional(),
  modo: z.enum(['descontar', 'notificar']).optional(),
  fonte: z.string().max(100).optional().nullable(),
  parcelas: z.union([z.number().int(), z.string().regex(/^\d+$/)]).optional().nullable(),
  parcelas_pagas: z.union([z.number().int(), z.string().regex(/^\d+$/)]).optional().nullable(),
  infinito: z.boolean().or(z.string().transform(val => val === 'true')).optional().nullable(),
  mes_inicio: z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM").optional().nullable()
});

export const supportTicketSchema = z.object({
  nome: z.string().min(1).max(100),
  email_contato: z.string().email("E-mail inválido").max(100),
  assunto: z.string().min(1).max(100),
  mensagem: z.string().min(1).max(2000)
});

export const routineSchema = z.object({
  hora: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Hora inválida. Use HH:MM (horas 00-23, minutos 00-59)."),
  titulo: z.string().min(3, "Mínimo de 3 caracteres").max(40, "Máximo de 40 caracteres"),
  dias_semana: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  preset: z.number().int().min(1).max(4).optional().nullable()
});

export const routinePresetSchema = z.object({
  preset: z.number().int().min(1).max(4)
});

export const routineDeleteMultipleSchema = z.object({
  ids: z.array(z.string())
});

export const financeSettingsSchema = z.object({
  inv_toggle_on: z.boolean().optional().nullable(),
  inv_pct_mes: z.number().min(0).max(100).optional().nullable(),
  inv_meta_aporte: z.number().min(0).optional().nullable(),
  art_mode: z.string().max(50).optional().nullable(),
  renda_fixa_cfg: z.any().optional().nullable(),
  art_presets: z.any().optional().nullable()
});
