const Subject = require("rxjs").Subject;
const colors = require('colors');
const yargs = require("yargs/yargs");
const cliProgress = require('cli-progress');
const fs = require("fs");
const {StepToJsonParser} = require('./../src/parser.js');


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

const file = fs.readFileSync(argv.fileName);
const parser = new StepToJsonParser(file);


const preprocessedObject = parser.getPreProcessedObject();


// Step 1: Parse all relations
// (Setup progress bar, setup subscription for tracking progress, call parser function for relation-parsing)
const relationsBar = new cliProgress.SingleBar({
    format: 'Parsing relations \t\t|' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Relations parsed',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
relationsBar.start(preprocessedObject.data.nextAssemblyUsageOccurences.length, 0);

const assemblyUsageSubject = new Subject();
assemblyUsageSubject.subscribe({
    next:       (data) =>  {relationsBar.update(data)},
    complete:   () => {relationsBar.stop()}
});

const relations = parser.parseNextAssemblyUsageOccurences(preprocessedObject.data.nextAssemblyUsageOccurences, assemblyUsageSubject);


// Step 2: Parse all products
// (Setup progress bar, setup subscription for tracking progress, call parser function for product-parsing)
const productBar = new cliProgress.SingleBar({
    format: 'Parsing products \t\t|' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Products parsed',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});
productBar.start(preprocessedObject.data.productDefinitions.length);

const productDefinitionSubject = new Subject();
productDefinitionSubject.subscribe({
    next:       (data) =>  {productBar.update(data)},
    complete:   () => {productBar.stop()}
});

const products = parser.parseProductDefinitions(preprocessedObject.data.productDefinitions, productDefinitionSubject);


const rootAssemblyObject = parser.identifyRootAssembly();


// add recursively to assembly object
const buildBar = new cliProgress.SingleBar({
    format: 'Building the output \t\t|' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Relations analyzed',
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
const result = parser.buildStructureObject(rootAssemblyObject, buildSubject);

const newFileName = argv.fileName.split(".stp")[0] + ".json";
fs.writeFileSync(newFileName, JSON.stringify(result));

console.log("Success!".green)
console.timeLog("Elapsed time")
