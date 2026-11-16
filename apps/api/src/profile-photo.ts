import type { RequestHandler } from 'express';
// Only the authenticated user's own photo is served. Bot file URLs stay server-side.
export function profilePhoto(token: string): RequestHandler {
  return async (req, res) => {
    try {
      const call = async (method: string, body: object) => {
        const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw Error('PHOTO_UNAVAILABLE');
        const data = await response.json() as { ok: boolean; result: any };
        if (!data.ok) throw Error('PHOTO_UNAVAILABLE');
        return data.result;
      };
      const photos = await call('getUserProfilePhotos', { user_id: String(req.user!.telegramId), limit: 1 });
      const sizes = photos.photos?.[0];
      const photo = sizes?.[Math.min(1, sizes.length - 1)];
      if (!photo) { res.status(404).end(); return; }
      const file = await call('getFile', { file_id: photo.file_id });
      if (typeof file.file_path !== 'string' || !/^[\w./-]+$/.test(file.file_path) || file.file_path.includes('..')) throw Error('PHOTO_UNAVAILABLE');
      const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok || Number(response.headers.get('content-length') || 0) > 5e6) throw Error('PHOTO_UNAVAILABLE');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 5e6) throw Error('PHOTO_UNAVAILABLE');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(bytes);
    } catch { res.status(404).end(); }
  };
}
