# STEP-to-JSON
A parser that can be used to extract the system structure of a step file and output as json.

## Installation
To use this utility in your own project, simply install via NPM:
```
npm install step-to-json --save
```

To use the CLI-tool, you currently have to clone / download this repository and execute the following steps:

```
$ git clone https://github.com/aljoshakoecher/STEP-to-JSON
$ cd <the folder you cloned to>
$ npm install 
$ node step-to-json.js -f "<your STEP-file>.stp"
```

## API-Documentation
The most simple way to convert your STEP file's assembly structure into JSON is by using the parser's `parse()`-function. First, you import the parser into your project and create an instance of it. Make sure to pass the path to your STEP-file to the constructor. Then you can just call `parse()` as shown below:
```javascript
// Add to your imports
const StepToJsonParser = require('./../lib/parser');

// To get your STEP-file's assembly structure as JSON:
const filePath = "this should be a valid path to your STEP-file"
const parser = new StepToJsonParser(filePath);

const assemblyStructure = parser.parse();
```

