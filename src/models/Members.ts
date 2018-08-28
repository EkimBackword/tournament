import {
    Table, Column, Model, DataType, ForeignKey, BelongsTo
} from 'sequelize-typescript';
import Tournament, { ITournament } from './Tournament';
import User, { IUser } from './User';

export interface IMembers {
    ID?: number;
    TournamentID: number;
    UserID: number;
    DeckList: string;
}

export enum UserRoles {
    admin = 'admin',
    user = 'user',
}

@Table
export default class Members extends Model<Members> implements IMembers {
    @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
    ID: number;
    @ForeignKey(() => Tournament)
    @Column
    TournamentID: number;
    @ForeignKey(() => User)
    @Column
    UserID: number;

    @BelongsTo(() => User, 'UserID')
    User?: IUser;
    @BelongsTo(() => Tournament, 'TournamentID')
    Tournament?: ITournament;

    /** [].join(',') */
    @Column({ type: DataType.TEXT })
    DeckList: string;
}
