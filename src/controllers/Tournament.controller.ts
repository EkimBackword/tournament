import { Application, Request, Response, NextFunction, Router } from 'express';
import { Model, Sequelize } from 'sequelize-typescript';

import * as passport from 'passport';
import { isAuth, requireAdmin } from '../authentication';
import User, { IUser, UserRoles } from '../models/User';
import Tournament, { ITournament, TournamentStatusENUM } from '../models/Tournament';
import { TelegramService } from '../telegram/telegram.service';
import Members from '../models/Members';
import BanRequest, { IBanRequest } from '../models/BanRequest';

import { DECK_CLASSES } from '../telegram/hearthstone.info';
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
        const data = await Tournament.findAll<Tournament>({ where: WHERE, offset, limit });
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


            const banRequest: IBanRequest = {
                TournamentID: tournament.ID,

                GamerBattleTag: gamer.BattleTag,
                GamerChatID: gamer.ChatID,
                GamerDeckList: gamer.TournamentsAsMember.find(m => m.TournamentID == tournament.ID).DeckList,

                OpponentBattleTag: opponent.BattleTag,
                OpponentChatID: opponent.ChatID,
                OpponentDeckList: opponent.TournamentsAsMember.find(m => m.TournamentID == tournament.ID).DeckList,
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
Выберите колоду, которую вы хотите забанить:`;
            return this.TelegramServiceInstance.sendMessage(msg, GamerChatID,
                Markup.inlineKeyboard(
                    DECK_CLASSES.filter(d => DeckList.split(', ').some(_d => _d === d.id))
                                .map(d => Markup.callbackButton(d.title, `ban:deck:${d.id}:${RequestID}`))
                , {columns: 1}).extra()
            );
        }
    }
}