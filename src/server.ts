import { RAVEN_CONFIG } from './config/database.config';
'use strict';

import * as express from 'express';
import * as bodyParser from 'body-parser';
import expressValidator = require('express-validator');
import session = require('express-session');
import * as passport from 'passport';
import * as Raven from 'raven';

import db from './db';


const cors = require('cors');
const cookieParser = require('cookie-parser');
const url = 'http://localhost';
const port = 30123;

/**
 * Create Express server.
 */
const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());
app.use(cors({ credentials: true, origin: true }));
app.use(session({
    secret: 'keyboard_cat',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/../../src'));

Raven.config(RAVEN_CONFIG.url).install();
app.use(Raven.requestHandler());

import './authentication';
import { UserController } from './controllers/User.controller';
import { TournamentController } from './controllers/Tournament.controller';
import { FilesController } from './controllers/Files.controller';
import { TelegramService } from './telegram/telegram.service';

app.get('/test', (req, res) => {
    res.send('Тест');
    // setTimeout(() => {
    //     throw 'Тестовая Ошибка';
    // }, 1000);
});
new TelegramService();
new UserController(app);
new TournamentController(app);
new FilesController(app);

db.authenticate()
    .then(() => db.sync())
    .then(() => {
        /**
         * Start Express server.
         */
        app.listen(port, () => {
            console.log(('  App is running at http://localhost:%d'), port);
            console.log('  Press CTRL-C to stop\n');
        });
    });


module.exports = app;