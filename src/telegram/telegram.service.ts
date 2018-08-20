import Telegraf, { Context, ContextMessageUpdate } from 'telegraf';
const SocksAgent = require('socks5-https-client/lib/Agent');
import { TELEGRAM_CONFIG } from '../config/database.config';
import { DECK_CLASSES } from './hearthstone.info';
import Tournament, { TournamentStatusENUM } from '../models/Tournament';
import User, { IUser } from '../models/User';
import Members, { UserRoles, IMembers } from '../models/Members';

const Markup = require('telegraf/markup');
const session = require('telegraf/session');
const passwordHash = require('password-hash');

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
        const config = TELEGRAM_CONFIG.needProxy ? { telegram: { agent: this.socksAgent } } : {};
        this.bot = new Telegraf(TELEGRAM_CONFIG.apiToken, config);
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
        return this.bot.telegram.sendMessage(chatId, msg);
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
        this.bot.command('check_in', (ctx) => this.checkIn(ctx));
    }

    private async checkIn(ctx: ContextMessageUpdate) {
        const msg = /\/check_in (.*)/.exec(ctx.message.text);
        try {
            const BattleTag = msg[1].split(':')[0];
            const Password = msg[1].split(':')[1];
            const user = await User.find<User>({ where: { 'ChatID': ctx.chat.id } });
            if (user) {
                user.BattleTag = BattleTag;
                let result = `Данные изменены!\r\nЛогин: ${user.Login};\r\nBattleTag: ${user.BattleTag};\r\n`;
                if (Password) {
                    const hash = passwordHash.generate(Password);
                    user.Hash = hash;
                    result += `Пароль: ${user.BattleTag};`;
                }
                await user.save();
                return ctx.reply(result);
            } else {
                const _Password = Password ? Password : this.generatePassword();
                const hash = passwordHash.generate(_Password);
                const data: IUser = {
                    Login: ctx.chat.username ? ctx.chat.username : ( BattleTag ? BattleTag : 'User_From_Telegram' ),
                    FIO: `${ctx.chat.last_name} ${ctx.chat.first_name}`,
                    Role: UserRoles.user,
                    Hash: hash,
                    ChatID: ctx.chat.id,
                    ChatInfo: JSON.stringify(ctx.chat),
                    BattleTag: BattleTag
                };
                let newUser = new User(data);
                newUser = await newUser.save();
                return ctx.reply(`Вы зарегистрированы на сайте http://app.tavern.mzharkov.ru/login\r\nЛогин: ${newUser.Login};\r\nBattleTag: ${newUser.BattleTag};\r\nПароль: ${_Password}`);
            }
        } catch (err) {
            return ctx.reply(`Произошла ошибка!`);
        }
    }

    private async addToTournament(ctx: ContextMessageUpdate) {
        const user = await User.find<User>({ where: { 'ChatID': ctx.chat.id } });
        if (user) {
            (ctx as any).session.user = user.toJSON();
            const data = await Tournament.findAll<Tournament>({ where: { Status: TournamentStatusENUM.new }, offset: 0, limit: 10 });
            if (data.length === 0) {
                return ctx.reply('В данный момент отсутствуют турниры, в которые производиться набор участников');
            } else {
                return ctx.reply('Выберите турнир',
                    Markup.inlineKeyboard(
                        data.map(t => Markup.callbackButton(`➡️ ${t.Title}`, `tournament:select:${t.ID}`))
                            .concat([Markup.callbackButton('Отмена', `deck:cancel`)])
                    , {columns: 1}).extra()
                );
            }
        } else {
            return ctx.reply('Пожалуйста зарегистрируйтесь, как участник турниров с помощью команды /check_in [BattleTag]:[Password]');
        }
    }

    private actionHandler() {
        (this.bot as any).action(/(tournament|deck):select:(.*)/, (ctx: ContextMessageUpdate) => this.selectDeck(ctx));
        (this.bot as any).action(/(tournament|deck):cancel/, (ctx: ContextMessageUpdate) => this.CancelSelect(ctx));
    }

    private CancelSelect(ctx: ContextMessageUpdate) {
        (ctx as any).session.selectedTournament = null;
        return ctx.reply(`Отмена регистрации в турнире!`);
    }

    private async selectDeck(ctx: ContextMessageUpdate) {
        const match = (ctx as any).match;
        let selectedTournament: any;
        let tournament: Tournament;
        const user = await User.find<User>({ where: { 'ChatID': ctx.chat.id } });
        if (match[1] === 'tournament') {
            tournament = await Tournament.findById<Tournament>(match[2], { include: [ Members ] });
            const existMember = tournament.Members.find(member => member.UserID === user.ID);
            if (existMember) {
                const decks: string[] = existMember.DeckList.split(', ');
                const decksString = decks.length > 0 ?
                    '(Вы выбрали колоды: ' +
                    DECK_CLASSES.filter(d => decks.some(_d => _d === d.id))
                        .map(d => d.title)
                        .join(', ')
                    + ')' :
                    '';
                return ctx.reply(`Вы уже зарегистрировны в этом турнире! ${decksString}`);
            }
            /** Нужна проверка наличия данного пользователя в турнире */
            selectedTournament = {
                id: match[2],
                deckCount: tournament.DeckCount,
                decks: [],
                user: user
            };
            (ctx as any).session.selectedTournament = selectedTournament;
        } else if ((ctx as any).session.selectedTournament) {
            (ctx as any).session.selectedTournament.decks.push(match[2]);
            selectedTournament = (ctx as any).session.selectedTournament;
            tournament = await Tournament.findById<Tournament>(selectedTournament.id);
        } else {
            return ctx.reply(`Произошла ошибка! Турнир не выбран!`);
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
                const data: IMembers = {
                    UserID: user.ID,
                    TournamentID: tournament.ID,
                    DeckList: DECK_CLASSES.filter(d => decks.some(_d => _d === d.id))
                                        .map(d => d.id)
                                        .join(', ')
                };
                let newMember = new Members(data);
                newMember = await newMember.save();
                return ctx.reply(`Вы зарегистрировны! ${decksString}`);
            } catch (err) {
                return ctx.reply(`Произошла ошибка!`);
            }
        } else {
            return ctx.reply(`Выберите класс ${decksString}`,
                Markup.inlineKeyboard(
                    DECK_CLASSES.filter(d => !decks.some(_d => _d === d.id))
                                .map(d => Markup.callbackButton(d.title, `deck:select:${d.id}`))
                                .concat([Markup.callbackButton('Отмена', `deck:cancel`)])
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


    private generatePassword() {
        const length = 8;
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let retVal = '';
        for (let i = 0, n = charset.length; i < length; ++i) {
            retVal += charset.charAt(Math.floor(Math.random() * n));
        }
        return retVal;
    }
}