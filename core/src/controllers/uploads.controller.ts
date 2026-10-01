import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import sharp from 'sharp';

export class UploadsController {
  static async uploadFile(req: Request, res: Response) {
    try {
      const file = req.file;
      const folder = (req.body.folder || req.query.folder || 'general') as string;

      if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }

      const userId = (req as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
      }

      // Quota check moved to after processing

      if (folder === 'herobgs') {
        return res.status(403).json({ error: 'O upload de imagens para fundo de perfil foi desativado em favor de estilos nativos.' });
      }

      if (folder === 'banners' || folder === 'music') {
        return res.status(403).json({ error: 'O upload de mídia (GIF/Música) foi desativado do perfil.' });
      }

      // Sanitize folder name to prevent path traversal
      if (!/^[a-zA-Z0-9_-]+$/.test(folder)) {
        return res.status(400).json({ error: 'Nome de pasta/categoria de upload inválido.' });
      }

      const allowedMimeTypes: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
      };

      if (!allowedMimeTypes[file.mimetype]) {
        return res.status(400).json({ error: 'Formato de arquivo inválido. Apenas JPEG, PNG e WEBP são permitidos.' });
      }

      // Segurança avançada: Verificar Magic Bytes para garantir que o arquivo não é malicioso
      const buffer = file.buffer;
      if (!buffer || buffer.length < 12) {
        return res.status(400).json({ error: 'Arquivo corrompido ou muito pequeno.' });
      }

      let isRealImage = false;
      // JPEG: FF D8 FF
      if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        isRealImage = true;
      }
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        isRealImage = true;
      }
      // WEBP: RIFF...WEBP
      else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
               buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        isRealImage = true;
      }

      if (!isRealImage) {
        return res.status(400).json({ error: 'O conteúdo do arquivo não corresponde a uma imagem válida. Possível arquivo malicioso.' });
      }

      const allowedFolders = ['avatars', 'category-covers', 'mindmap-covers', 'pagebgs', 'general', 'backgrounds'];
      if (!allowedFolders.includes(folder)) {
        return res.status(400).json({ error: 'Pasta de upload não permitida.' });
      }

      if (folder === 'avatars') {
        if (file.size > 2097152) {
          return res.status(400).json({ error: 'A foto de perfil deve ter no máximo 2MB.' });
        }
      } else if (folder === 'category-covers' || folder === 'mindmap-covers') {
        if (file.size < 8192) {
          return res.status(400).json({ error: 'A foto deve ter no mínimo 8KB.' });
        }
        if (file.size > 2097152) {
          return res.status(400).json({ error: 'A foto deve ter no máximo 2MB.' });
        }
        if (file.mimetype === 'image/webp') {
          return res.status(400).json({ error: 'Formato de arquivo inválido. Apenas JPEG e PNG são permitidos.' });
        }
      } else if (folder === 'pagebgs' || folder === 'backgrounds') {
        if (file.size > 3145728) {
          return res.status(400).json({ error: 'A imagem de fundo deve ter no máximo 3MB.' });
        }
      } else if (folder === 'general') {
        if (file.size > 2097152) {
          return res.status(400).json({ error: 'A imagem genérica deve ter no máximo 2MB.' });
        }
      }

      // Processar com sharp (remove EXIF/GPS, normaliza formato)
      const processedBuffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();

      const filename = `${userId}/${folder}/${Date.now()}_img.webp`;

      console.log(`[Supabase Storage] Uploading ${filename} (${processedBuffer.length} bytes)...`);

      // Reserve storage
      const { data: okQuota } = await supabase.rpc('reserve_storage', { p_user: userId, p_bytes: processedBuffer.length, p_limit: 200 * 1024 * 1024 });
      if (!okQuota) return res.status(413).json({ error: 'Cota de armazenamento excedida (limite 200MB).' });

      // Upload file buffer to Supabase Storage 'uploads' bucket
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filename, processedBuffer, {
          contentType: 'image/webp',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('[Supabase Storage] Upload error:', uploadError.message);
        await supabase.rpc('increment_storage', { user_id: userId, bytes_to_add: -processedBuffer.length });
        throw uploadError;
      }

      // Retrieve the public URL
      const { data: publicUrlObj } = supabase.storage
        .from('uploads')
        .getPublicUrl(filename);

      res.status(201).json({
        message: 'Arquivo carregado com sucesso!',
        url: publicUrlObj.publicUrl,
        path: filename,
        size: processedBuffer.length
      });
    } catch (err: any) {
      console.error('[Internal Error]', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  }

  static async deleteFile(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { path } = req.body;
      
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });
      if (!path || typeof path !== 'string' || !path.startsWith(`${userId}/`)) {
        return res.status(400).json({ error: 'Caminho de arquivo inválido.' });
      }
      if (path.split('/').includes('..')) {
        return res.status(400).json({ error: 'Caminho de arquivo inválido.' });
      }

      // Pegar tamanho antes de deletar
      const { data: listData } = await supabase.storage.from('uploads').list(`${userId}/${path.split('/')[1]}`, {
        search: path.split('/').pop()
      });
      
      const fileMeta = listData?.find(f => f.name === path.split('/').pop());
      
      const { error: rmErr } = await supabase.storage.from('uploads').remove([path]);
      if (rmErr) throw rmErr;

      // Devolve a cota
      if (fileMeta?.metadata?.size) {
        await supabase.rpc('increment_storage', {
          user_id: userId,
          bytes_to_add: -(fileMeta.metadata.size)
        });
      }

      res.json({ message: 'Arquivo removido.' });
    } catch (err: any) {
      console.error('[Delete Error]', err.message);
      res.status(500).json({ error: 'Erro ao remover arquivo.' });
    }
  }
}
