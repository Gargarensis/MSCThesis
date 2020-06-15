const express = require("express");
const router = express.Router();

const dataStorage = require("../utils/data-storage");
const patternUtils = require("../utils/pattern-utils");

function logString(str) {
	let dateStr = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/, "");
	console.log("> " + dateStr + " routes/snippet.js: " + str);
}

/* GET users listing. */
router.get("/", function(req, res, next) {
	if (dataStorage.isDataReady() == false) {
		res.status(500).send("Data storage not ready!").end();
		return;
	}

	let snippetId = req.query.snippetId;

	let snippet = dataStorage.getSnippetById(snippetId);
	if (snippet == undefined || snippet == null) {
		snippet = dataStorage.getRandomSnippet();
	}

	if (snippet == undefined) {
		res.status(200).send({}).end();
		console.log("You defined pattens for all the snippets!");
		
		return;
	}

	let code = dataStorage.getCodeForSnippet(snippet);
	snippet.fullCode = code;

	function fixStartLine() {
		let lines = snippet.fullCode.split("\n");
		let codeLines = snippet.code.split("\\n");
		let firstLine = codeLines[0];

		if (firstLine != lines[snippet.startLine - 1]) {
			for (let i = 0; i < lines.length; i++) {
				let line = dataStorage.replaceAll(lines[i], "\t", "\\t");

				if (line == firstLine) {
					let valid = true;
					if (codeLines.length > 1) {
						for (let j = 0; j < codeLines.length; j++) {
							if (lines[i + j] == undefined) {
								valid = false;
								break;
							}
							let codeLine = codeLines[j];
							let fullCodeLine = dataStorage.replaceAll(lines[i + j], "\t", "\\t");

							if (codeLine != fullCodeLine) {
								valid = false;
								break;
							}
						}
					}
					if (valid) {
						snippet.startLine = i + 1;
						break;
					}
				}
			}
		}
	}
	
	fixStartLine();

	if (snippet.type == "new") {
		snippet.astData = patternUtils.extractAstData(snippet.ast);
	} else {
		snippet.astData = patternUtils.extractAstData(snippet.method.ast);
	}

	snippet.endLine = snippet.startLine + snippet.code.split("\\n").length;

	let allCompatibilities = [];
	let multiLineCompatibilities = [];
	let processedIds = [];
	let delayedPatterns = [];

	snippet.compatiblePatterns = allCompatibilities;
	snippet.multiLineCompatibilities = multiLineCompatibilities;

	function checkIfPatternNeedsDelay(pattern) {
		let needsDelay = false;

		for (req of pattern.requiredSubPatterns) {
			if (!processedIds.includes(parseInt(req))) {
				needsDelay = true;
				break;
			}
		}

		if (needsDelay) {
			delayedPatterns.push(pattern);
			return true;
		}

		return false;
	}

	for (let pattern of dataStorage.getPatterns()) {
		if (checkIfPatternNeedsDelay(pattern) == true) {
			continue;
		} 
		
		executeCompatibilityCheck(pattern);
		processedIds.push(parseInt(pattern.id))
	}

	let index = 0;
	let maxIterations = delayedPatterns.length * 50;

	while (index < delayedPatterns.length && maxIterations >= 0) {
		let pattern = delayedPatterns[index];
		maxIterations = maxIterations - 1;

		if (checkIfPatternNeedsDelay(pattern) == true) {
			continue;
		}

		executeCompatibilityCheck(pattern);
		processedIds.push(parseInt(pattern.id));
		
		index = index + 1;
	}

	function executeCompatibilityCheck(pattern) {
		let compatibilities = patternUtils.getSnippetCompatibilityForPattern(snippet, pattern);

		// for multi-line patterns
		if (Array.isArray(compatibilities)) {
			if (compatibilities.length == 0) {
				return;
			}
			multiLineCompatibilities.push({
				pattern: pattern,
				intervals: compatibilities
			});
			multiLineCompatibilities = multiLineCompatibilities.filter(filterUsingPatternRequirements);
			snippet.multiLineCompatibilities = multiLineCompatibilities;
			return;
		}

		if (Object.keys(compatibilities).length > 0) {
			let filteredCompatibilities = { compatibilities: {} };
			let isCompatible = true;
			for (const k of Object.keys(compatibilities)) {
				let filteredArray = compatibilities[k].filter(el => {
					return el.path.length > 0;
				});
				filteredCompatibilities.compatibilities[k] = filteredArray;
				isCompatible = isCompatible && filteredArray.length > 0;
			}

			if (isCompatible) {
				filteredCompatibilities.pattern = pattern;
				allCompatibilities.push(filteredCompatibilities);
				allCompatibilities = allCompatibilities.filter(filterUsingPatternRequirements);
				snippet.compatiblePatterns = allCompatibilities;
			}
		}
	}

	function filterUsingPatternRequirements (el) {
		if (el.pattern.requiredSubPatterns.length == 0) {
			return true;
		}

		for (subId of el.pattern.requiredSubPatterns) {
			for (compatibility of allCompatibilities) {
				if (compatibility.pattern.id == subId) {
					return true;
				}
			}
			for (compatibility of multiLineCompatibilities) {
				if (compatibility.pattern.id == subId) {
					return true;
				}
			}
		}
		return false;
	}

	// check if subpattern compatibility is satisfied
	allCompatibilities = allCompatibilities.filter(filterUsingPatternRequirements);
	multiLineCompatibilities = multiLineCompatibilities.filter(filterUsingPatternRequirements);
	

	snippet.compatiblePatterns = allCompatibilities;
	snippet.multiLineCompatibilities = multiLineCompatibilities;

	snippet.apiMethodInvocations = dataStorage.getAPIMethodInvocationsForSnippet(snippet);	

	res.status(200).send(JSON.stringify(snippet)).end();
});

// POST method route
router.post("/submit", function(req, res) {
	if (dataStorage.isDataReady() == false) {
		res.status(500).send("Data storage not ready!").end();
		return;
	}

	dataStorage.addNewPattern(req.body);

	res.status(200).send({}).end();
});

router.post("/new", function (req, res) {
	if (dataStorage.isDataReady() == false) {
		res.status(500).send("Data storage not ready!").end();
		return;
	}

	let receivedSnippet = req.body;
	let snippetId = 0;
	if (receivedSnippet.type == "new-from-method") {
		snippetId = dataStorage.addNewMethodSnippet(receivedSnippet);
	} else {
		snippetId = dataStorage.addNewCodeSnippet(receivedSnippet);
	}

	if (snippetId == -1) {
		res.status(500).send({ error: "There was an error. Verify that the sent code is valid Java code."}).end();
		return;
	}

	res.status(200).send( { snippetId: snippetId } ).end();
});

module.exports = router;