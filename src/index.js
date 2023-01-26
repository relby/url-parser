'use strict';

const Hapi = require('@hapi/hapi');
const Joi = require('joi');
const { Readable } = require('stream');
const PDFDocument = require('pdfkit');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const Inert = require('@hapi/inert');
const Vision = require('@hapi/vision');
const HapiSwagger = require('hapi-swagger');
const PackageJSON = require('../package.json');

const { getMostFrequentWords } = require('./helpers');

const FONT_FILEPATH = './font.ttf';
const DEFAULT_WORD_COUNT = 3;

(async () => {
    const server = Hapi.server({
        port: process.env.PORT ?? 3000,
        host: process.env.HOST ?? 'localhost',
    });

    const swaggerOptions = {
        info: {
            title: PackageJSON.name,
            version: PackageJSON.version,
        },
    };

    await server.register([
        Inert,
        Vision,
        {
            plugin: HapiSwagger,
            options: swaggerOptions,
        },
    ]);

    server.route({
        method: 'GET',
        path: '/',
        handler: async (request, reply) => {
            return reply.redirect('/documentation');
        },
    });

    server.route({
        method: 'POST',
        path: '/',
        handler: async (request, reply) => {
            const { urls, wordCount } = request.payload;
            const doc = new PDFDocument();
            doc.font(FONT_FILEPATH).fontSize(16);
            for (const url of urls) {
                let color, text;
                try {
                    const { data, headers } = await axios.get(url);

                    if (!headers['content-type'].includes('text/html')) {
                        color = 'red';
                        text = 'Only html urls are valid';
                    } else {
                        const dom = new JSDOM(data);
                        const words = getMostFrequentWords(dom, wordCount);

                        color = 'blue';
                        text = words.length ? words.join(' | ') : 'No words have been found';
                    }
                } catch (e) {
                    console.log(e);
                    color = 'red';
                    text = `Couldn't fetch the website`;
                }
                // Put the url on the pdf
                doc
                    .fillColor(color)
                    .link(doc.x, doc.y, doc.widthOfString(url), doc.currentLineHeight(), url)
                    .underline(doc.x, doc.y, doc.widthOfString(url), doc.currentLineHeight(), { color })
                    .text(url)
                    .moveDown(0.2);
                // Put the 3 most frequent words on the pdf
                doc
                    .fillColor('black')
                    .text(text)
                    .moveDown(1);
            }
            doc.end();
            return h
                .response(new Readable().wrap(doc.pipe(request.raw.res)))
                .type('application/pdf');

        },
        options: {
            validate: {
                payload: Joi.object({
                    urls: Joi
                        .array()
                        .items(Joi.string().uri())
                        .required()
                        .min(1),
                    wordCount: Joi
                        .number()
                        .min(1)
                        .default(DEFAULT_WORD_COUNT),
                })
            },
            tags: ['api'],
        }
    })

    await server.start();
    console.log(`Server running on ${server.info.uri}`);
})();

process.on('unhandledRejection', (err) => {
    console.error(err);
    process.exit(1);
});
