# STEP-to-JSON
A parser for STEP-files that can be used in node.js as well as in frontend development. STEP-to-JSON parses STEP-files (IS0 10303-44) into a JSON structure. It extracts product definitions, relations and creates the assembly tree of all components.

## How to install
STEP-to-JSON can be used in both Back- and Frontend projects. To use it in your own project, simply install via NPM:
```
npm install step-to-json --save
```

It also features a CLI tool if you're just interested in parsing STEP-files manually. To use the CLI-tool, you currently have to clone / download this repository and execute the following steps:

```
$ git clone https://github.com/aljoshakoecher/STEP-to-JSON
$ cd <the folder you cloned to>
$ npm install
$ node step-to-json.js -f "<your STEP-file>.stp"
```

## How to use
The most simple way to convert your STEP file's assembly structure into JSON is by using the parser's `parse()`-function. After instaling the parser you import the it into your project and create an instance of it. Make sure to pass an Athe path to your STEP-file to the constructor. Then you can just call `parse()` as shown below:

### Node.js Example

```javascript
// Add to your imports
const StepToJsonParser = require('step-to-json').StepToJsonParser;

// To get your STEP-file's assembly structure as JSON:
const filePath = "this should be a valid path to your STEP-file"
const stepFile = fs.readFileSync(filePath);
const parser = new StepToJsonParser(stepFile);

const assemblyStructure = parser.parse();
```

### Frontend Example (e.g. Angular)
Using the parser in a frontend application is a bit more tricky since interacting with the filesystem is not as easy as it is in Node.js. In the following example you can see how to parse a file that you grab from an input with `type="file"`:

Let's assume this is your html:
```html
<!-- parsing-component.component.html -->
<input type="file" (change)="onFileChange($event)">
```

You can then use the parser as follows:
```ts
// parsing-component.component.ts
import {StepToJsonParser} from 'step-to-json';

// ...
// is called as soon as a file is selected with the input
onFileChange(fileChangeEvent) {
    const inputReader = new FileReader();

    // setup onload handler that is executed as soon as file is completely loaded
    inputReader.onload = (event:any)=>{
        const fileContent = event.target.result
        const parser = new StepToJsonParser(fileContent);       // Instantiate parser with file
        console.log(parser.parse());                            // Log parser output
    }

    // start reading the selected file
    inputReader.readAsText(fileChangeEvent.target.files[0]);
}
```


## API-Documentation
Functionality of the `StepToJsonParser` class

### parse(visitorFunction = undefined, sub = new Subject())
Main parse function that parses the current STEP file and outputs its contents as a JSON tree. Accepts a visitor function, that is called for every product element. The visitor function always gets the current element with the following attributes passed as an argument:
```javascript
{
    id: any;        // ID string
    name: any;      // Name string
    contains: []    // Array of sub components
}
```
The visitor function can be used to manipulate the id or name of products or in general to hook into the parsing process.
In addition, an rxjs subject can be passed to track the progress. On each new element, the subject emits the number of elements that were parsed.

### parseWithUuid(sub = new Subject())
The function `parseWithUuid()` is basically one example of the more general `parse()` function shown above. It uses a default visitor function that creates a UUID ID for every element. Just like with `parse()`, you can pass a subject to get notified of the current parsing state. If you don't want to get UUID IDs and want to customize the generated objects, check out the `parse()` function above.

