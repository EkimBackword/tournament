import Telegraf, { Context, ContextMessageUpdate } from 'telegraf';
const SocksAgent = require('socks5-https-client/lib/Agent');
import { TELEGRAM_CONFIG } from '../config/database.config';
import { DECK_CLASSES } from './hearthstone.info';
import Tournament from '../models/Tournament';

const Markup = require('telegraf/markup');
const session = require('telegraf/session');

let Instance: TelegramService = null;

export class TelegramService {
    private bot: Telegraf<ContextMessageUpdate>;
    readonly socksAgent = new SocksAgent({
        socksHost: TELEGRAM_CONFIG.proxy.host,
        socksPort: TELEGRAM_CONFIG.proxy.port,
        socksUsername: TELEGRAM_CONFIG.proxy.login,
        socksPassword: TELEGRAM_CONFIG.proxy.psswd,
    });

    constructor() {
        this.bot = new Telegraf(TELEGRAM_CONFIG.apiToken, {
            telegram: { agent: this.socksAgent }
        });
        this.init();
        (this.bot as any).catch((err: any) => {
            console.log('Ooops', err);
        });
        this.bot.startPolling();
        Instance = this;
    }

    static getInstance() {
        if (Instance === null) {
            Instance = new TelegramService();
        }
        return Instance;
    }

    sendMessage(msg: string, chatId: string|number) {
        this.bot.telegram.sendMessage(chatId, msg);
    }

    private init() {
        this.bot.use(session());
        this.bot.start((ctx) => this.start(ctx));
        this.bot.help((ctx) => this.help(ctx));
        this.bot.on('sticker', (ctx) => ctx.reply('👍'));

        this.commandHandler();
        this.actionHandler();
        this.hearsHandler();
    }

    private start(ctx: ContextMessageUpdate) {
        return ctx.reply(`
Добро пожаловать в нашу таверну!
Чтобы узнать, что я умею: /help
        `);
    }

    private help(ctx: ContextMessageUpdate) {
        return ctx.reply(`
Вам нужна помощь?
Пришли мне стикер.
        `);
    }

    private commandHandler() {
        this.bot.command('add_me', (ctx) => this.addToTournament(ctx));
    }

    private async addToTournament(ctx: ContextMessageUpdate) {
        const data = await Tournament.findAll<Tournament>({ offset: 0, limit: 10 });
        return ctx.reply('Выберите турнир',
            Markup.inlineKeyboard(
                data.map(t => Markup.callbackButton(`➡️ ${t.Title}`, `tournament:select:${t.ID}`))
            , {columns: 1}).extra()
        );
    }

    private actionHandler() {
        (this.bot as any).action(/(tournament|deck):select:(.*)/, (ctx: ContextMessageUpdate) => this.selectDeck(ctx));
    }

    private async selectDeck(ctx: ContextMessageUpdate) {
        const match = (ctx as any).match;
        let selectedTournament: any;
        let tournament: Tournament;
        if (match[1] === 'tournament') {
            tournament = await Tournament.findById<Tournament>(match[2]);
            /** Нужна проверка наличия данного пользователя в турнире */
            selectedTournament = {
                id: match[2],
                deckCount: 4,
                decks: [],
                user: ctx.chat
            };
            (ctx as any).session.selectedTournament = selectedTournament;
        } else {
            (ctx as any).session.selectedTournament.decks.push(match[2]);
            selectedTournament = (ctx as any).session.selectedTournament;
            tournament = await Tournament.findById<Tournament>(selectedTournament.id);
        }
        const decks: string[] = selectedTournament.decks;
        const decksString = decks.length > 0 ?
            '(Вы выбрали колоды: ' +
            DECK_CLASSES.filter(d => decks.some(_d => _d === d.id))
                .map(d => d.title)
                .join(', ')
            + ')' :
            '';
        if (selectedTournament.deckCount == selectedTournament.decks.length) {
            try {
                const data = JSON.parse(tournament.JsonData);
                if (!data['users']) {
                    data['users'] = [];
                }
                data['users'].push({
                    user: selectedTournament.user,
                    decks: selectedTournament.decks
                });
                tournament.JsonData = JSON.stringify(data);
                await tournament.save();
                return ctx.reply(`Вы зарегистрировны! ${decksString}`);
            } catch (err) {
                return ctx.reply(`Произошла ошибка!`);
            }
        } else {
            return ctx.reply(`Выберите класс ${decksString}`,
                Markup.inlineKeyboard(
                    DECK_CLASSES.filter(d => !decks.some(_d => _d === d.id))
                                .map(d => Markup.callbackButton(d.title, `deck:select:${d.id}`))
                , {columns: 3}).extra()
            );
        }
    }

    private hearsHandler() {
        this.bot.hears(/[П,п]ривет/i, (ctx) => ctx.reply('Приветствую тебя'));
        this.bot.hears(/(.*) [П,п]ока (.*)/i, (ctx) => {
            console.log((ctx as any).match);
            return ctx.reply('Пока пока');
        });
    }



}