module.exports.extractAstData = extractAstData;
function extractAstData(ast) {
	let astData = {};

	function parseAstPositions(node) {
		if (typeof node !== "object" || node === null) {
			return;
		}

		Object.keys(node).forEach(function(key) {
			parseAstPositions(node[key]);
		});

		if ("_position" in node && node._position != null) {
			if (astData[node._position[0]] == undefined) {
				astData[node._position[0]] = {};
			}
			astData[node._position[0]][node._position[1]] = node;
		}
	}
	parseAstPositions(ast);

	return astData;
}

function flatten(array) {
	if (array.length == 0) return array;
	else if (Array.isArray(array[0]))
		return flatten(array[0]).concat(flatten(array.slice(1)));
	else return [array[0]].concat(flatten(array.slice(1)));
}

// Would be nice to refactor the parser later
module.exports.getSnippetCompatibilityForPattern = getSnippetCompatibilityForPattern;

function getSnippetCompatibilityForPattern(snippet, pattern) {
	let lines = getPatternParsableLines(pattern.pattern);
	let specialLines = lines[0];
	let paths = lines[1];
	let allResults = {};

	if (pattern.snippetLength != 1) {
		let intervals = verifyRequirementsAndGetLineIntervals(specialLines, snippet, paths);
		intervals = intervals.filter(e => e.length);
		// console.log(JSON.stringify(intervals));
		return intervals;
		
		// let validIntervals = []
		// let pathMatches = [];
		// for (const path of paths) {
		// 	let matches = calculateJSONPath(path, snippet);
		// 	pathMatches.push(matches);
		// }
		
		// for (const interval of intervals) {
		// 	let iValid = true;
		// 	for (pm of pathMatches) {
		// 		let pValid = false;
		// 		for (p of pm) {
		// 			if (p.lineNo >= interval[0] && p.lineNo <= interval[1]) {
		// 				pValid = true;
		// 			}
		// 		}
		// 		iValid = iValid && pValid;
		// 	}
		// 	if (iValid) {
		// 		validIntervals.push(interval);
		// 	}
		// }
		
		// return validIntervals;
	}
	
	for (const path of paths) {
		let pathResult = [];
		for (let lineNo of Object.keys(snippet.astData)) {
			if (snippet.startLine > lineNo || snippet.endLine < lineNo) {
				continue;
			}

			let astLine = snippet.astData[lineNo];
			for (let colNo of Object.keys(astLine)) {
				let node = astLine[colNo];
				if (!verifyRequirementsForNode(specialLines, node)) {
					continue;
				}

				let temp = calculateJSONPathOfWordFromNode(path, node);
				
				if (temp != []) {
					let tempDict = {
						path: temp,
						word: path,
						lineNo: lineNo,
						colNo: colNo,
						// pattern: pattern
					};
					
					pathResult.push(tempDict);
				}
			}
		}
		if (pathResult != []) {
			allResults[path] = pathResult;
		}
	}

	return allResults;
}

function getPatternParsableLines(pattern) {
	let lines = pattern.split("\n");
	let words = [];
	let specialLines = [];
	lines.forEach(function(el) {
		if (el[0] == "!") {
			specialLines.push(el);
		} else {
			words.push(el.split(" "));
		}
	});
	words = flatten(words);

	let pathWords = [];
	for (const word of words) {
		if (word[0] == "<" && word[word.length - 1] == ">") {
			pathWords.push(word.substring(1, word.length - 1));
		}
	}

	return [specialLines, pathWords];
}

// function parsePatternForSnippet(pattern, snippet) {
// 	let test = getSnippetCompatibilityForPattern(snippet, pattern);
// 	console.log(JSON.stringify(flatten(test)));
	
// 	process.exit(0);
//     let lines = pattern.split("\n");
// 	let words = [];
// 	let specialLines = [];
// 	lines.forEach(function(el) {
// 		if (el[0] == "!") {
// 			specialLines.push(el);
// 		} else {
// 			words.push(el.split(" "));
// 		}
// 	});
// 	words = flatten(words);
	
// 	let areRequirementsSatisfied = verifyRequirements(specialLines, snippet);
// 	let possibleMatches = [];

// 	let result = true;
// 	for (const word of words) {
// 		if (word[0] == "<" && word[word.length - 1] == ">") {
// 			let temp = calculateJSONPath(word, snippet);
// 			result = result && temp.length > 0;
// 			possibleMatches = possibleMatches.concat(temp);
// 		}
// 	}
	
// 	return [result && areRequirementsSatisfied, possibleMatches];
// }

function verifyRequirementsForNode(requirements, node){
	let result = true;

	for (const req of requirements) {
		result = result && verifyRequirementForNode(req, node);
	}

	return result;
}


function verifyRequirementForNode(requirement, node) {
	let isSatisfied = false;
	if (requirement.startsWith("!require ")) {
		let data = requirement.replace("!require ", "");

		if (data.length == 0) {
			isSatisfied = true;
			return;
		}

		// Will be changed if syntax evolves
		if (!data.includes(" == ")) {
			isSatisfied = true;
			return;
		}

		let parts = data.split(" == ");

		if (parts.length < 2) {
			isSatisfied = true;
			return;
		}

		parts[0] = parts[0].trim();
		parts[1] = parts[1].trim();

		let gt = undefined;
		let lt = undefined;
		let secondValue = parts[1];
		if (parts[1].includes(" > ")) {
			let tempSplit = parts[1].split(" > ");
			if (!isNaN(tempSplit[1])) {
				gt = parseInt(tempSplit[1]);
			}
			secondValue = tempSplit[0].trim();
		}

		if (parts[1].includes(" < ")) {
			let tempSplit = parts[1].split(" < ");
			if (!isNaN(tempSplit[1])) {
				lt = parseInt(tempSplit[1]);
			}
			secondValue = tempSplit[0].trim();
		}

		if (parts[0] == secondValue) {
			isSatisfied = true;
			return;
		}

		let firstMatches = calculateJSONPathOfWordFromNode(parts[0], node);
		let matchCount = 0;

		firstMatches.forEach(function(m) {
			if (m.finalValue == secondValue) {
				if (lt == undefined && gt == undefined) {
					isSatisfied = true;
				}
				matchCount = matchCount + 1;
			}
		});

		if (!isSatisfied) {
			let secondMatches = calculateJSONPathOfWordFromNode(secondValue, node);
			secondMatches.forEach(function(m) {
				if (m.finalValue == parts[0]) {
					if (lt == undefined && gt == undefined) {
						isSatisfied = true;
					}
					matchCount = matchCount + 1;
				}
			});

			if (!isSatisfied) {
				for (fm of firstMatches) {
					for (sm of secondMatches) {
						if (fm.finalValue == sm.finalValue) {
							matchCount = matchCount + 1;
							if (lt == undefined && gt == undefined) {
								isSatisfied = true;
								break;
							}
						}
					}

					if (isSatisfied == true) {
						break;
					}
				}
			}

			if (lt != undefined) {
				if (matchCount < lt) {
					isSatisfied = true;
				}
			}
			if (gt != undefined) {
				if (matchCount > gt) {
					isSatisfied = true;
				}
			}
		}
	}

	// filtered later, this is done using requiredSubPatterns in pattern data
	if (requirement.startsWith("!satisfies ")) {
		isSatisfied = true;
	}

	return isSatisfied;
}


function findAllPossibleSnippets(lines, snippet, paths) {
	let lineNos = Object.keys(snippet.astData);
	if (lineNos.length <= 1) {
		return [];
	}

	let min = Math.min.apply(Math, lineNos);
	let max = Math.max.apply(Math, lineNos);

	let clone = JSON.parse(JSON.stringify(snippet));
	let verify = verifyRequirements(lines, snippet) && verifyPaths(snippet, paths);

	if (verify == false) {
		return [];
	}

	let i = min;
	while (i < max + 1 && verify) {
		// clone.astData[i] = undefined;
		delete clone.astData[i];
		verify = verifyRequirements(lines, clone) && verifyPaths(clone, paths);
		i = i + 1;
	}

	let startInterval = i - 1;
	clone.astData[startInterval] = snippet.astData[startInterval]; // restore the undefined
	verify = true;

	i = max;
	while (i > startInterval && verify) {
		// clone.astData[i] = undefined;
		delete clone.astData[i];
		verify = verifyRequirements(lines, clone) && verifyPaths(clone, paths);
		i = i - 1;
	}

	let endInterval = i + 1;

	let cloneStart = JSON.parse(JSON.stringify(snippet));
	let cloneEnd = JSON.parse(JSON.stringify(snippet));

	for (const no of lineNos) {
		if (no >= startInterval) {
			// cloneStart.astData[no] = undefined;
			delete cloneStart.astData[no];
		}
		if (no <= endInterval) {
			// cloneEnd.astData[no] = undefined;
			delete cloneEnd.astData[no];
		}
	}

	let returnValue = [[startInterval, endInterval]];
	let resultLeft = findAllPossibleSnippets(lines, cloneStart, paths);
	let resultRight = findAllPossibleSnippets(lines, cloneEnd, paths);
	
	return returnValue.concat(resultLeft).concat(resultRight);
}

function verifyPaths(snippet, paths) {
	let verify = true;
	
	for (const path of paths) {
		let matches = calculateJSONPath(path, snippet);
		verify = verify && matches.length > 0;
	}

	return verify;

	// for (const interval of intervals) {
	// 	let iValid = true;
	// 	for (pm of pathMatches) {
	// 		let pValid = false;
	// 		for (p of pm) {
	// 			if (p.lineNo >= interval[0] && p.lineNo <= interval[1]) {
	// 				pValid = true;
	// 			}
	// 		}
	// 		iValid = iValid && pValid;
	// 	}
	// 	if (iValid) {
	// 		validIntervals.push(interval);
	// 	}
	// }
}

function verifyRequirementsAndGetLineIntervals(lines, snippet, paths) {
	let newSnippet = JSON.parse(JSON.stringify(snippet));
	let possibilities = findAllPossibleSnippets(lines, newSnippet, paths);
	
	return possibilities;
}

// used only on multi-line patterns
function verifyRequirements(lines, currentSnippet) {	
	let areAllRequirementsSatisfied = [];
	let i = -1;

	lines.forEach(function(line) {
		i = i + 1;
		areAllRequirementsSatisfied[i] = false;
		if (line.startsWith("!require ")) {
			let data = line.replace("!require ", "");

			if (data.length == 0) {
				areAllRequirementsSatisfied[i] = true;
				return;
			}

			// Will be changed if syntax evolves
			if (!data.includes(" == ")) {
				areAllRequirementsSatisfied[i] = true;
				return;
			}

			let parts = data.split(" == ");

			if (parts.length < 2) {
				areAllRequirementsSatisfied[i] = true;
				return;
			}

			parts[0] = parts[0].trim();
			parts[1] = parts[1].trim();

			let gt = undefined;
			let lt = undefined;
			let secondValue = parts[1];
			if (parts[1].includes(" > ")) {
				let tempSplit = parts[1].split(" > ");
				if (!isNaN(tempSplit[1])) {
					gt = parseInt(tempSplit[1]);
				}
				secondValue = tempSplit[0].trim();
			}

			if (parts[1].includes(" < ")) {
				let tempSplit = parts[1].split(" < ");
				if (!isNaN(tempSplit[1])) {
					lt = parseInt(tempSplit[1]);
				}
				secondValue = tempSplit[0].trim();
			}

			if (parts[0] == secondValue) {
				areAllRequirementsSatisfied[i] = true;
				return;
			}

			let firstMatches = calculateJSONPath(parts[0], currentSnippet);
			let matchCount = 0;

			firstMatches.forEach(function(m) {
				if (m.finalValue == secondValue) {
					if (lt == undefined && gt == undefined) {
						areAllRequirementsSatisfied[i] = true;
					}
					matchCount = matchCount + 1;
				}
			});

			if (!areAllRequirementsSatisfied[i]) {
				let secondMatches = calculateJSONPath(secondValue, currentSnippet);
				secondMatches.forEach(function(m) {
					if (m.finalValue == parts[0]) {
						if (lt == undefined && gt == undefined) {
							areAllRequirementsSatisfied[i] = true;
						}
						matchCount = matchCount + 1;
					}
				});

				if (!areAllRequirementsSatisfied[i]) {
					for (fm of firstMatches) {
						for (sm of secondMatches) {
							if (fm.finalValue == sm.finalValue) {
								matchCount = matchCount + 1;
								if (lt == undefined && gt == undefined) {
									areAllRequirementsSatisfied[i] = true;
									break;
								}
							}
						}

						if (areAllRequirementsSatisfied[i] == true) {
							break;
						}
					}
				}
				if (lt != undefined) {
					if (matchCount < lt) {
						areAllRequirementsSatisfied[i] = true;
					}
				}
				if (gt != undefined) {
					if (matchCount > gt) {
						areAllRequirementsSatisfied[i] = true;
					}
				}
			}
		}

		// filtered later, this is done using requiredSubPatterns in pattern data
		if (line.startsWith("!satisfies ")) {
			areAllRequirementsSatisfied[i] = true;
		}
	});
	
	let aggregateChecks = areAllRequirementsSatisfied.reduce(
		(agg, el) => agg && el, true);
	
	return aggregateChecks;
}

function calculateJSONPathOfWordFromNode(JSONWord, firstNode) {
	let possibleMatches = [];
	
	possibleMatches = navigateJSONFromNode(firstNode, JSONWord);
	
	possibleMatches.sort(function(a, b) {
		if (a.lineNo < b.lineNo) {
			return -1;
		}
		if (a.lineNo > b.lineNo) {
			return 1;
		}
		return 0;
	});

	return possibleMatches;
}

function navigateJSONFromNode(firstNode, JSONWord) {
	let possibleMatches = [];
	let word = JSONWord;	

	if (word.includes(":")) {
		// should never happen here, but just to be sure
		let tempSplit = word.split(":");
		word = tempSplit[tempSplit.length - 1];
	}

	let jsonPath = word.split(".");
	let currentNode = firstNode;

	let pathIndex = -1;
	for (path of jsonPath) {
		pathIndex = pathIndex + 1;
		if (currentNode === undefined || currentNode === null) {
			continue;
		}

		// if we have an array
		if (path.includes("[") && path.includes("]")) {
			let matches = path.match(/\[(.*?)\]/);
			if (matches) {
				let index = parseInt(matches[1]);
				let arrKey = path.split(matches[0])[0];
				currentNode = currentNode[arrKey];
				if (currentNode !== undefined && currentNode !== null) {
					currentNode = currentNode[index];
				}
			}
			continue;
		}

		// or if we have an "any key" selector (*)
		if (path == "?") {
			let hiddenKeys = ["parentNode", "parentNodeKey", "_position"];
			for (let key of Object.keys(currentNode)) {
				if (hiddenKeys.includes(key)) {
					continue;
				}

				let nodeAtKey = currentNode[key];

				if (nodeAtKey === null || nodeAtKey === undefined) {
					continue;
				}

				let restOfPath = jsonPath.slice(pathIndex + 1).join(".");

				let matchesForKey = navigateJSONFromNode(nodeAtKey, restOfPath);
				possibleMatches = possibleMatches.concat(matchesForKey);
			}
			currentNode = undefined;
			continue;
		}

		// or if we have a "any number of key in between" selector (+)
        if (path == "+") {
            let hiddenKeys = ["parentNode", "parentNodeKey", "_position"];
            for (let key of Object.keys(currentNode)) {
                if (hiddenKeys.includes(key)) {
                    continue;
                }

                let nodeAtKey = currentNode[key];

                if (nodeAtKey == null || nodeAtKey == undefined) {
                    continue;
                }

                let restOfPath = jsonPath.slice(pathIndex + 1).join(".");
                
                let matchesForKey = navigateJSONFromNode(nodeAtKey, restOfPath);
                possibleMatches = possibleMatches.concat(matchesForKey);

                if (typeof nodeAtKey !== "string") {
                    let matchesForDeeperKey = navigateJSONFromNode(nodeAtKey, "+." + restOfPath);                
                    possibleMatches = possibleMatches.concat(matchesForDeeperKey);
                }
            }

            currentNode = undefined;
            continue;
        }

		// if we want to match the first part of the string, but not show it (i.e. get/set)
        if (path.includes("^")) {
            let tempSplit = path.split("^");
            let normalPath = tempSplit[0];
            let stringValue = tempSplit[1];
            currentNode = currentNode[normalPath];
   
            if (typeof currentNode === 'string') {
                if (currentNode.startsWith(stringValue)) {
                    currentNode = currentNode.substring(stringValue.length).toLowerCase();
					continue;
                }
            }
			currentNode = undefined;
            continue;
        }

		// if normal node
		currentNode = currentNode[path];
	}
	
	if (currentNode !== undefined && currentNode !== null) {
		if (Array.isArray(currentNode)) {
			currentNode = "Array of " + currentNode.length;
		}
		let tempObj = {
			// lineNo: firstNode.lineNo,
			finalValue: currentNode,
			// from: firstNode,
			// path: JSONWord
		};
		
		possibleMatches.push(tempObj);
	}
	// console.log(possibleMatches);
	
	return possibleMatches;
}

function calculateJSONPath(JSONWord, snippet) {
	let possibleMatches = [];
	let astData = snippet.astData;

	for (lineNo of Object.keys(astData)) {
		let intLineNo = parseInt(lineNo);

		// Do not check for matches outside the snippet
		if (intLineNo < snippet.startLine || intLineNo > snippet.endLine) {
			continue;
		}

		let firstKey = 1000000000;
		if (astData[lineNo] == undefined) {
			continue;
		}

		for (key of Object.keys(astData[lineNo])) {
			if (parseInt(key) < parseInt(firstKey)) {
				firstKey = key;
			}
		}
		let firstNode = astData[lineNo][firstKey];

		let patternIds = undefined;
		let pathWord = JSONWord;
		if (JSONWord.includes(":")) {
			let temp = JSONWord.split(":");
			pathWord = temp.pop();
			patternIds = temp.map(number => parseInt(number, 10));
		}

		let canProceed = true;
		if (patternIds != undefined) {
			// check multi line patterns
			for (pat of snippet.multiLineCompatibilities) {
				if (!patternIds.includes(pat.pattern.id)) {
					continue;
				}

				let valid = false;
				for (interval of pat.intervals) {
					if (intLineNo >= interval[0] && intLineNo <= interval[1]) {
						valid = true;
					}
				}

				if (!valid) {
					canProceed = false;
				}
			}

			// check single line patterns
			for (pat of snippet.compatiblePatterns) {
				// console.log(patternIds, pat.pattern.id);

				if (!patternIds.includes(pat.pattern.id)) {
					continue;
				}

				let valid = false;
				for (k of Object.keys(pat.compatibilities)) {
					for (comp of pat.compatibilities[k]) {
						if (intLineNo == comp.lineNo) {
							valid = true;
						}
					}
				}
				// console.log(pat.pattern.id, valid, intLineNo);

				if (!valid) {
					canProceed = false;
				}
			}
		}

		if (!canProceed) {
			continue;
		}

		let newMatches = navigateJSONFromNode(firstNode, pathWord);
		for (match of newMatches) {
			match.lineNo = lineNo;
		}

		possibleMatches = possibleMatches.concat(newMatches);
		possibleMatches.sort(function(a, b) {
			if (a.lineNo < b.lineNo) {
				return -1;
			}
			if (a.lineNo > b.lineNo) {
				return 1;
			}
			return 0;
		});
	}
	
	return possibleMatches;
}