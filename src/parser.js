const Subject = require('rxjs').Subject;
const { v4: uuidv4 } = require('uuid');


class StepToJsonParser {

    constructor(file) {
        this.file = file;
        this.products = new Map();
        this.productDefinitions = [];
        this.preprocessedFile = {
            header: {
                fileDescription: '',
                fileName: '',
                fileSchema: '',
            },
            data: {
                products: [],
                productDefinitions: [],
                productDefinitionFormations: [],
                nextAssemblyUsageOccurences: [],
            },
        };
        this.preprocessFile();
    }


    /**
     * Parses a STEP file and outputs its contents as a JSON tree
     * @param {function} visitorFunction A function that will be executed for every product occurrence of the assembly
     * @param {Subject} sub A subject that can be used to track progress
     */
    parse(visitorFunction = undefined, sub = new Subject()) {
        this.parseProducts(this.preprocessedFile.data.products);
        this.parseProductDefinitions(this.preprocessedFile.data.productDefinitions);
        this.parseNextAssemblyUsageOccurences(this.preprocessedFile.data.nextAssemblyUsageOccurences);
        const rootAssembly = this.identifyRootAssembly();
        const result = this.buildStructureObject(rootAssembly, sub, visitorFunction);
        return result;
    }


    /**
     * Parses a STEP file and outputs its contents as a JSON tree. Adds a UUID for every product occurrence
     * @param {*} sub A subject that can be used to track progress
     */
    parseWithUuid(sub = new Subject()) {
        return this.parse(StepToJsonParser.uuidVisitor, sub);
    }


    /**
     * Splits the STEP-file into single lines and stores all lines that contain product definitions and assembly relations
     */
    preprocessFile() {
        let lines;
        try {
            lines = this.file.toString().split(';');
        } catch (error) {
            throw new Error(`Error while reading the file, filePath: ${this.file}`, error);
        }

        lines.forEach((line) => {
            if (line.includes('FILE_NAME')) {
                this.preprocessedFile.header.fileName = StepToJsonParser.removeLinebreaks(line);
            } else if (line.includes('FILE_SCHEMA')) {
                this.preprocessedFile.header.fileSchema = StepToJsonParser.removeLinebreaks(line);
            } else if (line.includes('FILE_DESCRIPTION')) {
                this.preprocessedFile.header.fileDescription = StepToJsonParser.removeLinebreaks(line);
            } else if (line.includes('PRODUCT_DEFINITION(')) {
                this.preprocessedFile.data.productDefinitions.push(StepToJsonParser.removeLinebreaks(line));
            } else if (line.includes('NEXT_ASSEMBLY_USAGE_OCCURRENCE(')) {
                this.preprocessedFile.data.nextAssemblyUsageOccurences.push(StepToJsonParser.removeLinebreaks(line));
            } else if (line.includes('PRODUCT(')) {
                this.preprocessedFile.data.products.push(StepToJsonParser.removeLinebreaks(line));
            } else if (line.includes('PRODUCT_DEFINITION_FORMATION')) {
                this.preprocessedFile.data.productDefinitionFormations.push(StepToJsonParser.removeLinebreaks(line));
            }
        });

        return this.preprocessedFile;
    }

    /**
     * Parses PRODUCT elements to get the single component names
     * @returns A map with products
     */
    parseProducts() {
        // Parse PRODUCT entities for the names
        this.preprocessedFile.data.products.forEach(line => {
            const id = line.match(/#(\d+)/)[1];
            const attributes = StepToJsonParser.getAttributes(line);
            const name = attributes[0].slice(1, -1); // first param of a PRODUCT entry is the name
            this.products.set(id, { id, name });
        });
    }

    /**
     * Parses the lines of the next assembly usage occurrence and extracts id of relation, container id, contained id and contained name
     *
     * @param {Array<string>} nextAssemblyUsageOccurences
     * @param {Subject} subject Subject that can be used to track this function's state
     * @returns
     */
    parseNextAssemblyUsageOccurences(nextAssemblyUsageOccurences, subject = new Subject()) {
        let progress = 1;
        const assemblyRelations = [];
        nextAssemblyUsageOccurences.forEach((element) => {
            subject.next(progress++);

            // get id by splitting at '=' and removing '#'
            const newId = element.split('=')[0].slice(1);

            const attributes = StepToJsonParser.getAttributes(element);

            const container = attributes[3].slice(1); // Remove #
            const contained = attributes[4].slice(1); // Remove #

            const assemblyObject = {
                id: newId,
                container: container,
                contains: contained,
            };
            assemblyRelations.push(assemblyObject);
        });
        subject.complete();
        this.relations = assemblyRelations;
        return assemblyRelations;
    }


    /**
     * Parses the lines of the product definition and extracts id and name
     *
     * @param {Array<string>} productDefinitionLines
     * @param {Subject} subject Subject that can be used to track this function's state
     * @returns
     */
    parseProductDefinitions() {
        // Parse Formations
        const formations = new Map();
        this.preprocessedFile.data.productDefinitionFormations.forEach(line => {
            const id = line.match(/#(\d+)/)[1];
            const attributes = StepToJsonParser.getAttributes(line);
            const productRef = attributes[2].slice(1); // Referenz zu PRODUCT
            formations.set(id, { id, productRef });
        });

        // Parse PRODUCT_DEFINITIONS and get the name by following the reference chain
        this.preprocessedFile.data.productDefinitions.forEach(line => {
            const id = line.match(/#(\d+)/)[1];
            const attributes = StepToJsonParser.getAttributes(line);
            const formationRef = attributes[2].slice(1); // #101 -> 101

            // Follow the reference chain (to PRODUCT element)
            const formation = formations.get(formationRef);
            if (formation) {
                const product = this.products.get(formation.productRef);
                if (product) {
                    this.productDefinitions.push({
                        id: id,
                        name: product.name  // Get the real name from the PRODUCT entry
                    });
                }
            }
        });

    }


    /**
    * Identifies the root component that contains all other components
    */
    identifyRootAssembly() {
        if (this.productDefinitions.length === 0) {
            throw new Error('No products found');
        }

        if (this.productDefinitions.length === 1) {
            return this.productDefinitions[0];
        }

        try {
        // Collect all root candidates
            const rootCandidates = this.productDefinitions.filter((product) => {
                const productIsContainer = this.relations.some(
                    (relation) => relation.container === product.id
                );
                const productIsContained = this.relations.some(
                    (relation) => relation.contains === product.id
                );
                return productIsContainer && !productIsContained;
            });

            // Error handling for different scenarios
            if (rootCandidates.length === 0) {
                // No root assembly found. Checking for products without relations
                const productsWithoutRelations = this.productDefinitions.filter(product =>
                    !this.relations.some(r =>
                        r.container === product.id || r.contains === product.id
                    )
                );

                if (productsWithoutRelations.length === 1) {
                    return productsWithoutRelations[0];
                }

                throw new Error('No root component could be identified');
            }

            if (rootCandidates.length > 1) {
                // Multiple rootCandidates found
                // Count all direct and indirect descendants and return the bigger rootCandidate (i.e. with more children)
                const rootWithMostDescendants = rootCandidates.reduce((prev, current) => {
                    const prevDescendantCount = this.countAllDescendants(prev.id);
                    const currentDescendantCount = this.countAllDescendants(current.id);

                    return currentDescendantCount > prevDescendantCount ? current : prev;
                });

                return rootWithMostDescendants;
            }

            return rootCandidates[0];

        } catch (error) {
            throw new Error(`Root component could not be found: ${error.message}`);
        }
    }

    /**
    * Recursively counts all descendants of a given product
    * @param {string} productId The ID of the product to count descendants for
    * @param {Set} visited Set of already visited IDs to prevent infinite loops
    * @returns {number} Total count of all descendants
    */
    countAllDescendants(productId, visited = new Set()) {
    // Verhindere Endlosschleifen bei zirkulären Referenzen
        if (visited.has(productId)) {
            return 0;
        }
        visited.add(productId);

        // Finde alle direkten Kinder
        const directChildren = this.relations
            .filter(r => r.container === productId)
            .map(r => r.contains);

        // Zähle direkte Kinder + deren Nachkommen
        let count = directChildren.length;

        for (const childId of directChildren) {
            count += this.countAllDescendants(childId, visited);
        }

        return count;
    }


    /**
     * Returns the preprocessed file
     */
    getPreProcessedObject() {
        return this.preprocessedFile;
    }


    /**
     * Returns a containment structure object for a given product object that has id and name
     *
     * @param {Object} rootAssemblyObject
     * @param {Subject} buildSubject
     * @returns
     */

    /**
     * Returns a containment structure object for a given product object that has id and name
     * @param {*} rootProduct The root component of the assembly
     * @param {*} buildSubject An instance of rxjs Subject that can be used to track this function's progress
     * @param {*} visitorFunction A function that is executed for every component. Can be used to customize processing or add additional data
     */
    buildStructureObject(rootProduct, buildSubject = new Subject(), visitorFunction = undefined) {
        let relationsChecked = 0;
        const structureObject = {
            id: rootProduct.id,
            name: rootProduct.name,
            contains: [],
        };

        if (visitorFunction !== undefined) {
            const visitorResult = visitorFunction(structureObject);
            structureObject[visitorResult.key] = visitorResult.value;
        }

        this.relations.forEach((relation) => {
            buildSubject.next(++relationsChecked);
            if (relation.container === rootProduct.id) {
                const containedProduct = this.getContainedProduct(relation.contains);
                if (containedProduct) {
                    structureObject.contains.push(this.buildStructureObject(containedProduct, buildSubject, visitorFunction));
                }
            }
        });

        if (visitorFunction !== undefined) {
            const visitorResult = visitorFunction(structureObject);
            structureObject[visitorResult.key] = visitorResult.value;
        }

        buildSubject.complete();
        return structureObject;
    }


    /**
     * Checks if a productId serves as a container for other products
     *
     * @param {*} productId
     * @returns
     */
    isContainer(productId) {
        const isContainer = this.relations.some((element) => element.container === productId);
        return isContainer;
    }


    /**
     * Get the contained product of a relation given a relation's 'contained-id'
     * @param {string} relationContainsId 'contains-id' of the relation
     */
    getContainedProduct(relationContainsId) {
        return this.productDefinitions.find((product) => product.id === relationContainsId);
    }


    /**
     * Returns the name for a given product id
     *
     * @param {string} productId ID of the product
     * @returns {string} Name of the product
     */
    getProductName(productId) {
        const product = this.products.get(productId)
        return product.name;
    }


    /**
     * Removes linebreaks that are always present at the end of a line inside a STEP file
     * @param {String} str String that the linebreak will be removed from
     */
    static removeLinebreaks(str) {
        return str.replace(/[\r\n]+/gm, '');
    }


    /**
     * Returns attributes of a line that are defined inside parantheses
     * @param {str} line One line of a STEP-file
     * @returns {Array<string>} An array of attributes
     */
    static getAttributes(line) {
        const openParentheses = line.indexOf('(') + 1;
        const closingParentheses = line.lastIndexOf(')');
        const attributes = line.slice(openParentheses, closingParentheses).split(',');
        return attributes;
    }


    /**
     * Fixes German umlauts
     * @param {string} stringToFix The string that will be fixed
     */
    static fixSpecialChars(stringToFix) {
        let fixedString = stringToFix;

        if (stringToFix.includes('\\X\\')) {
            fixedString = stringToFix.replace('\\X\\C4', 'Ae')
                .replace('\\X\\E4', 'ae')
                .replace('\\X\\D6', 'Oe')
                .replace('\\X\\F6', 'oe')
                .replace('\\X\\DC', 'Ue')
                .replace('\\X\\FC', 'ue');
        }
        return fixedString;
    }

    /**
     * An exemplary visitor function that creates a UUID
     */
    static uuidVisitor() {
        const id = uuidv4();
        const result = { key: 'uuid', value: id };
        return result;
    }

}
exports.StepToJsonParser = StepToJsonParser
