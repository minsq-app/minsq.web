import { z } from 'zod';

// Hora no formato HH:MM (00:00–23:59). Minutos só de 00 a 59.
export const HORA_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const taskSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório").max(100, "Máximo de 100 caracteres"),
  descricao: z.string().max(500, "Máximo de 500 caracteres").optional().nullable(),
  categoria: z.string().max(50, "Máximo de 50 caracteres").optional().nullable(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)").optional().nullable(),
  prioridade: z.enum(['nenhuma', 'muito_alta', 'alta', 'media', 'pouca', 'opcional', 'baixa']).optional().nullable(),
  concluida: z.boolean().optional().nullable(),
  hora: z.union([z.string().regex(HORA_REGEX, "Hora inválida. Use HH:MM (horas 00-23, minutos 00-59)."), z.literal('')]).optional().nullable(),
  duracao: z.string().optional().nullable()
});

export const financeSchema = z.object({
  tipo: z.enum(['entrada', 'saida', 'investimento', 'contas']),
  valor: z.union([z.number(), z.string().regex(/^\d+(\.\d{1,2})?$/)]).transform(val => Number(val)),
  categoria: z.string().max(50, "Máximo de 50 caracteres").optional().nullable(),
  descricao: z.string().max(255, "Máximo de 255 caracteres").optional().nullable(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)").optional().nullable()
});

export const noteSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
  title: z.string()
    .max(46, "Máximo de 46 caracteres")
    .optional().nullable(),
  body: z.string()
    .max(15000, "Anotação excede o limite máximo permitido pelo sistema")
    .optional().nullable(),
  tags: z.array(
    z.string()
      .max(35, "A tag excede 35 caracteres")
  ).max(3, "Máximo de 3 tags permitidas").optional().nullable(),
  pinned: z.boolean().optional().nullable(),
  deleted: z.boolean().optional().nullable(),
  deletedAt: z.number().optional().nullable(),
  created: z.number().optional().nullable(),
  updated: z.number().optional().nullable()
});

// workout_weeks e diet_config são estruturas aninhadas (arrays/objetos/números), então
// z.record(string, string) rejeitava QUALQUER save. A validação detalhada (nomes, limites,
// macros) fica no HealthController.saveSettings; aqui só garantimos forma e tamanho.
const MAX_JSON_BYTES = 200_000;
const withinSize = (v: unknown) => JSON.stringify(v ?? null).length <= MAX_JSON_BYTES;

export const healthSettingsSchema = z.object({
  workout_weeks: z.array(z.object({}).passthrough()).max(6, "Máximo de 6 semanas")
    .refine(withinSize, "Dados de treino grandes demais").optional(),
  diet_config: z.object({
    days: z.array(z.object({}).passthrough()).max(7, "Máximo de 7 dietas").optional(),
    refeicoesPorDia: z.number().int().min(0).max(8).optional()
  }).passthrough().refine(withinSize, "Dados de dieta grandes demais").optional(),
  water_goal: z.number().min(0.5).max(10000).optional(),
  weight_goal: z.number().min(40.0).max(140.0).optional().nullable()
});

export const healthLogSchema = z.object({
  tipo: z.enum(['treino', 'peso', 'agua']),
  dados: z.record(z.string().max(20), z.union([z.string().max(100), z.number()])).optional().nullable(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)").optional().nullable()
});

export const focusSchema = z.object({
  duracao_min: z.number().int().min(1, "Mínimo de 1 min").max(1080, "Máximo de 1080 min").or(z.string().regex(/^\d+$/).transform(val => Number(val))),
  categoria: z.string().max(50).optional().nullable(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)").optional().nullable()
});

export const mindmapSchema = z.object({
  map_id: z.string().max(50, "ID longo demais"),
  title: z.string().max(36, "Máximo de 36 caracteres").optional().nullable(),
  layout: z.string().optional().nullable(),
  pan: z.any().optional(),
  scale: z.number().optional(),
  photo: z.string().max(1000).refine(val => {
    if (!val) return true;
    try {
      const u = new URL(val);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, "URL inválida").optional().nullable(),
  nodes: z.array(
    // O front monta cada nó com { id, parentId, text, color, collapsed, x, y } e o layout
    // ainda adiciona `w`. Antes o schema era .strict() e não conhecia parentId/collapsed/w,
    // então QUALQUER criação/edição de plano de ação voltava 400 "Dados inválidos".
    // Campos desconhecidos agora são descartados (strip) em vez de derrubar a requisição.
    z.object({
      id: z.string().max(50).optional(),
      parentId: z.string().max(50).optional().nullable(),
      text: z.string().max(52, "Máximo de 52 caracteres por badge").optional().nullable().or(z.literal('')),
      type: z.string().max(20).optional().nullable(),
      color: z.string().max(20).optional().nullable(),
      collapsed: z.boolean().optional().nullable(),
      x: z.number().optional().nullable(),
      y: z.number().optional().nullable(),
      w: z.number().optional().nullable(),
      h: z.number().optional().nullable(),
      width: z.number().optional().nullable(),
      height: z.number().optional().nullable()
    })
  ).max(150, "Máximo de 150 nós por plano de ação").optional().nullable(),
});

export const addictionSchema = z.object({
  addiction_id: z.string().max(100),
  nome: z.string().min(4, "Mínimo de 4 caracteres").max(38, "Máximo de 38 caracteres"),
  desc_text: z.string().min(0, "Mínimo de 0 caracteres").max(80, "Máximo de 80 caracteres").optional().nullable(),
  started_at: z.string().optional()
});

export const addictionUpdateSchema = z.object({
  nome: z.string().min(4, "Mínimo de 4 caracteres").max(38, "Máximo de 38 caracteres"),
  desc_text: z.string().min(0, "Mínimo de 0 caracteres").max(80, "Máximo de 80 caracteres").optional().nullable(),
  started_at: z.string().optional()
});

export const planActionSchema = z.object({
  cat_id: z.string().max(50, "ID longo demais"),
  name: z.string().min(1, "Nome obrigatório").max(28, "Máximo de 28 caracteres"),
  photo_url: z.string().max(2000).refine(val => {
    if (!val) return true;
    try {
      const u = new URL(val);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, "URL inválida").optional().nullable(),
  desc: z.string().max(1000, "Máximo de 1000 caracteres").optional().nullable(),
  desc_align: z.string().optional().nullable()
});

