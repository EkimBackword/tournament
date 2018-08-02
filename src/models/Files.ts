import {
    Table, Column, Model, HasMany, CreatedAt,
    UpdatedAt, DataType, Validate, DefaultScope, BelongsToMany, ForeignKey, BelongsTo
} from 'sequelize-typescript';
import { Request } from 'express';

export interface IFile {
    ID?: number;
    Path: string;
    Name: string;
    Ext: string;
}

@Table
export default class File extends Model<File> implements IFile {
    @Column({ primaryKey: true, type: DataType.INTEGER, autoIncrement: true })
    ID: number;
    @Column({ type: DataType.STRING })
    Path: string;
    @Column({ type: DataType.STRING })
    Name: string;
    @Column({ type: DataType.STRING })
    Ext: string;
}