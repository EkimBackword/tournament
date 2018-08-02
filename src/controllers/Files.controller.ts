import { Application, Request, Response, NextFunction, Router } from 'express';
import { isAuth, requireAdmin } from '../authentication';
import { flow } from '../node-flow';
import File, { IFile } from '../models/Files';
const multipart = require('connect-multiparty');

export class FilesController {
    private flow = flow('files');
    private multipartMiddleware = multipart();

    constructor(app: Application) {
        const router = Router();
        router.options('/upload', this.uploadOptions);
        router.get('/upload', this.uploadGet);
        router.post('/upload', this.multipartMiddleware, this.upload);
        router.get('/download/:identifier', this.download);

        app.use('/files', router);
    }

    private async upload (req: Request, res: Response) {
        this.flow.post(req, async (status: any, filename: any, original_filename: any, identifier: any) => {
            console.log('POST', status, original_filename, identifier);

            if (status === 'done') {
                const file: IFile = {
                    Path: 'files',
                    Name: 'original_filename',
                    Ext: ''
                };
                let newFile = new File(file);
                newFile = await newFile.save();
                return res.status(status).json({file: newFile});
            }

            // if (ACCESS_CONTROLL_ALLOW_ORIGIN) {
            // res.header("Access-Control-Allow-Origin", "*");
            // }

            res.status(status).json();
        });
    }

    private async uploadOptions (req: Request, res: Response) {
        console.log('OPTIONS');
        // if (ACCESS_CONTROLL_ALLOW_ORIGIN) {
        // res.header("Access-Control-Allow-Origin", "*");
        // }
        res.status(200).json();
    }

    private async download (req: Request, res: Response) {
        this.flow.write(req.params.identifier, res);
    }

    private async uploadGet (req: Request, res: Response) {
        this.flow.get(req, (status: any, filename: any, original_filename: any, identifier: any) => {
            console.log('GET', status);

            // if (ACCESS_CONTROLL_ALLOW_ORIGIN) {
            //     res.header("Access-Control-Allow-Origin", "*");
            // }

            if (status == 'found') {
                status = 200;
            } else {
                status = 204;
            }

            res.status(status).json();
        });
    }
}