import { Application, Request, Response, NextFunction, Router } from 'express';
import { Model, Sequelize } from 'sequelize-typescript';
import * as passport from 'passport';
import { isAuth, requireAdmin } from '../authentication';
const passwordHash = require('password-hash');

import User, { IUser, UserRoles } from '../models/User';

import * as multer from 'multer';
import Tournament from '../models/Tournament';
// const storage = multer.diskStorage(
//     {
//         destination: 'files/',
//         filename: function ( req, file, cb ) {
//             // req.body is empty... here is where req.body.new_file_name doesn't exists
//             cb( null, file.originalname );
//         }
//     }
// );
// const uploader = multer({ dest: 'files/', storage: storage });

export class UserController {
    constructor(app: Application) {
        const router = Router();
        router.post('/login', passport.authenticate('local'), this.login);
        router.get('/logout', this.logout);

        router.get('/profile', isAuth, this.profile);
        router.get('/list', isAuth, this.list);
        router.get('/search/:term', isAuth, this.search);
        router.post('/add', this.add);
        router.patch('/edit/:id', requireAdmin, this.edit);

        router.delete('/:id', requireAdmin, this.delete);

        app.use('/user', router);
    }


    private async login(req: Request, res: Response) {
        if (req.user) {
            req.login(req.user, (err) => {
                if (err) {
                    return res.status(500).json({message: 'не сработал passport.authenticate'});
                }
                return res.json(req.user);
            });
        }
        else {
            return res.status(500).json({message: 'не сработал passport.authenticate'});
        }
    }

    private async logout(req: Request, res: Response) {
        req.logout();
        return res.json();
    }

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
     * Метод регистрации пользователя
     * @param req Объект запроса
     * @param res Объект ответа
     */
    private async add(req: Request, res: Response) {
        const error = await User.checkFullModel(req);
        if (error != null) return res.status(400).json(error);

        const existsUser = await User.findOne<User>({where: { Login: req.body.Login }});
        if (existsUser != null) {
            return res.status(400).json({ message: 'Пользователь с таким Login уже существует'});
        }

        try {
            const hash = passwordHash.generate(req.body.Password);
            const data: IUser = {
                Login: req.body.Login,
                FIO: req.body.FIO,
                Role: req.body.Role,
                Hash: hash
            };
            let newUser = new User(data);
            newUser = await newUser.save();
            return res.status(204).json();
        } catch (err) {
            return res.status(500).json(err);
        }
    }

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

    private async list(req: Request, res: Response) {
        const WHERE: any = {};
        // const GroupID = req.query.GroupID;
        // if (GroupID !== void 0) {
        //     WHERE['GroupID'] = GroupID;
        // }
        const data = await User.findAll<User>({ where: WHERE });
        const result = data.map(u => {
            const curUser: IUser = u.toJSON();
            delete curUser.Hash;
            return curUser;
        });
        return res.json(result);
    }

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