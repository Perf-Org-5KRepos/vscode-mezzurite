import {workspace} from 'vscode';
import 'reflect-metadata';
import {MezzuriteUtils} from '../utils/mezzurite-utils';
import {ExtensionConstants} from '../constants/extension-constants';
import { Project } from "ts-simple-ast";

export class MezzuriteAngularV1{

    private filePath: any;

    constructor(filePath: any){
        this.filePath = filePath
    }

    /**
     * This method would execute the mezzurite framework-specific rules.
     * Rules:- Rules are 
     * 1. Looking for marked and unmarked angular components
     * 2. Looking for mezzurite import and export in all angular modules
     */
    async executeFrameworkSpecificRules(){
        let files: any;
        // Read the .ts files from the work space and get their contents
        if(!this.filePath){
            files = await MezzuriteUtils.searchWorkspace(workspace, ExtensionConstants.pathForTypescriptFiles, ExtensionConstants.pathForNodeModules);
        }
        else{
            var editedFilePath = "**/" + MezzuriteAngularV1.getFileNameFromPath(this.filePath);
            files = await MezzuriteUtils.searchWorkspace(workspace, editedFilePath, ExtensionConstants.pathForNodeModules);
        }
        let data: string;
        let listOfComponents : any = [];
        let listOfModules: any = [];
        for(var index in files){
            var filePath = files[index].fsPath;
            // Read file contents
            data = MezzuriteUtils.readFileFromWorkspace(files[index].fsPath, 'utf8');
            
            // Check if file contains angular module
            if(MezzuriteAngularV1.fileContainsModule(data)){
                listOfModules = await MezzuriteAngularV1.getListOfModules(filePath, data, listOfModules);
            }
            
            // Check if file contains angular component
            if(MezzuriteAngularV1.fileContainsComponent(data)){
                listOfComponents = await MezzuriteAngularV1.getListOfComponents(filePath, data, listOfComponents);
            }
        }
        return MezzuriteAngularV1.outputObject(listOfComponents, listOfModules);
    }

    static outputObject(listOfComponents: any, listOfModules: any){
        var outputObj: any = {};
        outputObj["listOfComponents"] = listOfComponents;
        outputObj["listOfModules"] = listOfModules;
        return outputObj;
    }

    /**
     * This method checks if file contains an an angular module or not
     * @param file data as string
     * @return Return true if found, otherwise false
     */
    static fileContainsModule(fileData: string){
        if(fileData.indexOf(ExtensionConstants.moduleDecorator) > -1){
            return true;
        }
        return false;
    }

    /**
     * This method checks if file contains an an angular component or not
     * @param file data as string
     * @return Return true if found, otherwise false
     */
    static fileContainsComponent(fileData: string){
        if(fileData.indexOf(ExtensionConstants.componentDecorator) > -1){
            return true;
        }
        return false;
    }

    /**
     * This method a decorator object by type. Type can be component or Module
     * @param class declaration object
     * @return If decorator, returns the decorator object, otherwise, return undefined
     */
    static getDecoratorByType(classDeclaration: any, decoratorType: string){
        const decorators = classDeclaration.getDecorators();
        for(var dec= 0; dec< decorators.length;dec++){
            var decorator = decorators[dec];
            if(decoratorType === decorator.getName()){
                return decorator;
            }
        }
        return undefined;
    }

    /**
     * This method checks whether node contains mezzurite import statement or not
     * @param root node object of the AST
     * @return true, if sourec file contains mezzurite import statements
     */
    static containsMezzuriteImportStmt(sourceFile: any){
        const importStatement = sourceFile.getImportDeclaration(ExtensionConstants.mezzuriteAngular);
        if(importStatement){
            return true;
        }
        return false;
    }

    /**
     * This method checks whether the constructor has mezzurite router.start() method and RoutingService parameter or not
     * @param class decorator object
     * @return true, if constructor contains mezzurite router.start() method and RoutingService parameter
     */
    static containsRouterStart(decoratorClass: any){
        var classConstructors = decoratorClass.getConstructors();
        for(var index=0;index<classConstructors.length;index++){
            var constructor = classConstructors[index];
            if(MezzuriteAngularV1.checkForRoutingServiceParam(constructor)){
                if(MezzuriteAngularV1.checkForStartMethod(constructor)){
                    return true;
                }
            };
        }
        return false;
    }
    
    /**
     * This method checks whether the constructor has mezzurite RoutingService parameter or not
     * @param constructor object
     * @return true, if constructor contains mezzurite RoutingService parameter
     */
    static checkForRoutingServiceParam(constructor: any){
        var constParams = constructor.getParameters();
        for(var param=0;param< constParams.length;param++){
            var parameterName = constParams[param].getTypeNode().getText();
            if(parameterName.indexOf(ExtensionConstants.routingService) > -1){
                return true;
            }
        }
        return false;
    }

    /**
     * This method checks whether start method is called inside constructor or not
     * @param constructor object
     * @return true, if constructor contains router.start() method
     */
    static checkForStartMethod(constructor: any){
        var constStatements = constructor.getBody().getStatements();
        for(var stmt =0;stmt< constStatements.length;stmt++){
            var statement = constStatements[stmt];
            if(statement.getKindName() === ExtensionConstants.expressionStatment && statement.getText().indexOf(ExtensionConstants.startText) > -1){
                return true;
            }
        }
        return false;
    }

    /**
     * This method checks whether node contains mezzurite AngularPerf.forRoot() method or not
     * @param moduleProperties is the node constisting of the properties of that module class
     * @return true, if node contains mezzurite AngularPerf.forRoot() method
     */
    static containsAngularPerfForRoot(decorator: any){
        var decoratorElements = MezzuriteAngularV1.getImportDecoratorElements(decorator);
        for(var index=0; index< decoratorElements.length;index++){
            var element = decoratorElements[index];
            if(element.getKindName() === ExtensionConstants.callExpression && element.getText() === ExtensionConstants.angularPerfModule){
                return true;
            }
        }
        return false;
    }

    /**
     * This method returns array of elements inside imports property in module decorator
     * @param decorator object
     * @return array of elements inside imports property in module decorator
     */
    static getImportDecoratorElements(decorator: any){
        var importsObject = MezzuriteAngularV1.getDecoratorProperty(decorator, ExtensionConstants.importsText);
        if(importsObject){
            var importsElements = importsObject.getInitializer().getElements();
            if(importsElements && importsElements.length > 0){
                return importsElements;
            }
        }
        return [];
    }

    /**
     * This method returns decorator property by property name
     * @param decorator object
     * @param property name can be any property inside decorator like 'import' in module decoartor or 'template' and 'templateUrl' inside components decorator
     * @return decorator property object
     */
    static getDecoratorProperty(decorator: any, propertyName: any){
        var decoratorArgs = decorator.getArguments();
        for(var arg=0; arg<decoratorArgs.length;arg++){
            var propertyObject = decoratorArgs[arg].getProperty(propertyName);
            if(propertyObject){
                return propertyObject;
            }
        }
        return undefined;
    }

    /**
     * This method returns all the class nodes from typscript source file
     * @param file path
     * @return array of class nodes
     */
    static getClassNodesFromSourceFile(filePath: string){
        const project = new Project();
        const sourceFile = project.addExistingSourceFile(filePath);
        return sourceFile.getClasses();
    }

    /**
     * Creates an array of output objects consisting of module details with file path,  module name, router.start() info, mezzurite import and export statements
     * @param file path
     * @param file data as string
     * @param output array of objects consisting of details related to component
     * @return list of components
     */
    static async getListOfModules(filePath: string, data: string, listOfModules: any){
        var moduleDecoratorFound = false;
        // Initialize module output object
        var moduleObject = MezzuriteAngularV1.initializeModuleObject();
        const project = new Project();
        const sourceFile = project.addExistingSourceFile(filePath);
        const classes = sourceFile.getClasses();
        // Check for a import statement
        if(MezzuriteAngularV1.containsMezzuriteImportStmt(sourceFile)){
            moduleObject.importStmt = true;
        }
        for(var i = 0;i <classes.length; i++){
            // Check for a valid NgModule decorator object
            var decorator = MezzuriteAngularV1.getDecoratorByType(classes[i], ExtensionConstants.moduleDecoratorName);
            if(decorator !== undefined){
                moduleDecoratorFound = true;
                moduleObject.moduleName = classes[i].getName();
            }
            // Check for a forRoot() method
            if(MezzuriteAngularV1.containsAngularPerfForRoot(decorator)){
                moduleObject.forRoot = true;
            }
            // Check for a router.start() method
            if(MezzuriteAngularV1.containsRouterStart(classes[i])){
                moduleObject.routerStart = true;
            }
            if(moduleObject.importStmt && moduleObject.forRoot && moduleObject.routerStart){
                break;
            }
        }
        if(moduleDecoratorFound){
            moduleObject.filePath = filePath;
            listOfModules.push(moduleObject);
        }
        return listOfModules;
    }

    /**
     * Creates an array of output objects consisting of components details with file path,  component name, component tracking status, template and templateUrl
     * @param file name
     * @param file data as string
     * @param output array of objects consisting of details related to component
     * @return list of components
     */
    static async getListOfComponents(filePath: string, data: string, listOfComponents: any){
        var componentDecoratorFound = false;
        // Initialize component output object
        var componentObject = MezzuriteAngularV1.initializeComponentObject();
        const classes = MezzuriteAngularV1.getClassNodesFromSourceFile(filePath);
        for(var i = 0;i < classes.length; i++){
            // Check for a valid decorator object
            var decorator = MezzuriteAngularV1.getDecoratorByType(classes[i], ExtensionConstants.componentDecoratorName);
            if(decorator !== undefined){
                componentObject.filePath = filePath;
                componentObject.componentName = classes[i].getName();
                componentDecoratorFound = true;
                componentObject = await MezzuriteAngularV1.verifyComponentsTemplate(decorator, componentObject);
                break;
            }
        }
        if(componentDecoratorFound){
            listOfComponents.push(componentObject);
        }
        return listOfComponents;
    }

    /**
     * This method adds the component details such as component tracking status, template and templateUrl to the output object
     * @param decoratorProps consisting of the properties like template, style, templateUrl,etc..
     * @param outputObject with default component details
     * @return outputobject 
     */
    static async verifyComponentsTemplate(decorator: any, componentObject : any){
        // Look for 'template' and 'templateUrl' properties in decorator object
        var templateUrlProperty = MezzuriteAngularV1.getDecoratorProperty(decorator, ExtensionConstants.templateUrl);
        if(templateUrlProperty !== undefined && templateUrlProperty !== ""){
            MezzuriteAngularV1.checkForTemplateUrlProperty(templateUrlProperty, componentObject);
        }
        var templateProperty = MezzuriteAngularV1.getDecoratorProperty(decorator, ExtensionConstants.template);
        if(templateProperty !== undefined && templateProperty !== ""){
            MezzuriteAngularV1.checkForTemplateProperty(templateProperty, componentObject);
        }
        return componentObject;
    }

    /**
     * This method checks templateUrl property value in component decorator object
     * @param templateUrlProperty is the templateUrl property node from componenet object
     * @param outputObject with default component details
     */
    static async checkForTemplateUrlProperty(templateUrlProperty: any, componentObject: any){
        var templateUrlValue = templateUrlProperty.getInitializer().compilerNode.text;
        if(templateUrlValue !== ""){
            componentObject.templateUrl = templateUrlValue;
            var fileName: string = MezzuriteAngularV1.getFileNameFromPath(templateUrlValue);
            var found = await MezzuriteAngularV1.parseExternalHTMLFile(fileName);
            if(found){
                componentObject.status = ExtensionConstants.marked;
                componentObject.htmlFileName = fileName;
            }
        }
    }

    /**
     * This method checks template property value in component decorator object
     * @param templateProperty is the templateUrl property node from componenet object
     * @param outputObject with default component details
     */
    static async checkForTemplateProperty(templateProperty: any, componentObject: any){
        var templateValue = templateProperty.getInitializer().compilerNode.text;
        if(templateValue !== ""){
            componentObject.template = ExtensionConstants.htmlTemplateProvided;
            if(MezzuriteAngularV1.verifyComponentMarking(templateValue)){
                componentObject.status = ExtensionConstants.marked;
            }
        }
    }

    /**
     * Initilize the default component output object
     * @return default/empty component output object
     */
    static initializeComponentObject(){
        let componentObject: any = {
            componentName: "",
            filePath: "",
            status: ExtensionConstants.unmarked,
            template: "",
            templateUrl: "",
            htmlFileName: ""
        };
        return componentObject;
    }

    /**
     * Initilize the default module output object
     * @return default/empty module output object
     */
    static initializeModuleObject(){
        let moduleObject: any = {
            moduleName: "",
            filePath: "",
            importStmt: false,
            forRoot: false,
            routerStart: false
        };
        return moduleObject;
    }

    /**
     * This method is used to get the html file name from file path
     * @param filePath of the html template
     * @return heml file name
     */
    static getFileNameFromPath(filePath: string){
        var lastIndex = filePath.lastIndexOf('/') > -1? filePath.lastIndexOf('/') : filePath.lastIndexOf('\\');
        return filePath.substring(lastIndex + 1, filePath.length);
    }

    /**
     * This method is used to parse the html template for the components with templateUrl property
     * @param filePath of the html template
     * @return true, if parsed html is marked for tracking, otherwise, false
     */
    static async parseExternalHTMLFile(fileName: string){
        var templateString: any;
        // Get the html file and parse its contents for mezzurite markings
        let files: any = await MezzuriteUtils.searchWorkspace(workspace,  "**/" + fileName, ExtensionConstants.pathForNodeModules);
        if(files[0] && files[0].fsPath){
            templateString = MezzuriteUtils.readFileFromWorkspace(files[0].fsPath, 'utf8');
        }
        return MezzuriteAngularV1.verifyComponentMarking(templateString);
    }

    /**
     * This method verifies whether component is marked or not
     * @param htmlString is the html template of the component
     * @return true, if parsed html contains the mezzurite directive and component-title, otherwise, false
     */
    static verifyComponentMarking(htmlString: string){
        if(htmlString && htmlString.indexOf(ExtensionConstants.mezzuriteDirective) > -1 && htmlString.indexOf(ExtensionConstants.componentTitleDirective)> -1){
            return true;
        }
        return false;
    }
}