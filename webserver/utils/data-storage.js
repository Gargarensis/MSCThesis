const fs = require('fs');
const parse = require('csv-parse');
const spawnSync = require('child_process').spawnSync;

const CSV_SEPARATOR = "█";
const INPUT_FOLDER = "./snippets_data/"
const CLUSTERS_FOLDER = "clusters"
const CSV_SNIPPETS_FILE = "snippets.csv";
const CSV_METHODS_FILE = "parsed_methods.csv";
const CSV_METHOD_INVOCATIONS_FILE = "parsed_method_invocations.csv"; 
const JSON_DEFINED_PATTERNS_FILE = "defined_patterns.json";
const JSON_DONE_SNIPPETS_FILE = "done_snippets.json";
const PROJECTS_FOLDER = INPUT_FOLDER + "clone_fdroid/projects/";
const CSV_CUSTOM_SNIPPETS_FILE = "custom_snippets.csv";
const CSV_API_METHODS = "api_methods.csv"
const JSON_TRAIN_SET_FILE = "train-set.json";
const JSON_TEST_SET_FILE = "test-set.json"

let snippets = []
let customSnippets = []
let methods = []
let methodInvocations = []
let clusters = {}
let definedPatterns = []
let apiMethods = []
let dataReady = false

let trainSet = JSON.parse(
	fs.readFileSync(INPUT_FOLDER + JSON_TRAIN_SET_FILE, { encoding: "utf8" })
);
let testSet = JSON.parse(
	fs.readFileSync(INPUT_FOLDER + JSON_TEST_SET_FILE, { encoding: "utf8" })
);
let snippetIdSet = testSet; // to serve snippets from the test set, swap this set

let currentActiveSnippetsId = []
let usedAPIs = ["android.view.View", "android.graphics.BitmapFactory"]; // APIs that must be used in the snippets that are served


function logString(str) {
	let dateStr = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
	console.log("> " + dateStr + " utils/data-storage.js: " + str);
}


const snippetsCsvParser = parse({delimiter: CSV_SEPARATOR, quote: ''}, snippetsCsvCallback);
const methodsCsvParser = parse({delimiter: CSV_SEPARATOR, quote: ''}, methodsCsvCallback);
const methodInvocationsCsvParser = parse({delimiter: CSV_SEPARATOR, quote: ''}, methodInvocationsCsvCallback);
const customSnippetsCsvParser = parse({delimiter: CSV_SEPARATOR, quote: ''}, customSnippetsCsvCallback);
const apiMethodsCsvParser = parse({delimiter: CSV_SEPARATOR, quote: ''}, apiMethodsCsvCallback);

const streams = [
	{
		subject: "api methods",
		file: INPUT_FOLDER + CSV_API_METHODS,
		parser: apiMethodsCsvParser
	},
	{
		subject: "methods",
		file: INPUT_FOLDER + CSV_METHODS_FILE,
		parser: methodsCsvParser
	},
	{
		subject: "snippets",
		file: INPUT_FOLDER + CSV_SNIPPETS_FILE,
		parser: snippetsCsvParser
	},
	{
		subject: "custom snippets",
		file: INPUT_FOLDER + CSV_CUSTOM_SNIPPETS_FILE,
		parser: customSnippetsCsvParser
	},
	{
		subject: "method invocations",
		file: INPUT_FOLDER + CSV_METHOD_INVOCATIONS_FILE,
		parser: methodInvocationsCsvParser
	}
];

function replaceAll(str, find, replace) {
	if (str == undefined) {
		return undefined;
	}
  	return str.replace(new RegExp(find, "g"), replace);
}

function removeEscapes(str) {
	let result = str;
	result = replaceAll(result, "\\n", "\n");
	result = replaceAll(result, "\\t", "\t");
	result = replaceAll(result, "\\r", "\r");
	result = replaceAll(result, "\\" + CSV_SEPARATOR, CSV_SEPARATOR);
	return result;
}

function escapes(str) {
	let result = str;
	result = replaceAll(result, "\n", "\\n");
	result = replaceAll(result, "\t", "\\t");
	result = replaceAll(result, "\r", "\\r");
	result = replaceAll(result, CSV_SEPARATOR, "\\" + CSV_SEPARATOR);

	if (result.endsWith("\\n")) {
		result = result.slice(0, -2);
	}
	return result;
}

function cleanFileName(fileName) {
	if (fileName.endsWith(".0")) {
		return fileName.slice(0, -2);
	}
	return fileName
}

function loadClusters() {
	logString("Loading clusters...")
	fs.readdirSync(INPUT_FOLDER + CLUSTERS_FOLDER).forEach(function (file, index) {
		let clusterPath = INPUT_FOLDER + CLUSTERS_FOLDER + "/" + file;
		if (!fs.lstatSync(clusterPath).isDirectory()) {
			return
		}
		let centroid = cleanFileName(file);
		clusters[centroid] = [];
		fs.readdirSync(clusterPath).forEach(function(node, nodeIndex) {
		  clusters[centroid].push(cleanFileName(node));
		});
	});
	logString("Done! Loaded " + Object.keys(clusters).length + " clusters.\n");
}

let CUSTOM_CSV_SNIPPETS_HEADER = ["snippetId", "code", "type", "startLine", "methodId", "ast"].join(CSV_SEPARATOR);
function createCustomCSVFileOrBackup() {
	let path = INPUT_FOLDER + CSV_CUSTOM_SNIPPETS_FILE;
	if (!fs.existsSync(path)) {
		fs.writeFileSync(path, CUSTOM_CSV_SNIPPETS_HEADER + "\n");
	} else {
		fs.copyFileSync(path, INPUT_FOLDER + "/" + Date.now() + "_" + CSV_CUSTOM_SNIPPETS_FILE + ".bak");
	}
}

function load() {
	loadClusters();
	createCustomCSVFileOrBackup(); // always before loadNext
	loadNext(0);
	loadPatterns();
	loadDoneSnippets();
}

function loadNext(i) {
	if (i >= streams.length) {
		dataReady = true
		setTimeout(() => logString("Data storage is ready!"), 500);
		return;
	}
	
	let obj = streams[i];
	setTimeout(() => logString("Loading " + obj.subject + ".."), 100);
	let stream = fs.createReadStream(obj.file).pipe(obj.parser);
	stream.on("finish", () => loadNext(i + 1));
}


function loadPatterns() {
	logString("Loading patterns...");
	let path = INPUT_FOLDER + JSON_DEFINED_PATTERNS_FILE;
	if (!fs.existsSync(path)) {
		fs.writeFileSync(path, "[]");
	} else {
	  fs.copyFileSync(path, INPUT_FOLDER + "/" + Date.now() + "_" + JSON_DEFINED_PATTERNS_FILE + ".bak");
	}
	definedPatterns = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
	logString("Done! Loaded " + definedPatterns.length + " patterns.\n");
}


function loadDoneSnippets() {
	logString("Loading done snippets...");
	let path = INPUT_FOLDER + JSON_DONE_SNIPPETS_FILE;
	if (!fs.existsSync(path)) {
		fs.writeFileSync(path, "[]");
	} 
	currentActiveSnippetsId = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
	logString("Done! Loaded " + currentActiveSnippetsId.length + " done snippets.\n");
}


function addNewPattern(patternJSON, duplicate = true) {
	// don't duplicate multi line patterns, they do not have the expression problem
	if (duplicate && patternJSON.snippetLength == 1) {
		duplicateExpressionPattern(patternJSON);
	}
	patternJSON.id = definedPatterns.length + 1;
	definedPatterns.push(patternJSON);

	let path = INPUT_FOLDER + JSON_DEFINED_PATTERNS_FILE;
	fs.writeFileSync(path, JSON.stringify(definedPatterns), { encoding: "utf8", flag: "w"} );
}

// it can happen that some patterns starts with an Expression, but then are used without it
// so we want to duplicate them without the expression node
function duplicateExpressionPattern(patternJSON) {
	let result = JSON.parse(JSON.stringify(patternJSON));
	result.pattern = result.pattern.replace(/expression./g, "");

	addNewPattern(result, false);
}

function getPatterns() {
	return definedPatterns;
}


function getPatternById(id) {
	for (const pattern of definedPatterns) {
		if (pattern.id == id) {
			return pattern;
		}
	}
	return null;
}

function isDataReady() {
	return dataReady
}

function getSnippets() {
	return snippets;
}

function getMethods() {
	return methods;
}

function getMethodInvocation() {
	return methodInvocations;
}

function getClusters() {
	return clusters;
}

function getSnippetById(id) {
	for (const snippet of snippets) {
		if (snippet.snippetId == id) {
			return snippet;
		}
	}
	return null;
}

// SAME AS DEFINED IN parser.py
const newSnippetWrapperStart = `public class test {\\npublic static void main(String[] args) {\\n`;
const newSnippetWrapperEnd = `\\n}\\n}`;

function getCodeForSnippet(snippet) {
	let methodId = snippet.methodId;

	if (methodId == -1) {
		return removeEscapes(newSnippetWrapperStart + snippet.code + newSnippetWrapperEnd)
	}

	for (const method of methods) {
		if (method.id == methodId) {
			let filePath = INPUT_FOLDER + method.file
			let content = fs.readFileSync(filePath, { encoding: "utf8" });
			return content;
		}
	}
}

function getMethodOfSnippet(snippet) {
	let methodId = snippet.methodId;

	if (methodId == -1) {
		return { ast: snippet.ast }; // for frontend compatibility
	}

	for (const method of methods) {
		if (method.id == methodId) {
			return method;
		}
	}

	return undefined;
}

// works because methods are sorted by id
let lastMethodIndex = 0;
function optimizedGetMethodOfSnippet(snippet) {
	let methodId = snippet.methodId;

	if (methodId == -1) {
		return { ast: snippet.ast }; // for frontend compatibility
	}

	for (let i = lastMethodIndex; i < methods.length; i++) {
		if (methods[i].id == methodId) {
			lastMethodIndex = i;
			return methods[i];
		}
	}

	lastMethodIndex = 0;
	return getMethodOfSnippet(snippet);
}

// TODO: For which the pattern does not exists yet? (one snippet can define multiple patterns!)
function getRandomSnippet() {
	let satisfied = false;
	let snippet = undefined;
	while (!satisfied) {
		let api = getRandomElementFromArray(usedAPIs);
		let snippetId = getRandomElementFromArray(snippetIdSet[api]);
		if (snippetId == undefined || currentActiveSnippetsId.length == getUsedApisLength()) {
			satisfied = true;
		} else {
			if (currentActiveSnippetsId.includes(snippetId)) {
				continue;
			}
			satisfied = true;
			currentActiveSnippetsId.push(snippetId);
			let path = INPUT_FOLDER + JSON_DONE_SNIPPETS_FILE;
			fs.writeFileSync(path, JSON.stringify(currentActiveSnippetsId), { encoding: "utf8", flag: "w"} );
			snippet = getSnippetById(snippetId);
			console.log("Serving snippet id #" + snippetId + " (" + currentActiveSnippetsId.length + "/" + getUsedApisLength() + ")");
		}
	}
	
	return snippet;
}

function getUsedApisLength() {
	let result = 0;
	for (api of usedAPIs) {
		result = result + snippetIdSet[api].length;
	}
	return result;
}

function getRandomElementFromArray(array) {
	if (array.length == 0) {
		return undefined;
	}

	return array[Math.floor(Math.random() * array.length)];
}

function getMaxSnippetId() {
	let maxId = 0;
	for (const snippet of snippets) {
		if (snippet.snippetId > maxId) {
			maxId = snippet.snippetId;
		}
	}
	return maxId;
}

function saveCustomSnippetToCSV(snippet) {
	let ast = snippet.ast;
	if (typeof ast == "object") {
		ast = JSON.stringify(ast);
	}
	// snippetId, code, type, startLine, methodId, ast
	let data = [snippet.snippetId, snippet.code, snippet.type, snippet.startLine, snippet.methodId, ast]
	let toCsv = data.join(CSV_SEPARATOR) + "\n";

	fs.appendFileSync(INPUT_FOLDER + CSV_CUSTOM_SNIPPETS_FILE, toCsv);
}

function addNewMethodSnippet(snippet) {
	snippet.snippetId = getMaxSnippetId() + 1;
	snippet.code = escapes(snippet.code);
	snippet.ast = "{}";
	customSnippets.push(snippet);
	snippets.push(snippet);

    saveCustomSnippetToCSV(snippet);

	return snippet.snippetId;
}

function addNewCodeSnippet(codeSnippet) {
	let snippet = {};
	snippet.snippetId = -1;
	
	let wd = __dirname || process.cwd() + "/utils";

	let result = spawnSync("python3", [wd + "/parser.py", codeSnippet.code], {
		cwd: process.cwd(),
		maxBuffer: 1024 * 1024 * 3, // 3 MB should be more than enough
		encoding: "utf-8"
	});

	let ast = result.stdout;

	if (ast == "null" || ast == null || ast == undefined || ast == {} || ast == "{}") {
		return -1; // error during parsing
	}

	snippet.snippetId = getMaxSnippetId() + 1;
	snippet.code = escapes(codeSnippet.code);
	snippet.type = codeSnippet.type;
	snippet.startLine = 3; // change if the wrapper changes!
	snippet.methodId = -1;
	snippet.method = { id : -1 };

	// Add node types to AST
	ast = JSON.parse(ast);
	appendNodeTypeToNode(ast);
	snippet.ast = ast;

	snippets.push(snippet);
	customSnippets.push(snippet);

	saveCustomSnippetToCSV(snippet);

	return snippet.snippetId;
}

function getAPIMethodInvocationsForSnippet(snippet) {
	let result = [];

	for (mo of methodInvocations) {
		if (mo.methodId == snippet.methodId) {			
			if (mo.lineNo >= snippet.startLine && mo.lineNo <= snippet.endLine) {
				result.push(mo);
			}
		}
	}

	return result;
}

module.exports.load = load;
module.exports.isDataReady = isDataReady;
module.exports.getSnippets = getSnippets;
module.exports.getMethods = getMethods;
module.exports.getMethodInvocation = getMethodInvocation;
module.exports.getClusters = getClusters;
module.exports.getCodeForSnippet = getCodeForSnippet;
module.exports.getSnippetById = getSnippetById;
module.exports.getMethodOfSnippet = getMethodOfSnippet;
module.exports.getPatterns = getPatterns;
module.exports.getRandomSnippet = getRandomSnippet;
module.exports.addNewPattern = addNewPattern;
module.exports.addNewMethodSnippet = addNewMethodSnippet;
module.exports.addNewCodeSnippet = addNewCodeSnippet;
module.exports.getPatternById = getPatternById;
module.exports.getAPIMethodInvocationsForSnippet = getAPIMethodInvocationsForSnippet;
module.exports.replaceAll = replaceAll;


/* PARSER CALLBACKS */

// Read the snippets.csv file
// Fields: snippetId, code, type, startLine, methodId
function snippetsCsvCallback(err, data) {
	if (err) {
		logString(err);
		return;
	}

	let header = true;

	data.forEach(function(line) {
		if (header) {
			header = false;
			return;
		}
		let snippet = {
			snippetId: parseInt(line[0]),
			code: removeEscapes(line[1]),
			type: line[2],
			startLine: parseInt(line[3]),
			methodId: parseInt(line[4]),
			ast: undefined
		};

		snippet.method = optimizedGetMethodOfSnippet(snippet);
		
		if (snippet.method == undefined) {
			return;
		}
		
		// snippet.astData = extractAstData(snippet.method.ast);

		snippets.push(snippet);
	});
	logString("Done! Loaded " + snippets.length + " snippets.\n");
}


// Read the api_methods.csv file
// Fields: methodName, package, qualifiers, parameters, description, containerName, containerType
function apiMethodsCsvCallback(err, data) {
	if (err) {
		logString(err);
		return;
	}

	let header = true;

	data.forEach(function(line) {
		if (header) {
			header = false;
			return;
		}
		let method = {
			methodName: line[0],
			package: line[1],
			qualifiers: line[2],
			parameters: line[3],
			description: line[4],
			containerName: line[5],
			containerType: line[6]
		};

		apiMethods.push(method);
	});
	logString("Done! Loaded " + apiMethods.length + " API methods.\n");
}


// Read the custom_snippets.csv file
// Fields: snippetId, code, type, startLine, methodId, ast
function customSnippetsCsvCallback(err, data) {
	if (err) {
		logString(err);
		return;
	}

	let header = true;

	data.forEach(function(line) {
		if (header) {
			header = false;
			return;
		}
		let snippet = {
			snippetId: parseInt(line[0]),
			code: removeEscapes(line[1]),
			type: line[2],
			startLine: parseInt(line[3]),
			methodId: parseInt(line[4]),
			ast: removeEscapes(line[5])
		};
		// Add node types to AST
		let ast = JSON.parse(snippet.ast);
		appendNodeTypeToNode(ast);
		snippet.ast = ast;

		snippet.method = getMethodOfSnippet(snippet);

		if (snippet.method == undefined) {
			return;
		}

		// if (snippet.type == "new-from-method") {
		// 	snippet.astData = extractAstData(snippet.method.ast);
		// }
		// else {
		// 	snippet.astData = extractAstData(snippet.ast);
		// }

		snippets.push(snippet);
		customSnippets.push(snippet);
	});
	logString("Done! Loaded " + customSnippets.length + " custom snippets.\n");
}

// Read the parsed_methods.csv file
// Fields: id, file, modifiers, documentation, name, header, body, lineNo, colNo, endLineNo, ast
function methodsCsvCallback(err, data) {
	if (err) {
		logString(err);
		return;
	}

	let header = true;

	data.forEach(function(line) {
		if (header) {
		  header = false;
		  return;
		}

		let method = {
			id: parseInt(line[0]),
			file: line[1],
			modifiers: line[2],
			documentation: line[3],
			name: line[4],
			header: removeEscapes(line[5]),
			body: removeEscapes(line[6]),
			lineNo: parseInt(line[7]),
			colNo: parseInt(line[8]),
			endLineNo: parseInt(line[9]),
			ast: removeEscapes(line[10])
		};
		// Add node types to AST
		let ast = JSON.parse(method.ast);
		appendNodeTypeToNode(ast);
		method.ast = ast;

		methods.push(method);
	});
	logString("Done! Loaded " + methods.length + " methods.\n");
}

// Read the parsed_method_invocations.csv file
// Fields: methodId, invokedMethod, lineNo, colNo, package, class, description
function methodInvocationsCsvCallback(err, data) {
	if (err) {
		logString(err);
		return;
	}

	let header = true;

	data.forEach(function(line) {
		if (header) {
		  header = false;
		  return;
		}

		let methodInvocation = {
			methodId: parseInt(line[0]),
			invokedMethod: line[1],
			lineNo: parseInt(line[2]),
			colNo: parseInt(line[3]),
			package: line[4],
			class: line[5],
			description: line[6]
		};
		methodInvocations.push(methodInvocation);
	});
	logString("Done! Loaded " + methodInvocations.length + " method invocations.\n");
}



/* AST NODE RECOGNITION */
function appendNodeTypeToNode(node) {
	if (typeof node !== 'object' || node === null) {
		return;
	}

	let type = getAstNodeType(node);
	if (type != undefined) {
		node.nodeType = type;
	}

	if (type == "MethodInvocation") {
		node.apiMethods = [];
		for (method of apiMethods) {
			if (method.methodName == node.member) {
				if (node.arguments.length == method.parameters.split(",").length) {
					node.apiMethods.push(method);
				}
			}
		}
	}

	Object.keys(node).forEach(function(key) {
		appendNodeTypeToNode(node[key]);
	});
}

let methodDeclaration = ["type_parameters", "return_type", "parameters", "name", "throws", "body"];
let constructorDeclaration = ["type_parameters", "name", "parameters", "throws", "body"];
let tryStatement = ["resources", "block", "catches", "finally_block"];
let formalParameter = ["type", "name", "varargs"]
let ifStatement = ["condition", "then_statement", "else_statement"];
let assignment = ["expressionl", "value", "type"];
let methodReference = ["expression", "method", "type_arguments"];
let methodInvocation = ["type_arguments", "arguments", "member"];
let variableDeclaration = ["type", "declarators"]
let whileStatement = ["condition", "body"];
let forStatement = ["control", "body"];
let assertStatement = ["condition", "value"];
let switchStatement = ["expression", "cases"];
let synchronizedStatement = ["lock", "block"];
let cast = ["type", "expression"];
let lambda = ["parameters", "body"];
let blockStatement = ["statements"];
let returnOrThrowOrExpressionStatement = ["expression"];
let breakOrContinueStatement = ["goto"];
let literal = ["value"];
let memberReference  = ["prefix_operators", "postfix_operators", "qualifier", "selectors", "member"]
let primaryExpression = ["prefix_operators", "postfix_operators", "qualifier", "selectors"]


function checkNodeTypeUsingKeys(node, keys) {
	let check = true;
	for (k of keys) {
		check = check && k in node;
	}
	return check;
}

function getAstNodeType(astNode) {

	if (checkNodeTypeUsingKeys(astNode, methodDeclaration)) {
		return "MethodDeclaration"
	}

	if (checkNodeTypeUsingKeys(astNode, constructorDeclaration)) {
	  return "ConstructorDeclaration";
	}

	if (checkNodeTypeUsingKeys(astNode, tryStatement)) {
	  return "TryStatement";
	}

	if (checkNodeTypeUsingKeys(astNode, formalParameter)) {
	  return "FormalParameter";
	}

	if (checkNodeTypeUsingKeys(astNode, ifStatement)) {
	  return "IfStatement";
	}

	if (checkNodeTypeUsingKeys(astNode, assignment)) {
	  return "Assignment";
	}

	if (checkNodeTypeUsingKeys(astNode, methodReference)) {
		return "MethodReference";
	}

	if (checkNodeTypeUsingKeys(astNode, methodInvocation)) {
		return "MethodInvocation";
	}

	if (checkNodeTypeUsingKeys(astNode, variableDeclaration)) {
	  return "VariableDeclaration";
	}

	if (checkNodeTypeUsingKeys(astNode, whileStatement)) {
	  return "WhileStatement";
	}

	if (checkNodeTypeUsingKeys(astNode, forStatement)) {
	  return "ForStatement";
	}

	if (checkNodeTypeUsingKeys(astNode, assertStatement)) {
	  return "AssertStatement";
	}

	if (checkNodeTypeUsingKeys(astNode, switchStatement)) {
	  return "SwitchStatement";
	}

	if (checkNodeTypeUsingKeys(astNode, synchronizedStatement)) {
	  return "SynchronizedStatement";
	}

	if (checkNodeTypeUsingKeys(astNode, cast)) {
	  return "Cast";
	}

	if (checkNodeTypeUsingKeys(astNode, lambda)) {
	  return "Lambda";
	}

	if (checkNodeTypeUsingKeys(astNode, blockStatement)) {
	  return "BlockStatement";
	}

	// TODO: use line number to discern return/throws/expression
	if (checkNodeTypeUsingKeys(astNode, returnOrThrowOrExpressionStatement)) {
	  return "Expression";
	}

	// TODO: use line number to discern break/continue
	if (checkNodeTypeUsingKeys(astNode, breakOrContinueStatement)) {
	  return "CaseWordStatement";
	}

	if (checkNodeTypeUsingKeys(astNode, literal)) {
	  return "Literal";
	}

	if (checkNodeTypeUsingKeys(astNode, memberReference)) {
		return "MemberReference";
	}

	if (checkNodeTypeUsingKeys(astNode, primaryExpression)) {
		return "PrimaryExpression";
	}
	
	return undefined
}