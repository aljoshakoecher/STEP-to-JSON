const assert = require('chai').assert;
const expect = require('chai').expect;
const { join } = require('path');
const { readFileSync } = require('fs');
const { StepToJsonParser } = require('../src/parser.js');


const stepFile = readFileSync(join(__dirname, '/Workbench.stp'));
const parser = new StepToJsonParser(stepFile);


describe('Testing parser', () => {
    describe('Testing function to parse', () => {
        it('Parsed STEP-file should match expected result', () => {
            const actualResult = parser.parse();

            const fileContent = readFileSync(join(__dirname, 'Workbench.json'));
            const expectedResult = JSON.parse(fileContent);
            assert.deepEqual(actualResult, expectedResult, 'Parsed structure doesn\'t match the expected structure');
        });
    });


    describe('Test larger file of the MPS drilling module', () => {
        it('Should get a proper result', () => {
            const stepFile = readFileSync(join(__dirname, '/DrillingModule_min.stp'));
            const newParser = new StepToJsonParser(stepFile);

            const fileContent = readFileSync(join(__dirname, 'DrillingModule_min.json'));
            const expectedResult = JSON.parse(fileContent);
            const actualResult = newParser.parse();

            assert.deepEqual(actualResult, expectedResult, 'Parsed structure doesn\'t match the expected structure');
        });
    });

    describe('Testing parsing with a uuid', () => {
        it('All entries of parsed structure should contain a property "uuid"', () => {
            const actualResult = parser.parseWithUuid();

            // Assumption here: If rootObject.contains array has property 'uuid', then all components will have a property 'uuid'
            actualResult.contains.forEach((containedElement) => {
                expect(containedElement).to.haveOwnProperty('uuid');
            });
        });
    });
});

describe('Testing util functions', () => {
    describe('Testing function to fix special chars', () => {
        it('Umlauts should be fixed', () => {
            const stepRenderedTextWithUmlauts = '\\X\\C4 - \\X\\E4 - \\X\\D6 - \\X\\F6 - \\X\\DC - \\X\\FC';
            const textWithCorrectUmlauts = 'Ae - ae - Oe - oe - Ue - ue';

            assert.equal(StepToJsonParser.fixSpecialChars(stepRenderedTextWithUmlauts), textWithCorrectUmlauts, 'Function should fix German umlauts');
        });
    });

});



