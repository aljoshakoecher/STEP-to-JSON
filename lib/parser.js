const Subject = require('rxjs').Subject;

class StepToJsonParser {

    constructor() {
        // preprocessed object
        this.preprocessedFile = {
            header: {
                'FILE_DESCRIPTION': "",
                'FILE_NAME': "",
                'FILE_SCHEMA': "",
            },
            data: {
                'PRODUCT_DEFINITION': [],
                'NEXT_ASSEMBLY_USAGE_OCCURRENCE': [],
            }
        }
    }

    parse(file, sub) {

    }


    preprocessFile(filePath) {
        let lines;
        try {
            const file = fs.readFileSync(filePath);
            lines = file.toString().split(";")
        } catch (error) {
            if (error.code == "ENOENT") {
                console.error("Specified file could not be found...".red)
                process.exit(0)
            }
        }
        return this.preprocessFileContent(lines);
    }


    preprocessFileContent(lines, preprocessingSubject) {
        let i = 1;

        lines.forEach(line => {
            preprocessingSubject.next(i++);
            if (line.includes("FILE_NAME")) {
                this.preprocessedFile.header.FILE_NAME = this.remove_linebreaks(line);
            } else if (line.includes("FILE_SCHEMA")) {
                this.preprocessedFile.header.FILE_SCHEMA = this.remove_linebreaks(line);
            } else if (line.includes("FILE_DESCRIPTION")) {
                this.preprocessedFile.header.FILE_DESCRIPTION = this.remove_linebreaks(line);
            } else if (line.includes("PRODUCT_DEFINITION(")) {
                this.preprocessedFile.data.PRODUCT_DEFINITION.push(this.remove_linebreaks(line));
            } else if (line.includes("NEXT_ASSEMBLY_USAGE_OCCURRENCE(")) {
                this.preprocessedFile.data.NEXT_ASSEMBLY_USAGE_OCCURRENCE.push(this.remove_linebreaks(line));
            }
        })
        preprocessingSubject.complete();
        return this.preprocessedFile;
    }


    /**
     * Parses the lines of the next assembly usage occurrence and extracts id of relation, container id, contained id and contained name
     *
     * @param {Array<string>} Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs
     * @param {Subject} subject Subject that can be used to track this function's state
     * @returns
     */
    parse_NEXT_ASSEMBLY_USAGE_OCCURRENCE(Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs, subject) {
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
        this.relations = assemblyRelations;
        subject.complete();
        return assemblyRelations;
    }


    /**
     * Parses the lines of the product definition and extracts id and name
     *
     * @param {Array<string>} Array_of_PRODUCT_DEFINITIONs
     * @param {Subject} subject Subject that can be used to track this function's state
     * @returns
     */
    parse_PRODUCT_DEFINITION(Array_of_PRODUCT_DEFINITIONs, subject) {
        let progress = 1;

        const products = [];

        Array_of_PRODUCT_DEFINITIONs.forEach(element => {
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
        this.products = products;
        subject.complete();
        return products;
    }


    // identify rootAssemblyObject
    identifyRootAssembly(products) {
        let rootAssemblyObject;
        products.forEach(product => {
            // Try to find a relation where the product is the container and also contains elements
            const productIsContainer = this.relations.some(relation => {
                return relation.container === product.id
            });
            const productIsContained = this.relations.some(relation => {
                return relation.contains === product.id
            });

            // Root assembly acts a container, but is not contained in any other product
            if (productIsContainer && !productIsContained) {
                rootAssemblyObject = product
            }
        });
        return rootAssemblyObject;
    }



    /**
     * Returns a containment structure object for a given product object that has id and name
     *
     * @param {Object} rootAssemblyObject
     * @param {Subject} buildSubject
     * @returns
     */
    buildStructureObject(product, buildSubject) {
        let relationsChecked = 0;
        const structureObject = {
            id: product.id,
            name: product.name,
            contains: []
        }

        this.relations.forEach(relation => {
            buildSubject.next(++relationsChecked);
            if (relation.container == product.id) {
                const containedProduct = this.getContainedProduct(relation.contains);
                structureObject.contains.push(this.buildStructureObject(containedProduct, buildSubject));
            }
        });
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

module.exports = StepToJsonParser;