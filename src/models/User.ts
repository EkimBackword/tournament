import {
    Table, Column, Model, HasMany, CreatedAt,
    UpdatedAt, DataType, Validate, DefaultScope, BelongsToMany, BelongsTo, ForeignKey
} from 'sequelize-typescript';
import { Request } from 'express';
import Tournament, { ITournament } from './Tournament';

export interface IUser {
    ID?: number;
    Login: string;
    FIO: string;
    Role: UserRoles;
    Hash: string;

    Tournaments?: ITournament[];
}

export enum UserRoles {
    admin = 'admin',
    user = 'user',
}

@Table
export default class User extends Model<User> implements IUser {
    @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
    ID: number;
    @Column({ type: DataType.STRING })
    Login: string;
    @Column({ type: DataType.STRING })
    FIO: string;
    @Column({ type: DataType.STRING })
    Role: UserRoles;
    @Column({ type: DataType.STRING })
    Hash: string;

    @HasMany(() => Tournament, 'UserID')
    Tournaments?: ITournament[];

    /**
     * @description Проверка полной модели пришедшей в запросе
     * @param req Объект запроса
     */
    static async checkFullModel(req: Request, withoutPassword: boolean = false ) {
        req.assert('Login', 'Логин не может быть пустым').notEmpty();
        if (!withoutPassword) {
            req.assert('Password', 'Пароль не может быть пустым').notEmpty();
        }
        req.assert('FIO', 'ФИО не может быть пустым').notEmpty();
        req.assert('Role', 'Роль должна быть одной из списка (Админнистратор, преподаватель или студент)').notEmpty();

        const errors = await req.getValidationResult();
        if (errors.isEmpty()) return null;
        return errors.array({onlyFirstError: true})[0];
    }

    /**
     * @description Проверка модели запроса авторизации
     * @param req Объект запроса
     */
    static async checkLoginModel(req: Request) {
        req.assert('Login', 'Логин не может быть пустым').notEmpty();
        req.assert('Password', 'Пароль не может быть пустым').notEmpty();

        const errors = await req.getValidationResult();
        if (errors.isEmpty()) return null;
        return errors.array({onlyFirstError: true})[0];
    }
}