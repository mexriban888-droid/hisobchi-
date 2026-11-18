import 'dotenv/config';
import { createServer } from 'node:http';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { recordBotStart } from './tracking.js';
config({path:new URL('../../../.env',import.meta.url)});
const token=process.env.BOT_TOKEN,url=process.env.WEB_APP_URL||'https://existed-saved-jeans-mold.trycloudflare.com/';
if(!token)throw Error('BOT_TOKEN is required');
const ownerId=process.env.OWNER_TELEGRAM_ID||JSON.parse(readFileSync(new URL('../runtime/owner.json',import.meta.url),'utf8')).telegramId;
const bot=new Bot(token);
const healthPort=Number(process.env.PORT||10000);
createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true}));return}res.writeHead(404);res.end();}).listen(healthPort,()=>console.log(`Hisobchi bot health on :${healthPort}`));
const menuButton={type:'web_app' as const,text:'Hisobchi',web_app:{url}};
const keyboard=()=>new InlineKeyboard().webApp('Открыть Hisobchi',url);
const launchKeyboard=()=>new Keyboard().webApp('🚀 Hisobchi ni ochish',url).resized().persistent();
bot.command('start',async ctx=>{
 if(ctx.chat.type!=='private'||!ctx.from)return;
 try{await recordBotStart(ctx.from,String(ownerId))}catch{console.error('Could not record bot start')}
 await ctx.api.setChatMenuButton({chat_id:ctx.chat.id,menu_button:menuButton}).catch(()=>{});
 await ctx.reply('Hisobchi — daromad va xarajatlaringizning shaxsiy hisobi. Ilovani oching. Obuna kerak bo‘lsa, ilovada kirish so‘rovini yuboring.',{reply_markup:launchKeyboard()});
});
bot.command('yoz',ctx=>ctx.reply('Buyruqlar:\n/start — ilovani ochish\n/yoz — barcha buyruqlar\n/help — yordam va obuna\n\nMoliyaviy amallar Mini App ichida bajariladi.',{reply_markup:keyboard()}));
bot.command('help',ctx=>ctx.reply('Obuna administrator tomonidan qo‘lda yoqiladi. Hisobchi ilovasida kirish so‘rovini yuboring. To‘lovni administrator bilan kelishing.',{reply_markup:keyboard()}));
Promise.all([bot.api.deleteMyCommands(),bot.api.setChatMenuButton({menu_button:menuButton})]).catch(()=>console.error('Cannot configure Telegram menu'));
bot.catch(()=>console.error('Bot update failed'));
bot.start({onStart:()=>console.log('Hisobchi bot started')});
process.once('SIGINT',()=>bot.stop());process.once('SIGTERM',()=>bot.stop());
