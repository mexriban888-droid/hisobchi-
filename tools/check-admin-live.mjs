// Read-only verification against the local API and existing owner record.
import 'dotenv/config';
import assert from 'node:assert/strict';
import signature from 'cookie-signature';
import { PrismaClient } from '@prisma/client';
const db=new PrismaClient();
try{
 const owner=await db.user.findFirst({where:{role:'OWNER',isBanned:false},select:{id:true}});assert.ok(owner);
 const cookieFor=id=>'hisobly_uid='+encodeURIComponent('s:'+signature.sign(id,process.env.SESSION_SECRET));
 const get=(path,id)=>fetch('http://127.0.0.1:3000'+path,{headers:id?{Cookie:cookieFor(id)}:{}});
 const overviewResponse=await get('/api/admin/overview',owner.id);assert.equal(overviewResponse.status,200);const overview=await overviewResponse.json();assert.equal(overview.total,await db.user.count());assert.equal(overview.pendingRequests,await db.user.count({where:{role:'USER',accessRequestStatus:'PENDING'}}));
 const usersResponse=await get('/api/admin/users?limit=20',owner.id);assert.equal(usersResponse.status,200);const users=await usersResponse.json();assert.equal(users.total,overview.total);for(const user of users.items){assert.equal(user.transactions,undefined);assert.equal(user.categories,undefined);assert.equal(user.telegramId instanceof String,false)}
 assert.equal((await get('/api/admin/overview')).status,401);
 const regular=await db.user.findFirst({where:{role:'USER'},select:{id:true}});if(regular)assert.equal((await get('/api/admin/overview',regular.id)).status,403);
 console.log('PASS: live owner overview/users, real DB counts, privacy-safe fields, unauthenticated denial'+(regular?', USER forbidden':''));
 console.log(JSON.stringify({registered:overview.total,pendingRequests:overview.pendingRequests,activeSubscriptions:overview.activeSubscriptions,botStartsRecorded:overview.botStarted,miniAppOpensRecorded:overview.appOpened}));
}finally{await db.$disconnect()}
