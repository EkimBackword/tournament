import Telegraf, { Context, ContextMessageUpdate } from 'telegraf';
const SocksAgent = require('socks5-https-client/lib/Agent');
import { TELEGRAM_CONFIG, RAVEN_CONFIG } from '../config/database.config';
import { DECK_CLASSES, getRuName } from './hearthstone.info';
import Tournament, { TournamentStatusENUM } from '../models/Tournament';
import User, { IUser } from '../models/User';
import Members, { UserRoles, IMembers } from '../models/Members';
import BanRequest from '../models/BanRequest';

import * as Raven from 'raven';
import { telegramRequestList } from '../controllers/User.controller';
Raven.config(RAVEN_CONFIG.url).install();

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
            Raven.captureException(err);
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

    sendMessage(msg: string, chatId: string|number, extra?: any) {
        return this.bot.telegram.sendMessage(chatId, msg, extra);
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
Вы можете прислать мне стикер))
Но это не самое главное.

Список команд:
1) /check_in [BattleTag]:[Password]

Например: /check_in MyNiсkname#1234:MyPassword
Данная команда позволяет вам зарегистрироваться в системе как участник турниров.
BattleTag - как в Hearthstone.
Password - любой. Также вы можете не вводить пароль, и он будет сгенерирован автоматически.

* Также данную команду можно использовать для изменения BattleTag или Password.
* BattleTag нужно вводить всегда, пароль является необязательным.
* Например, /check_in MyNewNiсkname#4321.

2) /add_me
Данная команда покажет вам список турниров, в которых идет активный набор участников.
Вы можете выбрать любой из них и вам будет предложено выбрать классы колод, на которых вы будете участвовать.
        `);
    }

    private commandHandler() {
        this.bot.command('add_me', (ctx) => this.addToTournament(ctx));
        this.bot.command('check_in', (ctx) => this.checkIn(ctx));
        this.bot.command('request', (ctx) => this.request(ctx));
    }

    private async request(ctx: ContextMessageUpdate) {
        const msg = /\/request (.*)/.exec(ctx.message.text);
        try {
            const requestID = msg[1];
            const telegramRequest = telegramRequestList.find(r =>  r.TelegramRequestID === requestID );
            if (telegramRequest) {
                const user = await User.findById<User>(telegramRequest.UserID);
                user.ChatID = ctx.chat.id;
                await user.save();
                return ctx.reply(`Данный чат, с текушего момента, прикреплён к игроку с BattleTag: ${user.BattleTag} и Логином: ${user.Login}`);
            } else {
                return ctx.reply(`Данный запрос отсутствует`);
            }
        } catch (err) {
            return ctx.reply(`Произошла ошибка!`);
        }
    }

    private async checkIn(ctx: ContextMessageUpdate) {
        const msg = /\/check_in (.*)/.exec(ctx.message.text);
        try {
            const BattleTag = msg[1].split(':')[0];
            const Password = msg[1].split(':')[1];
            const userWithThisBattleTag = await User.find<User>({ where: { 'BattleTag': BattleTag } });
            const user = await User.find<User>({ where: { 'ChatID': ctx.chat.id } });
            if (userWithThisBattleTag && user.ID !== userWithThisBattleTag.ID) {
                return ctx.reply(`С данным BattleTag уже существует пользователь!`);
            }
            if (user) {
                user.BattleTag = BattleTag;
                let result = `Данные изменены!\r\nЛогин: ${user.Login};\r\nBattleTag: ${user.BattleTag};\r\n`;
                if (Password) {
                    const hash = passwordHash.generate(Password);
                    user.Hash = hash;
                    result += `Пароль: ${Password};`;
                }
                await user.save();
                return ctx.reply(result);
            } else {
                const _Password = Password ? Password : this.generatePassword();
                const hash = passwordHash.generate(_Password);
                let last_name = ctx.chat.last_name ? ctx.chat.last_name + ' ' : '';
                const first_name = ctx.chat.first_name ? ctx.chat.first_name + ' ' : '';
                if (!last_name && !first_name) {
                    last_name = 'NONAME';
                }
                const data: IUser = {
                    Login: ctx.chat.username ? ctx.chat.username : ( BattleTag ? BattleTag : 'User_From_Telegram' ),
                    FIO: `${last_name} ${first_name}`,
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
        (this.bot as any).action(/ban:deck:(.*):(.*)/, (ctx: ContextMessageUpdate) => this.banDeck(ctx));
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
                    decks.map((d: string) => {
                        const deck = DECK_CLASSES.find((_d) => _d.id === d);
                        if (deck) {
                            return deck.title;
                        } else {
                            return '<unknow deck>';
                        }
                    }).join(', ')
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
            decks.map((d: string) => {
                const deck = DECK_CLASSES.find((_d) => _d.id === d);
                if (deck) {
                    return deck.title;
                } else {
                    return '<unknow deck>';
                }
            }).join(', ')
            + ')' :
            '';
        if (selectedTournament.deckCount == selectedTournament.decks.length) {
            try {
                const data: IMembers = {
                    UserID: user.ID,
                    TournamentID: tournament.ID,
                    DeckList: decks.join(', ')
                };
                let newMember = new Members(data);
                newMember = await newMember.save();
                (ctx as any).session.selectedTournament = null;
                return ctx.reply(`Вы зарегистрировны! ${decksString}`);
            } catch (err) {
                (ctx as any).session.selectedTournament = null;
                return ctx.reply(`Произошла ошибка!`);
            }
        } else {
            return ctx.reply(`Выберите класс ${decksString} ${selectedTournament.decks.length}/${selectedTournament.deckCount}. \r\np.s. 4-ая колода является дополнительной. Её вы выбираете в последнюю очередь.`,
                Markup.inlineKeyboard(
                    DECK_CLASSES.filter(d => !decks.some(_d => _d === d.id))
                                .map(d => Markup.callbackButton(d.title, `deck:select:${d.id}`))
                                .concat([Markup.callbackButton('Отмена', `deck:cancel`)])
                , {columns: 3}).extra()
            );
        }
    }

    private async banDeck(ctx: ContextMessageUpdate) {
        const match = (ctx as any).match;
        const deck = match[1];
        const banRequestID = match[2];
        const ChatID = ctx.chat.id;
        const banRequest = await BanRequest.findById<BanRequest>(banRequestID);
        if (ChatID === banRequest.GamerChatID) {
            if (banRequest.OpponentBannedDeck !== null) {
                return ctx.reply('Вы уже выбрали колоду для бана.');
            }
            banRequest.OpponentBannedDeck = deck;
        } else if (ChatID === banRequest.OpponentChatID) {
            if (banRequest.GamerBannedDeck !== null) {
                return ctx.reply('Вы уже выбрали колоду для бана.');
            }
            banRequest.GamerBannedDeck = deck;
        } else {
            return ctx.reply('Что-то пошло не так. Не найден матч');
        }
        await banRequest.save();
        if (banRequest.OpponentBannedDeck && banRequest.GamerBannedDeck) {
            let DeckToSend;
            let BattleTagToSend;
            if (ChatID === banRequest.GamerChatID) {
                banRequest.OpponentBannedDeck = deck;
                BattleTagToSend = banRequest.OpponentBattleTag;
                DeckToSend = banRequest.GamerBannedDeck;
                this.sendMessage(`Ваш противник ${banRequest.GamerBattleTag} забанил ${getRuName(deck)}`, banRequest.OpponentChatID);
            } else if (ChatID === banRequest.OpponentChatID) {
                banRequest.GamerBannedDeck = deck;
                BattleTagToSend = banRequest.GamerBattleTag;
                DeckToSend = banRequest.OpponentBannedDeck;
                this.sendMessage(`Ваш противник ${banRequest.OpponentBattleTag} забанил ${getRuName(deck)}`, banRequest.GamerChatID);
            }
            return ctx.reply(`Ваш противник ${BattleTagToSend} забанил ${getRuName(DeckToSend)}`);
        } else {
            return ctx.reply('Ждём выбора противника.');
        }
    }

    private hearsHandler() {
        this.bot.hears(/[П,п]ривет/i, (ctx) => ctx.reply('Приветствую тебя'));
        this.bot.hears(/(.*) [П,п]ока (.*)/i, (ctx) => {
            console.log((ctx as any).match);
            return ctx.reply('Пока пока');
        });

        this.bot.hears(/([П,п]обеда|[П,п]обедил|[П,п]обедила) (.*)/i, (ctx) => this.winOrLoss(ctx, 'Победил(а)'));
        this.bot.hears(/([П,п]оражение|[П,п]роиграл|[П,п]роиграла) (.*)/i, (ctx) => this.winOrLoss(ctx, 'Проиграл(а)'));
    }

    private async winOrLoss(ctx: ContextMessageUpdate, state: string) {
        const user = await User.find<User>({ where: { 'ChatID': ctx.chat.id } });
        const msg = `
Игрок ${user.BattleTag} сообщает о результате игры:
${state} : ${(ctx as any).match[2]}
        `;
        return await this.sendMessage(msg, 246156135);
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