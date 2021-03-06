import {List, OrderedSet, fromJS} from 'immutable';
import {stateFromHTML} from 'draft-js-import-html';
import docsSoap from 'docs-soap';
import {inlineStyles} from '../../helpers/inlineStyles';

import {
    ContentBlock,
    CharacterMetadata,
    Entity,
    ContentState,
    convertFromHTML,
    convertToRaw,
} from 'draft-js';

const elementStyles = {
    sub: inlineStyles.subscript,
    sup: inlineStyles.superscript,
    strike: inlineStyles.strikethrough,
    s: inlineStyles.strikethrough,
};

/**
 * @ngdoc class
 * @name HTMLParser
 * @description HTMLParser is a class that takes HTML and returns a ContentState. At
 * its simplest form, it uses `convertFromHTML` from draft-js to do this operation.
 *
 * To make it compatible with Editor3, it additionally processes Editor3 atomic blocks,
 * such as tables, images and embeds. To process these blocks, which `convertFromHTML`
 * doesn't do, it simply extracts the nodes from the HTML before processing it, and saves
 * them in a separate structure, replacing the nodes with <figure> tags that contain text
 * indicating in which structure and at which position the information was saved.
 *
 * Afterwards, it traverses the returned blocks, looking for atomic blocks. When an atomic
 * block is found, it reads its text, and if it indicates one of the saved structures along
 * with an ID, it creates the needed block.
 *
 * This "small hack" allows us to use a reliable HTML convertor provided by DraftJS, as
 * well as accommodate Editor3 custom atomic blocks.
 */
export class HTMLParser {
    constructor(html) {
        this.figures = {};
        this.tables = {};
        this.media = {};
        this.tree = $('<div></div>');

        this.createTree(html);
    }

    /**
     * @name HTMLParser#createTree
     * @param {string} html
     * @description Takes the given HTML, extracts the atomic blocks, and creates
     * the tree to be parsed by the DraftJS's convertor.
     */
    createTree(html) {
        const _html = docsSoap.default(html); // Needed for Google docs

        this.tree.html(_html);
        this.pruneNodes();
    }

    /**
     * @name HTMLParser#pruneNodes
     * @description Replaces the nodes that need to be converted to atomic blocks
     * with <figure> tags containing text indicating the type of block that is needed
     * there, along with an ID. The ID links to a structure that stores information
     * about the HTML that was extracted.
     */
    pruneNodes() {
        this.tree.find('figure').each((i, node) => {
            this.figures[i] = $(node).html();
            $(node).replaceWith(`<figure>BLOCK_FIGURE_${i}></figure>`);
        });

        this.tree.find('table').each((i, node) => {
            this.tables[i] = $(node).html();
            $(node).replaceWith(`<figure>BLOCK_TABLE_${i}</figure>`);
        });

        this.tree.find('.media-block, img, audio, video').each((i, node) => {
            this.media[i] = $(node)[0].outerHTML;
            $(node).replaceWith(`<figure>BLOCK_MEDIA_${i}</figure>`);
        });
    }

    /**
     * @name HTMLParser#contentState
     * @description Returns the full content state corresponding to the HTML that
     * initialized the instance.
     * @returns {ContentState} contentState
     */
    contentState() {
        const processBlock = this.processBlock.bind(this);
        let contentState = stateFromHTML(this.tree.html(), {
            elementStyles,
        });

        contentState = this.processLinks(contentState);

        return ContentState.createFromBlockArray(
            contentState.getBlocksAsArray().map(processBlock),
            contentState.getEntityMap()
        );
    }

    /**
     * Convert link entity data to editor3 format
     *
     * @param {ContentState} initialState
     * @returns {ContentState}
     */
    processLinks(initialState) {
        let contentState = initialState;

        contentState.getBlocksAsArray().forEach((block) => {
            block.findEntityRanges((characterMetadata) => characterMetadata.getEntity(), (start, end) => {
                const key = block.getEntityAt(start);

                if (key != null) {
                    const entity = contentState.getEntity(key);

                    if (entity.type === 'LINK') {
                        contentState = contentState.replaceEntityData(key, {
                            link: {href: entity.getData().url},
                        });
                    }
                }
            });
        });

        return contentState;
    }

    /**
     * @name HTMLParser#processBlock
     * @param {ContentBlock} block
     * @description Processes the given block. If it's an atomic block that has text
     * indicating the ID of a pruned node, it returns the new corresponding block.
     * @returns {ContentBlock} New block.
     */
    processBlock(block) {
        const isAtomic = block.getType() === 'atomic';
        const isTable = block.getText().startsWith('BLOCK_TABLE_');
        const isMedia = block.getText().startsWith('BLOCK_MEDIA_');
        const isFigure = block.getText().startsWith('BLOCK_FIGURE_');

        if (isAtomic && isTable) {
            return this.createTableBlock(block);
        }

        if (isAtomic && isMedia) {
            return this.createMediaBlock(block);
        }

        if (isAtomic && isFigure) {
            return this.createFigureBlock(block);
        }

        return block;
    }

    /**
     * Create atomic block for embeds
     *
     * @param {ContentBlock} block
     * @returns {ContentBlock}
     */
    createFigureBlock(block) {
        const id = this.getBlockId(block);
        const html = this.figures[id];

        return atomicBlock(block, 'EMBED', 'MUTABLE', {
            data: {html: html},
        });
    }

    /**
     * @name HTMLParser#createTableBlock
     * @param {ContentBlock} block
     * @description Takes an unprocessed atomic block (that is assumed to be a
     * soon-to-be table block) and processes it.
     * @returns {ContentBlock} The fully restored table block.
     */
    createTableBlock(block) {
        const id = this.getBlockId(block);
        const tableHTML = this.tables[id];
        const tableNode = $('<table></table>');

        tableNode.html(tableHTML);

        const rows = tableNode.find('tr');
        const numRows = rows.length;
        const numCols = rows.first().find('th,td').length;

        let cells = [];

        for (let i = 0; i < numRows; i++) {
            for (let j = 0; j < numCols; j++) {
                const row = $(rows[i]);
                const col = $(row.find('th,td')[j]);
                const {contentBlocks, entityMap} = convertFromHTML(col.html());
                const cellContentState = ContentState.createFromBlockArray(contentBlocks, entityMap);

                cells[i] = cells[i] || [];
                cells[i][j] = convertToRaw(cellContentState);
            }
        }

        return atomicBlock(block, 'TABLE', 'MUTABLE', {data: {numRows, numCols, cells}});
    }

    /**
     * Get block id from block text
     *
     * @param {ContentBlock} block
     * @returns {number}
     */
    getBlockId(block) {
        return parseInt(block.getText()
            .split('_')
            .pop(),
        10);
    }

    /**
     * @name HTMLParser#createMediaBlock
     * @param {ContentBlock} block
     * @description Takes an unprocessed atomic block (that is assumed to be a
     * an image block) and processes it.
     * @returns {ContentBlock} The restored image block.
     */
    createMediaBlock(block) {
        const id = this.getBlockId(block);
        const html = this.media[id];
        const node = $('<div />');

        node.html(html);

        let media = node.find('img');
        let type = 'picture';

        if (!media) {
            media = node.find('video');
            type = 'video';
        }

        if (!media) {
            media = node.find('audio');
            type = 'audio';
        }

        const href = media.attr('src');
        const alt = media.attr('alt');
        const txt = node.find('.media-block__description').text();

        return atomicBlock(block, 'MEDIA', 'MUTABLE', {
            media: {
                alt_text: alt,
                description_text: txt,
                renditions: {viewImage: {href}},
                type: type,
            },
        });
    }
}

/**
 * @name atomicBlock
 * @param {Object} block The block to copy
 * @param {string} entityType
 * @param {string} entityMutability Mutability type (MUTABLE, IMMUTABLE).
 * @param {Object} entityData
 * @description Returns the given block, having its text replaced by one space that
 * has the corresponding character metadata linked to the given entity.
 * @returns {Object} The new atomic block.
 */
function atomicBlock(block, entityType, entityMutability, entityData) {
    // TODO(gbbr): Will not work with DraftJS 0.11
    const entityKey = Entity.create(entityType, entityMutability, entityData);
    const text = ' ';
    const {type, key, depth} = block.toJS();
    const data = fromJS(block.toJS().data);

    const char = CharacterMetadata.create({
        style: OrderedSet([]),
        entity: entityKey,
    });

    const characterList = List([char]);

    return new ContentBlock({type, key, depth, data, text, characterList});
}
