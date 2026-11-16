import type { RequestHandler } from 'express';
import { prisma } from './access.js';
export const requestAccess:RequestHandler=async(req,res,next)=>{
 try{
  const user=await prisma.user.findUniqueOrThrow({where:{id:req.user!.id},include:{subscription:true}}),now=new Date();
  if(user.isBanned)return void res.status(403).json({error:'BANNED'});
  if(user.role!=='USER'||user.subscription&&!user.subscription.revokedAt&&user.subscription.startsAt<=now&&user.subscription.endsAt>now)return void res.status(409).json({error:'ACCESS_ALREADY_ACTIVE'});
  if(user.accessRequestStatus!=='PENDING')await prisma.user.updateMany({where:{id:user.id,OR:[{accessRequestStatus:null},{accessRequestStatus:{not:'PENDING'}}]},data:{accessRequestedAt:now,accessRequestStatus:'PENDING'}});
  res.json({status:'PENDING'});
 }catch(e){next(e)}
};
