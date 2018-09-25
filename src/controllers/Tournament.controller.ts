import { Application, Request, Response, NextFunction, Router } from 'express';
import { Model, Sequelize } from 'sequelize-typescript';

import * as passport from 'passport';
import { isAuth, requireAdmin } from '../authentication';
import User, { IUser, UserRoles } from '../models/User';
import Tournament, { ITournament, TournamentStatusENUM } from '../models/Tournament';
import { TelegramService } from '../telegram/telegram.service';
import Members, { IMembers } from '../models/Members';
import BanRequest, { IBanRequest } from '../models/BanRequest';

import { DECK_CLASSES, getRuName } from '../telegram/hearthstone.info';
const Markup = require('telegraf/markup');

export class TournamentController {
    protected TelegramServiceInstance: TelegramService;

    constructor(app: Application) {
        const router = Router();
        this.TelegramServiceInstance = TelegramService.getInstance();
        // this.TelegramServiceInstance.sendMessage('Тестовое письмо', 246156135); // Письмо мне в личку

        router.post('/add', isAuth, this.add);
        router.get('/list', this.list);
        router.get('/search/:term', isAuth, this.search);

        router.get('/:id', this.tournamentDetails);
        router.post('/:id/edit', isAuth, this.edit);
        router.post('/:id/send-opponent-info', isAuth, this.sendOpponentInfo.bind(this));
        router.post('/:id/add-member', isAuth, this.addMember.bind(this));
        router.post('/:id/edit-member', isAuth, this.editMember.bind(this));
        router.post('/:id/get-ban-request-list', isAuth, this.getBanRequestList.bind(this));
        router.post('/:id/save-ban-request', isAuth, this.saveBanRequest.bind(this));
        router.delete('/:id', requireAdmin, this.delete);


        app.use('/tournament', router);
    }

    /**
     * Добавление турнира
     * @param req Request { body: { JsonData, JsonData, ID } }
     * @param res Response
     */
    private async add(req: Request, res: Response) {
        const error = await Tournament.checkModel(req);
        if (error != null) return res.status(400).json(error);

        try {
            const data: ITournament = {
                Title: req.body.Title,
                JsonData: req.body.JsonData,
                UserID: req.user.ID,
                DeckCount: req.user.DeckCount ? req.user.DeckCount : 4,
                Status: TournamentStatusENUM.new
            };
            let newTournament = new Tournament(data);
            newTournament = await newTournament.save();
            return res.status(200).json(newTournament.ID);
        } catch (err) {
            return res.status(500).json(err);
        }
    }

    /**
     * Получение списка турниров
     * @param req Request
     * @param res Response
     */
    private async list(req: Request, res: Response) {
        const WHERE: any = {};
        const UserID = req.query.UserID;
        const offset = req.query.offset || 0;
        const limit = req.query.limit || 25;
        if (UserID !== void 0) {
            WHERE['UserID'] = UserID;
        }
        const data = await Tournament.findAll<Tournament>({ where: WHERE, offset, limit, order: [['ID', 'DESC']] });
        const count = await Tournament.count({ where: WHERE });
        const result = data.map(u => u.toJSON());
        return res.json({ result, count });
    }

    /**
     * Поиск турниров
     * @param req Request
     * @param res Response
     */
    private async search (req: Request, res: Response) {
        try {
            const term: string = req.params.term;
            const listTournament = await Tournament.findAll<Tournament>();
            const result = listTournament
                            .filter(tournament => tournament.Title.toLowerCase().indexOf(term.toLowerCase()) > -1)
                            .map(item => item.toJSON());
            return res.json(result);
        } catch (err) {
            return res.status(500).json(err);
        }
    }

    /**
     * Детальная информация
     * @param req Request
     * @param res Response
     */
    private async tournamentDetails(req: Request, res: Response) {
        const includes = [];
        const id = req.params.id;
        if (req.query.withUser !== void 0) {
            includes.push(User);
        }
        if (req.query.withMembers !== void 0) {
            includes.push({
                model: Members,
                include: [{
                    model: User,
                    attributes: [
                        'ID',
                        'Login',
                        'FIO',
                        'BattleTag'
                    ]
                }],
            });
        }
        const result: ITournament = (await Tournament.findById<Tournament>(id, { include: includes })).toJSON();
        return res.json(result);
    }

    /**
     * Редактирование турнира
     * @param req Request
     * @param res Response
     */
    private async edit(req: Request, res: Response) {
        const error = await Tournament.checkModel(req);
        if (error != null) return res.status(400).json(error);

        const id = req.params.id;
        const tournament = await Tournament.findById<Tournament>(id);
        if (tournament === null) {
            return res.status(404).json({ message: 'Такого турнира нет'});
        }

        try {
            tournament.Title = req.body.Title;
            tournament.JsonData = req.body.JsonData;
            if (req.body.Status) {
                tournament.Status = req.body.Status;
            }
            await tournament.save();
            return res.status(204).json();
        } catch (err) {
            return res.status(500).json(err);
        }
    }

    /**
     * Удаление турнира
     * @param req Request
     * @param res Response
     */
    private async delete(req: Request, res: Response) {
        const id = req.params.id;
        const tournament = await Tournament.findById<Tournament>(id);
        try {
            await tournament.destroy();
            return res.status(204).json();
        } catch (err) {
            return res.status(500).json(err);
        }
    }

    /**
     * Удаление турнира
     * @param req Request
     * @param res Response
     */
    private async sendOpponentInfo(req: Request, res: Response) {
        const id = req.params.id;
        try {
            const tournament = await Tournament.findById<Tournament>(id, { include: [Members] });
            const gamer = await User.findById<User>(req.body.gamerID, { include: [ Members ] });
            const opponent = await User.findById<User>(req.body.opponentID, { include: [ Members ] });

            let DeckCount = 4;
            if (tournament !== null && req.body.round) {
                DeckCount = req.body.round === 'group' ? tournament.DeckForGroup : tournament.DeckForPlayoff;
            }

            const banRequest: IBanRequest = {
                TournamentID: tournament.ID,

                GamerBattleTag: gamer.BattleTag,
                GamerChatID: gamer.ChatID,
                GamerDeckList: gamer.TournamentsAsMember.find(m => m.TournamentID == tournament.ID).DeckList.split(', ').filter((v, i) => i < DeckCount).join(', '),

                OpponentBattleTag: opponent.BattleTag,
                OpponentChatID: opponent.ChatID,
                OpponentDeckList: opponent.TournamentsAsMember.find(m => m.TournamentID == tournament.ID).DeckList.split(', ').filter((v, i) => i < DeckCount).join(', '),
            };

            let Request = new BanRequest(banRequest);
            Request = await Request.save();
            if (Request.ID) {
                await this.getOpponentInfo(
                    banRequest.GamerBattleTag,
                    banRequest.GamerChatID,
                    banRequest.OpponentBattleTag,
                    banRequest.OpponentDeckList,
                    Request.ID
                );
                await this.getOpponentInfo(
                    banRequest.OpponentBattleTag,
                    banRequest.OpponentChatID,
                    banRequest.GamerBattleTag,
                    banRequest.GamerDeckList,
                    Request.ID
                );
            } else {
                console.log(Request);
            }

            return res.status(200).json(Request.toJSON());
        } catch (err) {
            console.log(err);
            return res.status(500).json(err);
        }
    }

    private async getOpponentInfo(GamerBattleTag: string, GamerChatID: number, OpponentBattleTag: string, DeckList: string, RequestID: number) {
        if (GamerChatID !== null) {
            const msg = `
Доброго времени суток, ${GamerBattleTag}!
Ваш следуюший оппонент: ${OpponentBattleTag}.
p.s. Помните что в группе мы не баним 4-ую колоду (⚠️), так как она является дополнительно для плай-офф.

Выберите колоду, которую вы хотите забанить:`;
            return this.TelegramServiceInstance.sendMessage(msg, GamerChatID,
                Markup.inlineKeyboard(
                    DECK_CLASSES.filter(d => DeckList.split(', ').some(_d => _d === d.id))
                                .map((d, index) => Markup.callbackButton(d.title + (index === 3 ? '⚠️' : ''), `ban:deck:${d.id}:${RequestID}`))
                , {columns: 1}).extra()
            );
        }
    }

    /**
     * Добавление участника в турнир
     * @param req Request { body: { JsonData, JsonData, ID } }
     * @param res Response
     */
    private async addMember(req: Request, res: Response) {
        try {
            const id = req.params.id;
            const tournament = await Tournament.findById<Tournament>(id);
            if (tournament === null) {
                return res.status(404).json({ message: 'Такого турнира нет'});
            }
            const user = await User.findById<User>(req.body.userId);
            if (user === null) {
                return res.status(404).json({ message: 'Такого пользователя нет'});
            }

            const data: IMembers = {
                UserID: user.ID,
                TournamentID: tournament.ID,
                DeckList: req.body.Decks.filter((d: string) => DECK_CLASSES.some((_d) => _d.id === d)).join(', ')
            };
            let newMember = new Members(data);
            newMember = await newMember.save();
            return res.status(204).json();
        } catch (err) {
            return res.status(500).json(err);
        }
    }

    /**
     * Добавление участника в турнир
     * @param req Request { body: { JsonData, JsonData, ID } }
     * @param res Response
     */
    private async editMember(req: Request, res: Response) {
        try {
            const id = req.params.id;
            const UserID = req.user.ID;
            const tournament = await Tournament.findById<Tournament>(id);
            if (tournament === null) {
                return res.status(404).json({ message: 'Такого турнира нет'});
            }
            if (tournament.Status === TournamentStatusENUM.start) {
                return res.status(404).json({ message: 'Турнир уже проводиться, замена классов запрещена'});
            } else if (tournament.Status === TournamentStatusENUM.finished) {
                return res.status(404).json({ message: 'Турнир уже закончен, так что менять классы нет смысла'});
            }
            const user = await User.findById<User>(UserID);
            if (user === null) {
                return res.status(404).json({ message: 'Такого пользователя нет'});
            }
            const member = await Members.findById<Members>(req.body.memberID);
            if (member === null) {
                return res.status(404).json({ message: 'Такого участника нет' });
            }
            if (member.UserID !== UserID) {
                return res.status(404).json({ message: 'Редактировать можно только свои колоды' });
            }

            member.DeckList = req.body.Decks.filter((d: string) => DECK_CLASSES.some((_d) => _d.id === d))
                .join(', ');

            await member.save();
            return res.status(204).json();
        } catch (err) {
            return res.status(500).json(err);
        }
    }

    /**
     * Добавление участника в турнир
     * @param req Request { body: { JsonData, JsonData, ID } }
     * @param res Response
     */
    private async getBanRequestList(req: Request, res: Response) {
        try {
            const id = req.params.id;
            const tournament = await Tournament.findById<Tournament>(id);
            if (tournament === null) {
                return res.status(404).json({ message: 'Такого турнира нет'});
            }
            const user = await User.findById<User>(req.body.userId);
            if (user === null) {
                return res.status(404).json({ message: 'Такого пользователя нет'});
            }

            const banRequest = await BanRequest.findAll<BanRequest>({
                where: Sequelize.and([
                    {'TournamentID': tournament.ID},
                    Sequelize.or(
                        {'GamerBattleTag': user.BattleTag},
                        {'OpponentBattleTag': user.BattleTag}
                    )
                ]),
                order: [['ID', 'DESC']]
            });
            await BanRequest.findAll<BanRequest>();

            return res.status(200).json(banRequest.map(r => r.toJSON()));
        } catch (err) {
            return res.status(500).json(err);
        }
    }

    /**
     * Добавление участника в турнир
     * @param req Request { body: { JsonData, JsonData, ID } }
     * @param res Response
     */
    private async saveBanRequest(req: Request, res: Response) {
        try {
            const id = req.params.id;
            const tournament = await Tournament.findById<Tournament>(id);
            if (tournament === null) {
                return res.status(404).json({ message: 'Такого турнира нет'});
            }
            const banRequestData: IBanRequest = req.body;
            const banRequest = await BanRequest.findById<BanRequest>(banRequestData.ID);
            if (banRequest === null) {
                return res.status(404).json({ message: 'Такого матча нет'});
            }

            if (banRequestData.OpponentBannedDeck && banRequestData.GamerBannedDeck) {
                if (banRequest.GamerBannedDeck === null && banRequest.GamerChatID) {
                    const deck = banRequestData.GamerBannedDeck;
                    this.TelegramServiceInstance.sendMessage(`Ваш противник ${banRequest.OpponentBattleTag} забанил ${getRuName(deck)}`, banRequest.GamerChatID);
                } else if (banRequest.OpponentBannedDeck === null && banRequest.OpponentChatID) {
                    const deck = banRequestData.OpponentBannedDeck;
                    this.TelegramServiceInstance.sendMessage(`Ваш противник ${banRequest.GamerBattleTag} забанил ${getRuName(deck)}`, banRequest.OpponentChatID);
                }
            }

            if (banRequest.GamerResultInfo !== banRequestData.GamerResultInfo) {
                const msg = `
Игрок ${banRequest.GamerBattleTag} сообщает о результате игры против ${banRequest.OpponentBattleTag}:
${banRequestData.GamerResultInfo}
                `;
                this.TelegramServiceInstance.sendMessage(msg, 246156135);
                banRequest.GamerResultInfo = banRequestData.GamerResultInfo;
            }
            banRequest.GamerBannedDeck = banRequestData.GamerBannedDeck;

            if (banRequest.OpponentResultInfo !== banRequestData.OpponentResultInfo) {
                const msg = `
Игрок ${banRequest.OpponentBattleTag} сообщает о результате игры против ${banRequest.GamerBattleTag}:
${banRequestData.OpponentResultInfo}
                `;
                this.TelegramServiceInstance.sendMessage(msg, 246156135);
                banRequest.OpponentResultInfo = banRequestData.OpponentResultInfo;
            }
            banRequest.OpponentBannedDeck = banRequestData.OpponentBannedDeck;

            await banRequest.save();
            return res.status(204).json();
        } catch (err) {
            return res.status(500).json(err);
        }
    }
}