// relevant imports
var fs = require("fs");
var colors = require('colors');
const yargs = require("yargs/yargs");
const cliProgress = require('cli-progress');

// variables for preprocessed content
var FILE_NAME;
var FILE_SCHEMA;
var FILE_DESCRIPTION;
var PRODUCT_DEFINITIONS = [];
var NEXT_ASSEMBLY_USAGE_OCCURRENCE = [];

// preprocessed object
let step = {
    header: {
        FILE_DESCRIPTION: FILE_DESCRIPTION,
        FILE_NAME: FILE_NAME,
        FILE_SCHEMA: FILE_SCHEMA,
    },
    data: {
        PRODUCT_DEFINITION: PRODUCT_DEFINITIONS,
        NEXT_ASSEMBLY_USAGE_OCCURRENCE: NEXT_ASSEMBLY_USAGE_OCCURRENCE,
    }
}

// cmd line tool
const argv = yargs(process.argv)
    .wrap(132)
    .demand("filename")
    .string("filename")
    .describe("filename", "the step file to be used, e.g. mystep.stp")

    .alias("f", "filename")
    .argv;

//  start timer
console.time("Elapsed time")

// read the file and split lines by ";"
console.log("Reading the specified file ...".yellow)
try {
    var file = fs.readFileSync(argv.filename);
    var lines = file.toString().split(";")
} catch (error) {
    if (error.code == "ENOENT") {
        console.error("Specified file could not be found...".red)
        process.exit(0)
    }
}

// preprocess the content by tag
let preBar = new cliProgress.SingleBar({
    format: 'Preprocessing the step file |' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Lines',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
preBar.start(lines.length, 0);
for (let i = 0; i < lines.length; i++) {
    preBar.increment();
    let lineString = lines[i];
    if (lineString.includes("FILE_NAME")) {
        FILE_NAME = remove_linebreaks(lineString);
    } else if (lineString.includes("FILE_SCHEMA")) {
        FILE_SCHEMA = remove_linebreaks(lineString);
    } else if (lineString.includes("FILE_DESCRIPTION")) {
        FILE_DESCRIPTION = remove_linebreaks(lineString);
    } else if (lineString.includes("PRODUCT_DEFINITION(")) {
        PRODUCT_DEFINITIONS.push(remove_linebreaks(lineString));
    } else if (lineString.includes("NEXT_ASSEMBLY_USAGE_OCCURRENCE(")) {
        NEXT_ASSEMBLY_USAGE_OCCURRENCE.push(remove_linebreaks(lineString));
    }
}
preBar.stop();

// get relations and products
var relations = parse_NEXT_ASSEMBLY_USAGE_OCCURRENCE(step.data.NEXT_ASSEMBLY_USAGE_OCCURRENCE);
var products = parse_PRODUCT_DEFINITION(step.data.PRODUCT_DEFINITION);

var rootAssemblyObject = {}

// identify rootAssemblyKey
products.forEach(element => {
    let productKey = element.key;
    let productName = element.name;
    for (let i = 0; i < relations.length; i++) {

        if (relations[i].contains == productKey) {
            break
        } else if (relations[i].contains != productKey && i == (relations.length - 1)) {
            rootAssemblyObject = {
                key: productKey,
                name: productName,
            }
        }
    }
});

// build first level assembly object
var assemblyObject = buildStructureObject(rootAssemblyObject);

// add recursively to assembly object
let buildBar = new cliProgress.SingleBar({
    format: 'Building the output |' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Chunks',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
buildBar.start(relations.length, 0);
recursiveBuild(assemblyObject);
buildBar.update(relations.length);
buildBar.stop();

//  write file
fs.writeFileSync("./assembly.json", JSON.stringify(assemblyObject));

//  provide feedback
console.log("Success!".green)
console.timeLog("Elapsed time")
console.log("Analysed relations:                    " + relations.length)
console.log("Analysed assemblies and components:    " + products.length)


// 
// FUNCTIONS
// 

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

