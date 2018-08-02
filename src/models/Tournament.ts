import {
    Table, Column, Model, HasMany, CreatedAt,
    UpdatedAt, DataType, Validate, DefaultScope, BelongsToMany, ForeignKey, BelongsTo
} from 'sequelize-typescript';
import { Request } from 'express';
import User, { IUser } from './User';

export interface ITournament {
    ID?: number;
    Title: string;
    JsonData: string;
    UserID?: number;

    User?: IUser;
}

@Table
export default class Tournament extends Model<Tournament> implements ITournament {
    @Column({ primaryKey: true, type: DataType.INTEGER, autoIncrement: true })
    ID: number;
    @Column({ type: DataType.STRING })
    Title: string;
    @Column({ type: DataType.TEXT })
    JsonData: string;
    @Column({ type: DataType.INTEGER, allowNull: true })
    UserID?: number;

    @BelongsTo(() => User, 'UserID')
    User?: IUser;
}