import { PrismaClient } from '@prisma/client';
const db=new PrismaClient();
export async function recordBotStart(user:{id:number;username?:string;first_name?:string;last_name?:string;language_code?:string},ownerId:string){
 const now=new Date();
 return db.$transaction(async tx=>{
  const role=String(user.id)===ownerId?'OWNER' as const:'USER' as const;
  const row=await tx.user.upsert({where:{telegramId:BigInt(user.id)},create:{telegramId:BigInt(user.id),username:user.username,firstName:user.first_name,lastName:user.last_name,languageCode:user.language_code||'ru',role,botStartedAt:now},update:{username:user.username,firstName:user.first_name,lastName:user.last_name,lastActivityAt:now,...(role==='OWNER'?{role}:{})}});
  await tx.user.updateMany({where:{id:row.id,botStartedAt:null},data:{botStartedAt:now}});
  return row;
 });
}
