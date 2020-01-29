// TODO: Fix vars and lets
const Subject = require("rxjs").Subject;

// relevant imports
var fs = require("fs");
var colors = require('colors');
const yargs = require("yargs/yargs");
const cliProgress = require('cli-progress');
const StepToJsonParser = require('./../lib/parser');

const parser = new StepToJsonParser();


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
    format: 'Preprocessing the step file \t|' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Lines',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
preBar.start(lines.length, 0);
// TODO: Loop can be stopped when all attributes are found...
for (let i = 0; i < lines.length; i++) {
    preBar.increment();
    let lineString = lines[i];
    if (lineString.includes("FILE_NAME")) {
        FILE_NAME = parser.remove_linebreaks(lineString);
    } else if (lineString.includes("FILE_SCHEMA")) {
        FILE_SCHEMA = parser.remove_linebreaks(lineString);
    } else if (lineString.includes("FILE_DESCRIPTION")) {
        FILE_DESCRIPTION = parser.remove_linebreaks(lineString);
    } else if (lineString.includes("PRODUCT_DEFINITION(")) {
        PRODUCT_DEFINITIONS.push(parser.remove_linebreaks(lineString));
    } else if (lineString.includes("NEXT_ASSEMBLY_USAGE_OCCURRENCE(")) {
        NEXT_ASSEMBLY_USAGE_OCCURRENCE.push(parser.remove_linebreaks(lineString));
    }
}
preBar.stop();

// get relations and products
let bar = new cliProgress.SingleBar({
    format: 'Parsing relations \t\t|' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Relations',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
bar.start(step.data.NEXT_ASSEMBLY_USAGE_OCCURRENCE.length, 0);
const assemblyUsageSubject = new Subject();
assemblyUsageSubject.subscribe({
    next:       (data) =>  {bar.update(data)},
    complete:   () => {bar.stop()}
});
    
var relations = parser.parse_NEXT_ASSEMBLY_USAGE_OCCURRENCE(step.data.NEXT_ASSEMBLY_USAGE_OCCURRENCE, assemblyUsageSubject);


let productBar = new cliProgress.SingleBar({
    format: 'Parsing products \t\t|' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Chunks',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
productBar.start(step.data.PRODUCT_DEFINITION.length);

const productDefinitionSubject = new Subject();
productDefinitionSubject.subscribe({
    next:       (data) =>  {productBar.update(data)},
    complete:   () => {productBar.stop()}
});

var products = parser.parse_PRODUCT_DEFINITION(step.data.PRODUCT_DEFINITION, productDefinitionSubject);

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
var assemblyObject = parser.buildStructureObject(rootAssemblyObject);

// add recursively to assembly object
let buildBar = new cliProgress.SingleBar({
    format: 'Building the output \t\t|' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Chunks',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
buildBar.start(relations.length, 0);

const buildSubject = new Subject();
buildSubject.subscribe({
    next:       (data) =>  {buildBar.update(data)},
    complete:   () => {buildBar.stop()}
});

parser.recursiveBuild(assemblyObject, buildSubject);


// write file
fs.writeFileSync("./assembly.json", JSON.stringify(assemblyObject));

//  provide feedback
console.log("Success!".green)
console.timeLog("Elapsed time")
console.log("Analysed relations:                    " + relations.length)
console.log("Analysed assemblies and components:    " + products.length)

