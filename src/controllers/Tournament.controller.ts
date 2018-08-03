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

        router.get('/:id', isAuth, this.profile);
        router.post('/:id/edit', isAuth, this.edit);
        router.delete('/:id', requireAdmin, this.delete);


        app.use('/tournament', router);
    }

    /**
     * 
     * @param req Объект запроса
     * @param res Объект ответа
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
     * 
     * @param req 
     * @param res 
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
        const result = data.map(u => {
            const curUser: ITournament = u.toJSON();
        });
        return res.json({ result, count });
    }

    /**
     * 
     * @param req 
     * @param res 
     */
    private async search (req: Request, res: Response) {
        try {
            const term: string = req.params.term;
            const list = await User.findAll<User>();
            const result = list.filter(item => {
                                    if (item.FIO.toLowerCase().indexOf(term.toLowerCase()) > -1) {
                                        if (req.query.role !== void 0) {
                                            return item.Role === req.query.role;
                                        }
                                        return true;
                                    }
                                    return false;
                                })
                                .map(item => item.toJSON());
            return res.json(result);
        } catch (err) {
            return res.status(500).json(err);
        }
    }

    /**
     * 
     * @param req 
     * @param res 
     */
    private async profile(req: Request, res: Response) {
        const includes = [];
        if (req.query.withTournaments !== void 0) {
            includes.push(Tournament);
        }
        if (includes.length === 0) return res.json(req.user);
        const currentUser: User = await User.findById<User>(req.user.ID, { include: includes });
        const result: IUser = currentUser.toJSON();
        delete result.Hash;
        return res.json(result);
    }

    /**
     * 
     * @param req 
     * @param res 
     */
    private async edit(req: Request, res: Response) {
        const error = await User.checkFullModel(req, true);
        if (error != null) return res.status(400).json(error);

        const id = req.params.id;
        const CurrentUser = await User.findById<User>(id);
        if (CurrentUser === null) {
            return res.status(404).json({ message: 'Такого пользователя нет'});
        }

        try {
            CurrentUser.Login = req.body.Login;
            CurrentUser.FIO = req.body.FIO;
            CurrentUser.Role = req.body.Role;
            if (req.body.Password !== void 0) {
                const hash = passwordHash.generate(req.body.Password);
                CurrentUser.Hash = hash;
            }
            await CurrentUser.save();
            return res.status(204).json();
        } catch (err) {
            return res.status(500).json(err);
        }
    }

    /**
     * 
     * @param req 
     * @param res 
     */
    private async delete(req: Request, res: Response) {
        const id = req.params.id;
        const user = await User.findById<User>(id, {include: [ Tournament ]});
        const tournamentList = await Tournament.findAll({where: { UserID: user.ID }});
        tournamentList.forEach(async i => await i.destroy());
        try {
            await user.destroy();
            return res.status(204).json();
        } catch (err) {
            return res.status(500).json(err);
        }
    }
}