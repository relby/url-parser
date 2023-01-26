const isElementVisible = (dom, node) => (
    dom.window.getComputedStyle(node).display !== 'none'
)

const isElementValid = (dom, element) => (
    element.children.length === 0 && isElementVisible(dom, element) && /\p{L}+/u.test(element.textContent)
)

exports.getMostFrequentWords = (dom, wordCount) => {
    const { body } = dom.window.document;
    const map = new Map();
    const traverseDOM = (element) => {
        const { children, textContent: text } = element;
        if (isElementValid(dom, element)) {
            for (const word of text.split(/\P{L}+/u)) {
                if (word.length <= 4) continue;
                const count = map.get(word) ?? 0;
                map.set(word, count + 1);
            }
        }
        for (const child of children) {
            traverseDOM(child);
        }
    }
    traverseDOM(body);
    return [...map]
        .sort((a, b) => b[1] - a[1])
        .slice(0, wordCount)
        .map(e => e[0]);
}
