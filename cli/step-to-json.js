// relevant imports
var fs = require("fs");
var colors = require('colors');
const yargs = require("yargs/yargs");
const cliProgress = require('cli-progress');
const parser = require('./../lib/parser');

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

