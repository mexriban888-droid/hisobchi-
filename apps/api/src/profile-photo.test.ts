import { afterEach, expect, it, vi } from 'vitest';
import { profilePhoto } from './profile-photo.js';
afterEach(()=>vi.unstubAllGlobals());
it('retrieves only session user photo, serves bytes without token',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ok:true,result:{photos:[[{file_id:'photo-1'}]]}}))).mockResolvedValueOnce(new Response(JSON.stringify({ok:true,result:{file_path:'photos/file_1.jpg'}}))).mockResolvedValueOnce(new Response(new Uint8Array([1,2,3])));
  vi.stubGlobal('fetch',fetch);
  const res:any={setHeader:vi.fn(),send:vi.fn(),status:vi.fn().mockReturnThis(),end:vi.fn()};
  await profilePhoto('test-secret')({user:{telegramId:42n}} as any,res,()=>{});
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({user_id:'42',limit:1});
  expect(res.send).toHaveBeenCalledWith(Buffer.from([1,2,3]));expect(JSON.stringify(res.setHeader.mock.calls)).not.toContain('test-secret');
});
it('handles hidden or absent photos with 404',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,result:{photos:[]}}))));const res:any={status:vi.fn().mockReturnThis(),end:vi.fn()};await profilePhoto('token')({user:{telegramId:42n}} as any,res,()=>{});expect(res.status).toHaveBeenCalledWith(404)});
