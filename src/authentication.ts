import * as passport from 'passport';
const passwordHash = require('password-hash');
import { Strategy } from 'passport-local';
import User, { IUser } from './models/User';
import { Request, Response, NextFunction } from 'express';

passport.serializeUser((user: IUser, done) => {
    done(null, user.ID);
});

passport.deserializeUser(async (id, done) => {
    const user = await User.findOne<User>({ where: { ID: id } });
    const profile: IUser = user.toJSON();
    delete profile.Hash;
    done(null, profile);
    });

passport.use(new Strategy({
        usernameField: 'Login',
        passwordField: 'Password'
    },
    async (username, password, done) => {
        findUser(username, (err, user) => {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false, { message: 'Некорректый Логин' });
            }
            if (!passwordHash.verify(password, user.Hash)) {
                return done(null, false, { message: 'Некорректый Пароль' });
            }
            delete user.Hash;
            return done(null, user);
        });
    })
);

const findUser = async (username: string, callback: (err: any, user?: IUser) => any) => {
    try {
        const _user = await User.findOne<User>({ where: { Login: username } });
        callback(null, _user.toJSON());
    } catch (err) {
        callback(err);
    }
};

export const isAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.isUnauthenticated()) {
        return res.status(401).json();
    }
    next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.isUnauthenticated()) {
        return res.status(401).json();
    }
    if (req.user.Role !== 'admin') {
        return res.status(403)
                .json({message: 'Доступно только администратору'});
    }
    next();
};
