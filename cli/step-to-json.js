// relevant imports
const fs = require("fs");
const Subject = require("rxjs").Subject;
const colors = require('colors');
const yargs = require("yargs/yargs");
const cliProgress = require('cli-progress');
const StepToJsonParser = require('./../lib/parser');

const parser = new StepToJsonParser();

// cli-tool setup
const argv = yargs(process.argv)
    .wrap(132)
    .demand("fileName")
    .string("File Name")
    .describe("File Name", "the step file to be used, e.g. mystep.stp")

    .alias("f", "fileName")
    .argv;


console.time("Elapsed time")
console.log(`\nReading file "${argv.fileName}"`.yellow)

// count lines (for first progress bar)
let lines;
try {
    const file = fs.readFileSync(argv.fileName);
    lines = file.toString().split(";")
} catch (error) {
    if (error.code == "ENOENT") {
        console.error("Specified file could not be found...".red)
        process.exit(0)
    }
}


// Step 1: Preprocess the object
// (Setup progress bar, setup subscription for tracking progress, call parser function for preprocessing)
const preBar = new cliProgress.SingleBar({
    format: 'Preprocessing the step file \t|' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Lines',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
preBar.start(lines.length, 0);

const preprocessingSubject = new Subject();
preprocessingSubject.subscribe({
    next: (data) => {preBar.update(data)},
    complete: () => {preBar.stop()}
})

const preprocessedObject = parser.preprocessFileContent(lines, preprocessingSubject);


// Step 2: Parse all relations
// (Setup progress bar, setup subscription for tracking progress, call parser function for relation-parsing)
const relationsBar = new cliProgress.SingleBar({
    format: 'Parsing relations \t\t|' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Relations found',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
relationsBar.start(preprocessedObject.data.NEXT_ASSEMBLY_USAGE_OCCURRENCE.length, 0);

const assemblyUsageSubject = new Subject();
assemblyUsageSubject.subscribe({
    next:       (data) =>  {relationsBar.update(data)},
    complete:   () => {relationsBar.stop()}
});

const relations = parser.parse_NEXT_ASSEMBLY_USAGE_OCCURRENCE(preprocessedObject.data.NEXT_ASSEMBLY_USAGE_OCCURRENCE, assemblyUsageSubject);


// Step 3: Parse all products
// (Setup progress bar, setup subscription for tracking progress, call parser function for product-parsing)
const productBar = new cliProgress.SingleBar({
    format: 'Parsing products \t\t|' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Products found',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
productBar.start(preprocessedObject.data.PRODUCT_DEFINITION.length);

const productDefinitionSubject = new Subject();
productDefinitionSubject.subscribe({
    next:       (data) =>  {productBar.update(data)},
    complete:   () => {productBar.stop()}
});

const products = parser.parse_PRODUCT_DEFINITION(preprocessedObject.data.PRODUCT_DEFINITION, productDefinitionSubject);


const rootAssemblyObject = parser.identifyRootAssembly(products);


// add recursively to assembly object
const buildBar = new cliProgress.SingleBar({
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

// build first level assembly object
const assemblyObject = parser.buildStructureObject(rootAssemblyObject, buildSubject);

// write file
fs.writeFileSync("./assembly.json", JSON.stringify(assemblyObject));

//  provide feedback
console.log("Success!".green)
console.timeLog("Elapsed time")

