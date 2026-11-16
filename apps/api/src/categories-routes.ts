import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { prisma, requireUser, requireActive } from './access.js';
const router=Router();
router.use(requireUser,requireActive);
export const categoryName=z.string().trim().min(1,'Введите название').max(60,'Максимум 60 символов').transform(s=>s.replace(/\s+/g,' '));
const input=z.object({name:categoryName});
const categoryId=z.string().cuid();
const failure=(error:unknown,res:any,next:any)=>{
  if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2002')return res.status(409).json({error:'CATEGORY_EXISTS'});
  if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2034')return res.status(409).json({error:'CATEGORY_CONFLICT'});
  next(error);
};
router.get('/summary',async(req,res,next)=>{try{
  const userId=req.user!.id;
  const {categories,groups}=await prisma.$transaction(async tx=>{
    const categories=await tx.category.findMany({where:{userId},orderBy:{name:'asc'}});
    const groups=await tx.transaction.groupBy({by:['categoryId'],where:{userId,type:'EXPENSE'},_sum:{amountUzs:true,amountUsdSnapshot:true},_count:{_all:true}});
    return {categories,groups};
  });
  const total=groups.reduce((s,g)=>s+(g._sum.amountUzs||0n),0n);
  const stats=(id:string|null)=>{const g=groups.find(x=>x.categoryId===id);const amount=g?._sum.amountUzs||0n;return {expenseUzs:String(amount),expenseUsd:g?._sum.amountUsdSnapshot?.toString()||'0',count:g?._count._all||0,sharePercent:total?new Decimal(amount.toString()).div(total.toString()).mul(100).toFixed(1):'0'};};
  const items=categories.map(c=>({...c,...stats(c.id)}));
  const uncategorized=stats(null);
  res.setHeader('Cache-Control','no-store');
  res.json({items:[...items,...(uncategorized.count?[{id:'uncategorized',name:'Без категории',...uncategorized}]:[])],totalExpenseUzs:String(total),totalExpenseUsd:groups.reduce((s,g)=>s.plus(g._sum.amountUsdSnapshot?.toString()||'0'),new Decimal(0)).toString()});
}catch(e){next(e)}});
router.get('/:id/transactions',async(req,res,next)=>{try{
  const id=req.params.id==='uncategorized'?null:categoryId.parse(req.params.id);
  const q=z.object({cursor:z.string().cuid().optional(),limit:z.coerce.number().int().min(1).max(50).default(20)}).parse(req.query);
  if(id&&!await prisma.category.findFirst({where:{id,userId:req.user!.id}}))return res.status(404).json({error:'CATEGORY_NOT_FOUND'});
  if(q.cursor&&!await prisma.transaction.findFirst({where:{id:q.cursor,userId:req.user!.id,type:'EXPENSE',categoryId:id}}))return res.status(400).json({error:'INVALID_CURSOR'});
  const rows=await prisma.transaction.findMany({where:{userId:req.user!.id,categoryId:id,type:'EXPENSE'},orderBy:[{occurredAt:'desc'},{id:'desc'}],take:q.limit+1,...(q.cursor?{cursor:{id:q.cursor},skip:1}:{}),select:{id:true,amountUzs:true,amountUsdSnapshot:true,comment:true,occurredAt:true}});
  res.json({items:rows.slice(0,q.limit),nextCursor:rows.length>q.limit?rows[q.limit-1].id:null});
}catch(e){next(e)}});
router.get('/',async(req,res,next)=>{try{res.json(await prisma.category.findMany({where:{userId:req.user!.id},include:{_count:{select:{transactions:true}}},orderBy:{name:'asc'}}))}catch(e){next(e)}});
router.post('/',async(req,res,next)=>{try{
  const {name}=input.parse(req.body),userId=req.user!.id;
  const result=await prisma.$transaction(async tx=>{
    if(await tx.category.findFirst({where:{userId,name:{equals:name,mode:'insensitive'}}}))return null;
    return tx.category.create({data:{userId,name}});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(!result)return res.status(409).json({error:'CATEGORY_EXISTS'});
  res.status(201).json(result);
}catch(e){failure(e,res,next)}});
router.patch('/:id',async(req,res,next)=>{try{
  const id=categoryId.parse(req.params.id),{name}=input.parse(req.body),userId=req.user!.id;
  const result=await prisma.$transaction(async tx=>{
    if(!await tx.category.findFirst({where:{id,userId}}))return 'MISSING';
    if(await tx.category.findFirst({where:{userId,id:{not:id},name:{equals:name,mode:'insensitive'}}}))return 'DUPLICATE';
    return tx.category.update({where:{id},data:{name}});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(result==='MISSING')return res.status(404).json({error:'CATEGORY_NOT_FOUND'});
  if(result==='DUPLICATE')return res.status(409).json({error:'CATEGORY_EXISTS'});
  res.json(result);
}catch(e){failure(e,res,next)}});
router.delete('/:id',async(req,res,next)=>{try{
  const id=categoryId.parse(req.params.id);
  // FK ON DELETE SET NULL preserves every transaction and its currency snapshot.
  const result=await prisma.category.deleteMany({where:{id,userId:req.user!.id}});
  if(!result.count)return res.status(404).json({error:'CATEGORY_NOT_FOUND'});
  res.status(204).end();
}catch(e){failure(e,res,next)}});
export default router;
