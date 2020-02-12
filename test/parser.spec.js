import { assert } from "chai"
import * as fs  from "fs";
import {StepToJsonParser} from "../src/parser"


const stepFile = fs.readFileSync(__dirname +  "/Workbench.stp")
const parser = new StepToJsonParser(stepFile);


describe("Testing parser", () => {
    describe("Testing parse function", () => {
        it("Parsed STEP-file should match expected result", () => {
            const actualResult = parser.parse();
            
            const fileContent = fs.readFileSync(__dirname + "/Workbench.json");
            const expectedResult = JSON.parse(fileContent)
            assert.deepEqual(actualResult, expectedResult, "Parsed structure doesn't match the expected structure");
        })
    })
})