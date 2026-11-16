// Isolated PostgreSQL integration check. All test records are rolled back.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
const db=new PrismaClient();
const rollback=new Error('ROLLBACK_CATEGORY_CHECK');
let userId;
try {
  try {
    await db.$transaction(async tx=>{
      const user=await tx.user.create({data:{telegramId:-BigInt(Date.now()),firstName:'Isolated category check'}});userId=user.id;
      const category=await tx.category.create({data:{userId:user.id,name:'Original'}});
      const expense=await tx.transaction.create({data:{userId:user.id,type:'EXPENSE',amountUzs:50000n,categoryId:category.id,occurredAt:new Date(),rateUzsPerUsd:'12500',rateDate:new Date('2026-11-17T00:00:00Z'),amountUsdSnapshot:'4'}});
      await tx.category.update({where:{id:category.id},data:{name:'Renamed'}});
      const renamed=await tx.transaction.findUniqueOrThrow({where:{id:expense.id},include:{category:true}});assert.equal(renamed.category.name,'Renamed');
      await tx.category.delete({where:{id:category.id}});
      const preserved=await tx.transaction.findUniqueOrThrow({where:{id:expense.id}});
      assert.equal(preserved.categoryId,null);assert.equal(preserved.amountUzs,50000n);assert.equal(preserved.amountUsdSnapshot.toString(),'4');assert.equal(preserved.rateUzsPerUsd.toString(),'12500');
      throw rollback;
    });
  }catch(error){if(error!==rollback)throw error}
  assert.equal(await db.user.count({where:{id:userId}}),0);
  console.log('PASS: PostgreSQL rename and delete preserve expense amounts/snapshots; all test rows rolled back');
} finally {await db.$disconnect()}
