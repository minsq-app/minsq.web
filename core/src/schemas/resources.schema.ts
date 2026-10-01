import { z } from 'zod';

export const taskSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório").max(100, "Máximo de 100 caracteres"),
  descricao: z.string().max(500, "Máximo de 500 caracteres").optional().nullable(),
  categoria: z.string().max(50, "Máximo de 50 caracteres").optional().nullable(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)").optional().nullable(),
  prioridade: z.enum(['nenhuma', 'muito_alta', 'alta', 'media', 'pouca', 'opcional', 'baixa']).optional().nullable(),
  concluida: z.boolean().optional().nullable(),
  hora: z.string().optional().nullable(),
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

export const healthSettingsSchema = z.object({
  workout_weeks: z.array(z.record(z.string().max(20), z.string().max(50))).max(6, "Máximo de 6 semanas").optional(),
  diet_config: z.record(z.string().max(20), z.string().max(50)).optional(),
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
    z.object({
      id: z.string().max(50).optional(),
      text: z.string().max(52, "Máximo de 52 caracteres por badge").optional().or(z.literal('')),
      type: z.string().max(20).optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      color: z.string().max(20).optional()
    }).strict()
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
