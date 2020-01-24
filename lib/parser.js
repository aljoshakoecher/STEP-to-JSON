
/**
 * Parses the lines of the next assembly usage occurrence and extracts key of relation, container key, contained key and contained name
 *
 * @param {Array<string>} Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs
 * @returns
 */
function parse_NEXT_ASSEMBLY_USAGE_OCCURRENCE(Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs) {

    let bar = new cliProgress.SingleBar({
        format: 'Parsing relations |' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Chunks',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });
    bar.start(Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs.length, 0);

    let assemblyRelations = [];
    Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs.forEach(element => {
        bar.increment();
        let endOfKey = element.indexOf("=");
        let newKey = element.slice(1, endOfKey);
        let newName;
        let upperPart;
        let lowerPart;

        let entries = element.split(",");
        entries.forEach(element => {

            if (element.includes("'")) {
                newName = element.replace(/['\)]/g, "")
            } else if (element.includes("#") && upperPart === undefined) {
                upperPart = element.replace(/[#]/g, "")
            } else if (element.includes("#")) {
                lowerPart = element.replace(/[#]/g, "")
            }
        });

        let assemblyObject = {
            key: newKey,
            container: upperPart,
            contains: lowerPart,
            containedName: newName
        }
        assemblyRelations.push(assemblyObject);
    });
    bar.stop();
    return assemblyRelations;
}

/**
 * Parses the lines of the product definition and extracts key and name
 *
 * @param {Array<string>} Array_of_PRODUCT_DEFINITIONs
 * @returns
 */
function parse_PRODUCT_DEFINITION(Array_of_PRODUCT_DEFINITIONs) {
    let bar = new cliProgress.SingleBar({
        format: 'Parsing products |' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Chunks',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });
    bar.start(Array_of_PRODUCT_DEFINITIONs.length, 0);
    let products = [];

    Array_of_PRODUCT_DEFINITIONs.forEach(element => {
        bar.increment();
        let endOfKey = element.indexOf("=");
        let newKey = element.slice(1, endOfKey);
        let newName;

        let entries = element.split(",");
        entries.forEach(element => {

            if (element.includes("'")) {
                newName = element.replace(/['\)]/g, "")
            }
        });
        let productObject = {
            key: newKey,
            name: newName
        }
        products.push(productObject);

    });
    bar.stop();
    return products;
}


/**
 * Manupulates the structureObject recursively
 *
 * @param {Object} structureObject
 */
function recursiveBuild(structureObject) {
    buildBar.increment();
    for (let i = 0; i < structureObject.contains.length; i++) {

        let currentKey = structureObject.contains[i].key;
        if (isContainer(currentKey)) {
            structureObject.contains[i] = buildStructureObject(structureObject.contains[i])
            recursiveBuild(structureObject.contains[i]);
        } else {
            continue
        }
    }
}

/**
 * Returns a containment structure object for a given product object that has key and name
 *
 * @param {Object} ProductObject
 * @returns
 */
function buildStructureObject(ProductObject) {

    let structureObject = {
        key: ProductObject.key,
        name: ProductObject.name,
        contains: []
    }

    relations.forEach(element => {
        if (element.container == structureObject.key) {
            let productObject = {
                key: element.contains,
                name: getProductName(element.contains)
            }
            structureObject.contains.push(productObject);
        }
    });

    return structureObject;
}

/**
 * Checks if a productKey serves as a container for other products
 *
 * @param {*} productKey
 * @returns
 */
function isContainer(productKey) {
    let isContainer = false;
    relations.forEach(element => {
        if (element.container == productKey) {
            isContainer = true;
        }
    });
    return isContainer;
}


/**
 * Returns the name for a given product key
 *
 * @param {*} productKey
 * @returns
 */
function getProductName(productKey) {
    let productName = "";
    products.forEach(element => {
        if (element.key == productKey) {
            productName = element.name;
        }
    });
    return productName;
}

function remove_linebreaks(str) {
    return str.replace(/[\r\n]+/gm, "");
}

