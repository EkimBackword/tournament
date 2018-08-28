import {
    Table, Column, Model, DataType, ForeignKey, BelongsTo
} from 'sequelize-typescript';
import Tournament, { ITournament } from './Tournament';
import User, { IUser } from './User';

export interface IBanRequest {
    ID?: number;
    TournamentID: number;

    GamerBattleTag: string;
    GamerDeckList: string;
    GamerBannedDeck?: string;
    GamerResultInfo?: string;
    GamerChatID?: number;

    OpponentBattleTag: string;
    OpponentDeckList: string;
    OpponentBannedDeck?: string;
    OpponentResultInfo?: string;
    OpponentChatID?: number;

    Tournament?: ITournament;
}

@Table
export default class BanRequest extends Model<BanRequest> implements IBanRequest {
    @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
    ID: number;
    @ForeignKey(() => Tournament)
    @Column
    TournamentID: number;

    @Column({ type: DataType.STRING })
    GamerBattleTag: string;
    @Column({ type: DataType.STRING })
    GamerDeckList: string;
    @Column({ type: DataType.STRING, allowNull: true })
    GamerBannedDeck?: string;
    @Column({ type: DataType.STRING, allowNull: true })
    GamerResultInfo?: string;
    @Column({ type: DataType.INTEGER, allowNull: true })
    GamerChatID: number;

    @Column({ type: DataType.STRING })
    OpponentBattleTag: string;
    @Column({ type: DataType.STRING })
    OpponentDeckList: string;
    @Column({ type: DataType.STRING, allowNull: true })
    OpponentBannedDeck?: string;
    @Column({ type: DataType.STRING, allowNull: true })
    OpponentResultInfo?: string;
    @Column({ type: DataType.INTEGER, allowNull: true })
    OpponentChatID: number;

    @BelongsTo(() => Tournament, 'TournamentID')
    Tournament?: ITournament;
}
