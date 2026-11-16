import { beforeEach, expect, it, vi } from 'vitest';
const db=vi.hoisted(()=>({user:{upsert:vi.fn(),updateMany:vi.fn()},$transaction:vi.fn()}));
vi.mock('@prisma/client',()=>({PrismaClient:class {user=db.user;$transaction=db.$transaction}}));
import { recordBotStart } from './tracking.js';
beforeEach(()=>{vi.resetAllMocks();db.$transaction.mockImplementation(fn=>fn(db));db.user.upsert.mockResolvedValue({id:'test'});db.user.updateMany.mockResolvedValue({count:1})});
it('records /start without claiming a Mini App open or subscription',async()=>{await recordBotStart({id:123,username:'Someone'},'7737214772');const data=db.user.upsert.mock.calls[0][0].create;expect(data.role).toBe('USER');expect(data.botStartedAt).toBeInstanceOf(Date);expect(data.miniAppFirstOpenedAt).toBeUndefined();expect(data.subscription).toBeUndefined();expect(db.user.updateMany.mock.calls[0][0].where).toEqual({id:'test',botStartedAt:null})});
it('does not grant OWNER from a matching username',async()=>{await recordBotStart({id:123,username:'Azizbek2603'},'7737214772');expect(db.user.upsert.mock.calls[0][0].create.role).toBe('USER')});
it('preserves first /start timestamp and matches OWNER by ID',async()=>{await recordBotStart({id:7737214772},'7737214772');const data=db.user.upsert.mock.calls[0][0];expect(data.create.role).toBe('OWNER');expect(data.update.botStartedAt).toBeUndefined()});
