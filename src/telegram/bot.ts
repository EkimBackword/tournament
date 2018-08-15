import { TELEGRAM_CONFIG } from '../config/database.config';

const Telegraf = require('telegraf');
const Composer = require('telegraf/composer');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Markup = require('telegraf/markup');
const WizardScene = require('telegraf/scenes/wizard');

const SocksAgent = require('socks5-https-client/lib/Agent');


const socksAgent = new SocksAgent({
    socksHost: TELEGRAM_CONFIG.proxy.host,
    socksPort: TELEGRAM_CONFIG.proxy.port,
    socksUsername: TELEGRAM_CONFIG.proxy.login,
    socksPassword: TELEGRAM_CONFIG.proxy.psswd,
  });



const stepHandler = new Composer();
stepHandler.action(/next:(.*):(.*)/, (ctx) => {
    const match = /next:(.*):(.*)/.exec(ctx.callbackQuery.data);
    const method = match[1];
    const value = match[2];
    switch (method) {
        case 'selectTournament': {
            console.log(value);
            ctx.reply(`deck ${ctx.wizard.step}`, Markup.inlineKeyboard([
                Markup.callbackButton('➡️ druid', 'next:adddeck:druid'),
                Markup.callbackButton('➡️ mage', 'next:adddeck:mage'),
                Markup.callbackButton('➡️ mage', 'next:adddeck:mage'),
            ]).extra());
            break;
        }
        case 'adddeck': {
            console.log(value);
            ctx.reply(`deck ${ctx.wizard.step}`, Markup.inlineKeyboard([
                Markup.callbackButton('➡️ druid', 'next:adddeck:druid'),
                Markup.callbackButton('➡️ mage', 'next:adddeck:mage'),
                Markup.callbackButton('➡️ mage', 'next:adddeck:mage'),
            ]).extra());
            break;
        }
    }
    return ctx.wizard.next();
});

const addMeWizard = new WizardScene('add-me-wizard',
  (ctx) => {
    ctx.reply('step 1', Markup.inlineKeyboard([
      Markup.urlButton('❤️', 'http://telegraf.js.org'),
      Markup.callbackButton('➡️ Next', 'next:selectTournament:1')
    ]).extra());
    return ctx.wizard.next();
  },
  stepHandler,
  stepHandler,
  stepHandler,
  (ctx) => {
    ctx.reply('Готово', Markup.inlineKeyboard([
        Markup.urlButton('❤️', 'http://telegraf.js.org'),
        Markup.callbackButton('➡️ Next', 'next:ok:null')
    ]).extra());
    return ctx.scene.leave();
  }
);

const bot = new Telegraf(TELEGRAM_CONFIG.apiToken, {
    telegram: { agent: socksAgent }
});

const stage = new Stage([addMeWizard], { default: 'add-me-wizard' });
bot.use(session());
// bot.use(stage.middleware());
bot.command('add_me', stage.middleware());
bot.startPolling();