import { Prisma } from '@prisma/client';
export type UserFilter='ALL'|'ACTIVE'|'NONE'|'EXPIRED'|'REVOKED'|'BANNED'|'PENDING';
export function statusWhere(status:UserFilter,now=new Date()):Prisma.UserWhereInput{
 const subscriber={role:'USER' as const};
 switch(status){
 case 'ACTIVE':return {...subscriber,isBanned:false,subscription:{is:{revokedAt:null,startsAt:{lte:now},endsAt:{gt:now}}}};
 case 'NONE':return {...subscriber,subscription:{is:null}};
 case 'EXPIRED':return {...subscriber,subscription:{is:{revokedAt:null,endsAt:{lte:now}}}};
 case 'REVOKED':return {...subscriber,subscription:{is:{revokedAt:{not:null}}}};
 case 'BANNED':return {isBanned:true};
 case 'PENDING':return {...subscriber,accessRequestStatus:'PENDING'};
 default:return {};
 }
}
export function addDuration(base:Date,value:number,unit:'DAYS'|'MONTHS'){
 if(!Number.isInteger(value)||value<=0)throw Error('INVALID_DURATION');
 if(unit==='DAYS')return new Date(base.getTime()+value*86400000);
 const offset=5*3600000;const end=new Date(base.getTime()+offset);const day=end.getUTCDate();end.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+value);const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();end.setUTCDate(Math.min(day,last));return new Date(end.getTime()-offset);
}
