import { Sequelize } from 'sequelize-typescript';
import { DB_CONFIG } from './config/database.config';

const db = new Sequelize({
    name: DB_CONFIG.name,
    username: DB_CONFIG.username,
    password: DB_CONFIG.password,
    host: DB_CONFIG.host,
    port: 5432,
    dialect: 'postgres',
    modelPaths: [__dirname + '/models'],
});

export default db;