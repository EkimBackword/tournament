import fs = require('fs');
import * as path from 'path';
import * as util from 'util';
import { Stream } from 'stream';
// import * as $ from 'jquery';

export function flow (temporaryFolder: any) {
    const $ = this;
    $.temporaryFolder = temporaryFolder;
    $.maxFileSize = null;
    $.fileParameterName = 'file';

    try {
        fs.mkdirSync($.temporaryFolder);
    } catch (e) {}

    function cleanIdentifier(identifier: any) {
        return identifier.replace(/[^0-9A-Za-z_-]/g, '');
    }

    function getChunkFilename(chunkNumber: any, identifier: any) {
        // Clean up the identifier
        identifier = cleanIdentifier(identifier);
        // What would the file name be?
        return path.resolve($.temporaryFolder, './flow-' + identifier + '.' + chunkNumber);
    }

    function validateRequest(chunkNumber: any, chunkSize: any, totalSize: any, identifier: any, filename: any, fileSize?: any) {
        // Clean up the identifier
        identifier = cleanIdentifier(identifier);

        // Check if the request is sane
        if (chunkNumber == 0 || chunkSize == 0 || totalSize == 0 || identifier.length == 0 || filename.length == 0) {
            return 'non_flow_request';
        }
        const numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize * 1.0)), 1);
        if (chunkNumber > numberOfChunks) {
            return 'invalid_flow_request1';
        }

        // Is the file too big?
        if ($.maxFileSize && totalSize > $.maxFileSize) {
            return 'invalid_flow_request2';
        }

        if (typeof(fileSize) != 'undefined') {
            if (chunkNumber < numberOfChunks && fileSize != chunkSize) {
                // The chunk in the POST request isn't the correct size
                return 'invalid_flow_request3';
            }
            if (numberOfChunks > 1 && chunkNumber == numberOfChunks && fileSize != ((totalSize % chunkSize) + parseInt(chunkSize))) {
                // The chunks in the POST is the last one, and the fil is not the correct size
                return 'invalid_flow_request4';
            }
            if (numberOfChunks == 1 && fileSize != totalSize) {
                // The file is only a single chunk, and the data size does not fit
                return 'invalid_flow_request5';
            }
        }

        return 'valid';
    }

    // 'found', filename, original_filename, identifier
    // 'not_found', null, null, null
    $.get = function(req: any, callback: any) {
        const chunkNumber = req.param('flowChunkNumber', 0);
        const chunkSize = req.param('flowChunkSize', 0);
        const totalSize = req.param('flowTotalSize', 0);
        const identifier = req.param('flowIdentifier', '');
        const filename = req.param('flowFilename', '');

        if (validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename) === 'valid') {
            const chunkFilename = getChunkFilename(chunkNumber, identifier);
            fs.exists(chunkFilename, function(exists) {
                if (exists) {
                    callback('found', chunkFilename, filename, identifier);
                } else {
                    callback('not_found', null, null, null);
                }
            });
        } else {
            callback('not_found', null, null, null);
        }
    };

    // 'partly_done', filename, original_filename, identifier
    // 'done', filename, original_filename, identifier
    // 'invalid_flow_request', null, null, null
    // 'non_flow_request', null, null, null
    $.post = function(req: any, callback: any) {

        const fields = req.body;
        const files = req.files;

        const chunkNumber = fields['flowChunkNumber'];
        const chunkSize = fields['flowChunkSize'];
        const totalSize = fields['flowTotalSize'];
        const identifier = cleanIdentifier(fields['flowIdentifier']);
        const filename = fields['flowFilename'];

        if (!files[$.fileParameterName] || !files[$.fileParameterName].size) {
            callback('invalid_flow_request', null, null, null);
            return;
        }

        const original_filename = files[$.fileParameterName]['originalFilename'];
        const validation = validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename, files[$.fileParameterName].size);
        if (validation == 'valid') {
            const chunkFilename = getChunkFilename(chunkNumber, identifier);

            // Save the chunk (TODO: OVERWRITE)
            fs.rename(files[$.fileParameterName].path, chunkFilename, function() {

                // Do we have all the chunks?
                let currentTestChunk = 1;
                const numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize * 1.0)), 1);
                const testChunkExists = function() {
                    fs.exists(getChunkFilename(currentTestChunk, identifier), function(exists) {
                        if (exists) {
                            currentTestChunk++;
                            if (currentTestChunk > numberOfChunks) {
                                callback('done', filename, original_filename, identifier);
                            } else {
                                // Recursion
                                testChunkExists();
                            }
                        } else {
                            callback('partly_done', filename, original_filename, identifier);
                        }
                    });
                };
                testChunkExists();
            });
        } else {
            callback(validation, filename, original_filename, identifier);
        }
    };

    // Pipe chunks directly in to an existsing WritableStream
    //   r.write(identifier, response);
    //   r.write(identifier, response, {end:false});
    //
    //   var stream = fs.createWriteStream(filename);
    //   r.write(identifier, stream);
    //   stream.on('data', function(data){...});
    //   stream.on('finish', function(){...});
    $.write = function(identifier: any, writableStream: any, options: any) {
        options = options || {};
        options.end = (typeof options['end'] == 'undefined' ? true : options['end']);

        // Iterate over each chunk
        const pipeChunk = function(number: any) {

            const chunkFilename = getChunkFilename(number, identifier);
            fs.exists(chunkFilename, function(exists) {

                if (exists) {
                    // If the chunk with the current number exists,
                    // then create a ReadStream from the file
                    // and pipe it to the specified writableStream.
                    const sourceStream = fs.createReadStream(chunkFilename);
                    sourceStream.pipe(writableStream, {
                        end: false
                    });
                    sourceStream.on('end', function() {
                        // When the chunk is fully streamed,
                        // jump to the next one
                        pipeChunk(number + 1);
                    });
                } else {
                    // When all the chunks have been piped, end the stream
                    if (options.end) writableStream.end();
                    if (options.onDone) options.onDone();
                }
            });
        };
        pipeChunk(1);
    };

    $.clean = function(identifier: any, options: any) {
        options = options || {};

        // Iterate over each chunk
        const pipeChunkRm = function(number: any) {

            const chunkFilename = getChunkFilename(number, identifier);

            // console.log('removing pipeChunkRm ', number, 'chunkFilename', chunkFilename);
            fs.exists(chunkFilename, function(exists) {
                if (exists) {

                    console.log('exist removing ', chunkFilename);
                    fs.unlink(chunkFilename, function(err) {
                        if (err && options.onError) options.onError(err);
                    });

                    pipeChunkRm(number + 1);

                } else {

                    if (options.onDone) options.onDone();

                }
            });
        };
        pipeChunkRm(1);
    };

    return $;
}
