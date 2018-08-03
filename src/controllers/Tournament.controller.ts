import { Application, Request, Response, NextFunction, Router } from 'express';
import { Model, Sequelize } from 'sequelize-typescript';

import * as passport from 'passport';
import { isAuth, requireAdmin } from '../authentication';
import User, { IUser, UserRoles } from '../models/User';
import Tournament, { ITournament } from '../models/Tournament';

export class TournamentController {
    constructor(app: Application) {
        const router = Router();

        router.post('/add', isAuth, this.add);
        router.get('/list', isAuth, this.list);
        router.get('/search/:term', isAuth, this.search);

        router.get('/:id', isAuth, this.tournamentDetails);
        router.post('/:id/edit', isAuth, this.edit);
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
                Title: req.body.JsonData,
                JsonData: req.body.JsonData,
                UserID: req.user.ID
            };
            let newTournament = new Tournament(data);
            newTournament = await newTournament.save();
            return res.status(204).json();
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
}