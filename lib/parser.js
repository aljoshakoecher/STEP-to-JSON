class StepToJsonParser {

    constructor(){
        this.i = 0;
    }
    
    parse(file, sub) {
        //TODO: parse a complete STEP file
    }


    /**
     * Parses the lines of the next assembly usage occurrence and extracts key of relation, container key, contained key and contained name
     *
     * @param {Array<string>} Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs
     * @param {Subsject} subject Subject that can be used to track this functions state
     * @returns
     */
    parse_NEXT_ASSEMBLY_USAGE_OCCURRENCE(Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs, subject) {
        let progress = 1;
        let assemblyRelations = [];
        Array_of_NEXT_ASSEMBLY_USAGE_OCCURRENCEs.forEach(element => {
            subject.next(progress++)
            let endOfKey = element.indexOf("=");
            let newKey = element.slice(1, endOfKey);
            let newName;
            let upperPart;
            let lowerPart;

            let entries = element.split(",");
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
                key: newKey,
                container: upperPart,
                contains: lowerPart,
                containedName: newName
            }
            assemblyRelations.push(assemblyObject);
        });
        this.relations = assemblyRelations;
        subject.complete();
        return assemblyRelations;
    }


    /**
     * Parses the lines of the product definition and extracts key and name
     *
     * @param {Array<string>} Array_of_PRODUCT_DEFINITIONs
     * @returns
     */
    parse_PRODUCT_DEFINITION(Array_of_PRODUCT_DEFINITIONs, subject) {
        let progress = 1;
        
        let products = [];

        Array_of_PRODUCT_DEFINITIONs.forEach(element => {
            subject.next(progress++);
            let endOfKey = element.indexOf("=");
            let newKey = element.slice(1, endOfKey);
            let newName;

            let entries = element.split(",");
            entries.forEach(element => {

                if (element.includes("'")) {
                    newName = element.replace(/['\)]/g, "")
                }
            });
            let productObject = {
                key: newKey,
                name: newName
            }
            products.push(productObject);

        });
        this.products = products;
        subject.complete();
        return products;
    }


    /**
     * Manupulates the structureObject recursively
     *
     * @param {Object} structureObject
     */
    recursiveBuild(structureObject, subject) {
        for (let i = 0; i < structureObject.contains.length; i++) {
            subject.next(++this.i);
            let currentKey = structureObject.contains[i].key;
            if (this.isContainer(currentKey)) {
                structureObject.contains[i] = this.buildStructureObject(structureObject.contains[i])
                this.recursiveBuild(structureObject.contains[i], subject);
            } else {
                continue
            }
        }
        subject.complete();
    }


    /**
     * Returns a containment structure object for a given product object that has key and name
     *
     * @param {Object} ProductObject
     * @returns
     */
    buildStructureObject(ProductObject) {

        let structureObject = {
            key: ProductObject.key,
            name: ProductObject.name,
            contains: []
        }

        this.relations.forEach(element => {
            if (element.container == structureObject.key) {
                let productObject = {
                    key: element.contains,
                    name: this.getProductName(element.contains)
                }
                structureObject.contains.push(productObject);
            }
        });

        return structureObject;
    }

    /**
     * Checks if a productKey serves as a container for other products
     *
     * @param {*} productKey
     * @returns
     */
    isContainer(productKey) {
        let isContainer = false;
        this.relations.forEach(element => {
            if (element.container == productKey) {
                isContainer = true;
            }
        });
        return isContainer;
    }


    /**
     * Returns the name for a given product key
     *
     * @param {*} productKey
     * @returns
     */
    getProductName(productKey) {
        let productName = "";
        this.products.forEach(element => {
            if (element.key == productKey) {
                productName = element.name;
            }
        });
        return productName;
    }

    remove_linebreaks(str) {
        return str.replace(/[\r\n]+/gm, "");
    }

}

module.exports = StepToJsonParser;