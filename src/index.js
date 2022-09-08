'use strict';

const Hapi = require('@hapi/hapi');
const Joi = require('joi');
const { Readable } = require('stream')
const PDFDocument = require('pdfkit')
const { parse } = require('node-html-parser')

const ignoreTags = ['SCRIPT', 'NOSCRIPT', 'STYLE', 'META', 'LINK'];

const get3MostFrequentWords = (node) => {
    const map = new Map();
    const traverseHTML = (node) => {
        const { childNodes, parentNode } = node;
        const isValid = !childNodes.length
            && !ignoreTags.includes(parentNode.tagName)
            && /\p{L}+/u.test(node.text);
        if (isValid) {
            for (const word of node.text.split(/\P{L}+/u)) {
                if (word.length <= 4) continue;
                const count = map.get(word) ?? 0;
                map.set(word, count + 1);
            }
        }
        for (const childNode of childNodes) {
            traverseHTML(childNode);
        }
    }
    traverseHTML(node);
    return [...map]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => e[0])
}

const init = async () => {

    const server = Hapi.server({
        port: process.env.PORT ?? 3000,
        host: process.env.HOST ?? 'localhost'
    });

    server.route({
        method: 'GET',
        path: '/',
        handler: async (request, h) => {
            return `Make a POST request with your urls to this route`
        }
    })

    server.route({
        method: 'POST',
        path: '/',
        handler: async (request, h) => {
            const { urls } = request.payload
            const doc = new PDFDocument();
            doc.font('./font.ttf').fontSize(16);
            for (const url of urls) {
                let color, text;
                try {
                    const res = await fetch(url)
                    const blob = await res.blob();
                    if (!blob.type.includes('text/html')) {
                        color = 'red'
                        text = 'Only html urls are valid'
                    } else {
                        const html = parse(await blob.text())
                        const body = html.querySelector('body');

                        const words = get3MostFrequentWords(body);

                        color = 'blue';
                        text = words.length ? words.join(' | ') : 'No words have been found';
                    }
                } catch (e) {
                    if (e instanceof TypeError && e.message === 'fetch failed') {
                        color = 'red'
                        text = `Couldn't fetch the website`
                    } else {
                        // Unhandled error
                        console.error(e)
                    }

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
                .type('application/pdf')

        },
        options: {
            validate: {
                payload: Joi.object({
                    urls: Joi.array().items(
                        Joi.string().uri()
                    ).min(1)
                })
            }
        }
    })

    await server.start();
    console.log(`Server running on ${server.info.uri}`);
};

process.on('unhandledRejection', (err) => {
    console.error(err);
    process.exit(1);
});

init().catch(err => {
    console.error(err);
    process.exit(1);
});
