'use strict';

const Hapi = require('@hapi/hapi');
const Joi = require('joi');
const { Readable } = require('stream')
const PDFDocument = require('pdfkit')
const { parse } = require('node-html-parser')

const getMost3Frequent = (root) => {
    const map = new Map();
    const traverseHTML = (root) => {
        const { childNodes, parentNode } = root;
        const isValidTag = !parentNode.tagName.includes('SCRIPT') && parentNode.tagName !== 'STYLE';
        if (isValidTag && !childNodes.length && /\p{L}+/u.test(root.text)) {
            for (const word of root.text.split(/\P{L}+/u)) {
                if (word.length <= 4) continue;
                const count = map.get(word) ?? 0;
                map.set(word, count + 1);
            }
        }
        for (const childNode of childNodes) {
            traverseHTML(childNode);
        }
    }
    traverseHTML(root);
    return [...map]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => e[0])
}

const init = async () => {

    const server = Hapi.server({
        port: 3000,
        host: 'localhost'
    });

    server.route({
        method: 'POST',
        path: '/',
        handler: async (request, h) => {
            const { payload: urls } = request
            const doc = new PDFDocument();
            doc.font('./font.ttf').fontSize(16);
            for (const url of urls) {
                let color;
                let text;
                try {
                    const html = parse(await (await fetch(url)).text());
                    const body = html.querySelector('body')

                    color = 'blue'
                    text = getMost3Frequent(body).join(' | ')

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
                // Put the most 3 frequent words on the pdf
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
                payload: Joi.array().items(
                    Joi.string().uri()
                )
            }
        }
    })

    await server.start();
    console.log(`Server running on ${server.info.uri}`);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();
