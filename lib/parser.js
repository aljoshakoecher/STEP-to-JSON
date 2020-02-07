import { Subject } from "rxjs";


class StepToJsonParser {

    constructor(file) {
        this.file = file;
        // preprocessed object
        this.preprocessedFile = {
            header: {
                fileDescription: "",
                fileName: "",
                fileSchema: "",
            },
            data: {
                productDefinitions: [],
                nextAssemblyUsageOccurences: [],
            }
        }
        this.preprocessFile();
    }

    /**
     * Parses a STEP file and outputs its contents as a JSON tree
     * @param {Subject} sub A subject that can be used to track progress
     */
    parse(sub = new Subject()) {
        this.parseProductDefinitions(this.preprocessedFile.data.productDefinitions);
        this.parseNextAssemblyUsageOccurences(this.preprocessedFile.data.nextAssemblyUsageOccurences);
        const rootAssembly = this.identifyRootAssembly()
        const result = this.buildStructureObject(rootAssembly);
        return result;
    }


    preprocessFile() {
        let lines;
        try {
            lines = this.file.toString().split(");")
        } catch (error) {
            throw new Error(`Error while reading the file, filePath: ${this.file}`, error);
        }
        
        lines.forEach(line => {
            if (line.includes("FILE_NAME")) {
                this.preprocessedFile.header.fileName = this.remove_linebreaks(line);
            } else if (line.includes("FILE_SCHEMA")) {
                this.preprocessedFile.header.fileSchema = this.remove_linebreaks(line);
            } else if (line.includes("FILE_DESCRIPTION")) {
                this.preprocessedFile.header.fileDescription = this.remove_linebreaks(line);
            } else if (line.includes("PRODUCT_DEFINITION(")) {
                this.preprocessedFile.data.productDefinitions.push(this.remove_linebreaks(line));
            } else if (line.includes("NEXT_ASSEMBLY_USAGE_OCCURRENCE(")) {
                this.preprocessedFile.data.nextAssemblyUsageOccurences.push(this.remove_linebreaks(line));
            }
        })
        return this.preprocessedFile;
    }


    /**
     * Parses the lines of the next assembly usage occurrence and extracts id of relation, container id, contained id and contained name
     *
     * @param {Array<string>} Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs
     * @param {Subject} subject Subject that can be used to track this function's state
     * @returns
     */
    parseNextAssemblyUsageOccurences(Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs, subject = new Subject()) {
        let progress = 1;
        const assemblyRelations = [];
        Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs.forEach(element => {
            subject.next(progress++)
            const endOfId = element.indexOf("=");
            const newId = element.slice(1, endOfId);
            let newName;
            let upperPart;
            let lowerPart;

            const entries = element.split(",");
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
                id: newId,
                container: upperPart,
                contains: lowerPart,
            }
            assemblyRelations.push(assemblyObject);
        });
        subject.complete();
        this.relations = assemblyRelations;
        return assemblyRelations;
    }


    /**
     * Parses the lines of the product definition and extracts id and name
     *
     * @param {Array<string>} productDefinitions
     * @param {Subject} subject Subject that can be used to track this function's state
     * @returns
     */
    parseProductDefinitions(productDefinitions, subject = new Subject()) {
        let progress = 1;

        const products = [];

        productDefinitions.forEach(element => {
            subject.next(progress++);
            let endOfId = element.indexOf("=");
            let newId = element.slice(1, endOfId);
            let newName;

            let entries = element.split(",");
            entries.forEach(element => {

                if (element.includes("'")) {
                    newName = element.replace(/['\)]/g, "")
                }
            });
            let productObject = {
                id: newId,
                name: newName
            }
            products.push(productObject);

        });
        subject.complete();
        this.products = products;
        return products;
    }


    // identify rootAssemblyObject
    identifyRootAssembly() {
        for (const product of this.products) {
            // Look for a relation where product is the container
            const productIsContainer = this.relations.some(relation => {
                return relation.container === product.id
            });
            // Look for a relation where product is contained
            const productIsContained = this.relations.some(relation => {
                return relation.contains === product.id
            });

            // Root assembly acts a container, but is not contained in any other product
            if (productIsContainer && !productIsContained) {
                return product;
            }
        };
        throw new Error("Root component could not be found")
    }


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
    buildStructureObject(rootProduct, buildSubject = new Subject()) {
        let relationsChecked = 0;
        const structureObject = {
            id: rootProduct.id,
            name: rootProduct.name,
            contains: []
        }

        this.relations.forEach(relation => {
            buildSubject.next(++relationsChecked);
            if (relation.container == rootProduct.id) {
                const containedProduct = this.getContainedProduct(relation.contains);
                structureObject.contains.push(this.buildStructureObject(containedProduct, buildSubject));
            }
        });
        buildSubject.complete();
        return structureObject;
    }


    writeFile(content, outputFilePath="./result.json") {
        const fs = require('fs');
        fs.writeFileSync(outputFilePath, JSON.stringify(content));
    }


    /**
     * Checks if a productId serves as a container for other products
     *
     * @param {*} productId
     * @returns
     */
    isContainer(productId) {
        const isContainer = this.relations.some(element => {
            return (element.container == productId)
        });
        return isContainer;
    }


    /**
     * Get the contained product of a relation given a relation's 'contained-id'
     * @param {string} relationContainsId 'contains-id' of the relation
     */
    getContainedProduct(relationContainsId) {
        return this.products.find(product => product.id == relationContainsId);
    }


    /**
     * Returns the name for a given product id
     *
     * @param {string} productId ID of the product
     * @returns {string} Name of the product
     */
    getProductName(productId) {
        let productName = "";
        this.products.forEach(element => {
            if (element.id == productId) {
                productName = element.name;
            }
        });
        return productName;
    }


    /**
     * Removes linebreaks that are always present at the end of a line inside a STEP file
     * @param {String} str String that the linebreak will be removed from
     */
    remove_linebreaks(str) {
        return str.replace(/[\r\n]+/gm, "");
    }

}

export {StepToJsonParser};