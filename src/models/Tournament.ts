import {
    Table, Column, Model, HasMany, CreatedAt,
    UpdatedAt, DataType, Validate, DefaultScope, BelongsToMany, ForeignKey, BelongsTo
} from 'sequelize-typescript';
import { Request } from 'express';
import User, { IUser } from './User';
import Members, { IMembers } from './Members';

export interface ITournament {
    ID?: number;
    Title: string;
    JsonData: string;
    Status: TournamentStatusENUM;
    DeckCount: number;
    DeckForGroup?: number;
    DeckForPlayoff?: number;
    UserID?: number;
    CreationDate?: Date;
    UpdatedAt?: Date;

    User?: IUser;
    Members?: IMembers[];
}

@Table
export default class Tournament extends Model<Tournament> implements ITournament {
    @Column({ primaryKey: true, type: DataType.INTEGER, autoIncrement: true })
    ID: number;
    @Column({ type: DataType.STRING })
    Title: string;
    @Column({ type: DataType.TEXT })
    JsonData: string;
    @Column({ type: DataType.INTEGER, defaultValue: 0 })
    Status: TournamentStatusENUM;
    @Column({ type: DataType.INTEGER, defaultValue: 4 })
    DeckCount: number;
    @Column({ type: DataType.INTEGER, defaultValue: 3 })
    DeckForGroup?: number;
    @Column({ type: DataType.INTEGER, defaultValue: 4 })
    DeckForPlayoff?: number;
    @ForeignKey(() => User)
    @Column({ type: DataType.INTEGER, allowNull: true })
    UserID?: number;
    @CreatedAt
    @Column({ allowNull: true })
    CreationDate?: Date;
    @UpdatedAt
    @Column({ allowNull: true })
    UpdatedAt?: Date;

    @BelongsTo(() => User, 'UserID')
    User?: IUser;
    @HasMany(() => Members, 'TournamentID')
    Members?: IMembers[];

    /**
     * @description Проверка модели запроса авторизации
     * @param req Объект запроса
     */
    static async checkModel(req: Request) {
        req.assert('Title', 'Поле Title не может быть пустым').notEmpty();
        req.assert('JsonData', 'Поле JsonData не может быть пустым').notEmpty();

        const errors = await req.getValidationResult();
        if (errors.isEmpty()) return null;
        return errors.array({onlyFirstError: true})[0];
    }
}

export enum TournamentStatusENUM {
    'new',
    'start',
    'finished'
}