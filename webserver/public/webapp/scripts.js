const SERVER_URL = "http://foo.inf.usi.ch:3000/"; // http://foo.inf.usi.ch:3000/
const CSV_SEPARATOR = "█";

let currentSnippet = null;
let codeMirror = null;
// let astData = {};
let startTimeStamp = null;

let astPopoverTemplate = `<div id="popover-#LINENO#" class="popover" role="tooltip">
        <div class="arrow"></div>
        <h3 class="popover-header"></h3>
        <div id="popover-body-#LINENO#" class="popover-body"></div>
    </div>`;

var getUrlParameter = function getUrlParameter(sParam) {
	var sPageURL = window.location.search.substring(1),
		sURLVariables = sPageURL.split("&"),
		sParameterName,
		i;

	for (i = 0; i < sURLVariables.length; i++) {
		sParameterName = sURLVariables[i].split("=");

		if (sParameterName[0] === sParam) {
			return sParameterName[1] === undefined
				? true
				: decodeURIComponent(sParameterName[1]);
		}
	}
};

window.onload = function() {
    let snippetId = + getUrlParameter("snippetId");
    let url = "snippet";
    
    if (Number.isInteger(snippetId)) {
        url = "snippet?snippetId=" + snippetId;
    }
    
	httpGetAsync(SERVER_URL + url, function(data) {
		currentSnippet = JSON.parse(data);
		// extractAstData();
        // astData = currentSnippet.astData;

        // TODO: this is an hack, but I could not find out why it did not work normally
        if (currentSnippet.method.id == undefined || currentSnippet.method.id == -1) {
            currentSnippet.fullCode = currentSnippet.fullCode.replace(/\\n/g, "\n");
        }

		codeMirror = CodeMirror(document.getElementById("code-text-container"), {
			value: currentSnippet.fullCode,
			mode: "text/x-java",
			matchBrackets: true,
			lineNumbers: true,
			readOnly: true
		});
		codeMirror.setSize("100%", "100%");

		let codeContainer = document.getElementsByClassName("CodeMirror-code")[0];
		let lineNumber = 1;
		for (line of codeContainer.childNodes) {
			line.setAttribute("data-line-number", lineNumber);
			line.classList.add("single-line-of-code");
			line.id = "line-number-" + lineNumber;

            if (lineNumber >= currentSnippet.startLine && lineNumber <= currentSnippet.endLine) {
                initializeAstPopoverForLine(line);
            }

			lineNumber = lineNumber + 1;
		}

		highlightLineRange(currentSnippet.startLine, currentSnippet.endLine - 1);
		scrollToLine(currentSnippet.startLine);

		document.getElementById("title-text").innerText =
			"Snippet #" + currentSnippet.snippetId;

		startTimeStamp = Date.now();

        // check if we come from another snippet
        let from = getUrlParameter("from");
        if (from != undefined) {
            let newSnippetUrl = location.protocol + '//' + location.host + location.pathname; 
            let param = "?snippetId=" + from + "&from=" + currentSnippet.snippetId;
            let container = document.getElementById("title-from");
            container.innerHTML = `from <a href="${newSnippetUrl + param}">#${from}</a>`;
        }

        saveAllPatternPaths();
        highlightMultiLinePatterns();

        renderNextSingleLinePattern(0);
        renderNextMultiLinePattern(0);
        extractImports();
        findValidApiMethods();
        renderNextDocumentation(0);
	});
    initializeNewSnippetModal();
};


let validApiMethods = {};
let apiNamesToData = {};

function findValidApiMethods() {
    let astData = currentSnippet.astData;
    for (lineNo of Object.keys(astData)) {
		let intLineNo = parseInt(lineNo);

		// Do not check for matches outside the snippet
		if (intLineNo < currentSnippet.startLine || intLineNo > currentSnippet.endLine) {
			continue;
		}

        for (colNo of Object.keys(astData[lineNo])) {
            let node = astData[lineNo][colNo];
            findValidApiInNode(node, lineNo);
        }
    }
}

function findValidApiInNode(node, lineNo) {
    if (typeof node !== 'object' || node === null) {
		return;
	}

    if (node.apiMethods != undefined && node.apiMethods.length != 0) {
        for (apiMethod of node.apiMethods) {
            let fullName = apiMethod.package + "." + apiMethod.containerName;
            let fullNameKey = fullName + "|" + apiMethod.methodName;
            if (!fullNameKey in apiNamesToData) {
                apiNamesToData[fullNameKey] = apiMethod;
            }

            if (imports.includes(fullName)) {
                if (codeMirror.getLine(lineNo - 1).includes(apiMethod.methodName)) {
                    if (fullNameKey in validApiMethods) {
                        if (!validApiMethods[fullNameKey].includes(lineNo)) {
                            validApiMethods[fullNameKey].push(lineNo);
                        }
                    } else {
                        validApiMethods[fullNameKey] = [lineNo]
                    }
                    apiNamesToData[fullNameKey] = apiMethod;
                }
            }
        }
    }

	Object.keys(node).forEach(function(key) {
		findValidApiInNode(node[key], lineNo);
	});
}

let imports = [];
function extractImports() {
    let fullCode = currentSnippet.fullCode;
    let lines = fullCode.split("\n");

    for (l of lines) {
        if (l.startsWith("import ")) {
            let imp = l.substring(7, l.length - 1);
            imports.push(imp);

            // let temp = imp.split(".");
            // temp.pop();
            // temp.push("*");
            // let withStar = temp.join(".");
            // imports.push(withStar);
        }
    }
}


function renderSingleLinePatternOnTab(index) {
    let title = document.getElementById("single-line-patterns-id");
    if (index < 0 || index >= currentSnippet.compatiblePatterns.length) {
        title.style.color = "red";
        title.innerHTML = "No single-line patterns found!"
        return
    }

    let pattern = currentSnippet.compatiblePatterns[index];

    title.style.color = "black";
	title.innerHTML = "Pattern #" + pattern.pattern.id;

    document.getElementById("single-line-textarea").value = pattern.pattern.pattern; // mmm ok
}


function renderNextSingleLinePattern(delta) {
    let tab = document.getElementById("single-line-patterns-tab");

    let index = parseInt(tab.getAttribute("data-index"));

    if (delta != undefined) {
        index = index + delta;
    }

    if (index >= currentSnippet.compatiblePatterns.length) {
        index = 0;
    }

    if (index < 0) {
        index = currentSnippet.compatiblePatterns.length - 1;
    }

    tab.setAttribute("data-index", index)
    renderSingleLinePatternOnTab(index);
}

function renderMultiLinePatternOnTab(index) {
	let title = document.getElementById("multi-line-patterns-id");
	if (index < 0 || index >= currentSnippet.multiLineCompatibilities.length) {
		title.style.color = "red";
		title.innerHTML = "No multi-line patterns found!";
		return;
	}

	let pattern = currentSnippet.multiLineCompatibilities[index];

    if (pattern.intervals.length == 0) {
        renderMultiLinePatternOnTab(index + 1);
        return;
    }

	title.style.color = "black";
	title.innerHTML = "Pattern #" + pattern.pattern.id;

	document.getElementById("multi-line-textarea").value = pattern.pattern.pattern;
}

function renderNextMultiLinePattern(delta) {
	let tab = document.getElementById("multi-line-patterns-tab");

	let index = parseInt(tab.getAttribute("data-index"));

	if (delta != undefined) {
		index = index + delta;
	}

	if (index >= currentSnippet.multiLineCompatibilities.length) {
		index = 0;
	}

	if (index < 0) {
		index = currentSnippet.multiLineCompatibilities.length - 1;
	}

	tab.setAttribute("data-index", index);
	renderMultiLinePatternOnTab(index);
}

function renderDocumentationOnTab(index) {
	let title = document.getElementById("documentation-name");
    let arr = Object.keys(validApiMethods);
	if (index < 0 || index >= arr.length) {
		title.style.color = "red";
		title.innerHTML = "No API method found!";
		return;
	}

    let key = arr[index];
    let data = apiNamesToData[key];
	let affectedLines = validApiMethods[key];

	title.style.color = "black";
	title.innerHTML = `${data.methodName}(${data.parameters})`;

	document.getElementById("documentation-textarea").value = 
        data.description + "\n\n" + "Found in lines: " + affectedLines.join(", ");
}

function renderNextDocumentation(delta) {
	let tab = document.getElementById("documentation-tab");

	let index = parseInt(tab.getAttribute("data-index"));

	if (delta != undefined) {
		index = index + delta;
	}

    let arr = Object.keys(validApiMethods);
	if (index >= arr.length) {
		index = 0;
	}

	if (index < 0) {
		index = arr.length - 1;
	}

	tab.setAttribute("data-index", index);
	renderDocumentationOnTab(index);
}


// there must be a cleaner way
let colors = {
	aqua: "#00ffff",
	// azure: "#f0ffff",
	// beige: "#f5f5dc",
	black: "#000000",
	blue: "#0000ff",
	brown: "#a52a2a",
	cyan: "#00ffff",
	darkblue: "#00008b",
	darkcyan: "#008b8b",
	darkgrey: "#a9a9a9",
	darkgreen: "#006400",
	darkkhaki: "#bdb76b",
	darkmagenta: "#8b008b",
	darkolivegreen: "#556b2f",
	darkorange: "#ff8c00",
	darkorchid: "#9932cc",
	darkred: "#8b0000",
	darksalmon: "#e9967a",
	darkviolet: "#9400d3",
	fuchsia: "#ff00ff",
	gold: "#ffd700",
	green: "#008000",
	indigo: "#4b0082",
	khaki: "#f0e68c",
	lightblue: "#add8e6",
	lightcyan: "#e0ffff",
	lightgreen: "#90ee90",
	lightgrey: "#d3d3d3",
	lightpink: "#ffb6c1",
	lightyellow: "#ffffe0",
	lime: "#00ff00",
	magenta: "#ff00ff",
	maroon: "#800000",
	navy: "#000080",
	olive: "#808000",
	orange: "#ffa500",
	pink: "#ffc0cb",
	purple: "#800080",
	violet: "#800080",
	red: "#ff0000",
	silver: "#c0c0c0",
	white: "#ffffff",
	yellow: "#ffff00"
};

let colorIndex = -1
function getColor() {
    let keys = Object.keys(colors);
    if (colorIndex > keys.length) {
        colorIndex = -1;
    }
    colorIndex = colorIndex + 1;
    return colors[keys[colorIndex]];
}

let openedPatternPreview = undefined;

function highlightMultiLinePatterns() {
    for (mp of currentSnippet.multiLineCompatibilities) {
        fixObjectInterval(mp);
        let patternColor = getColor();
        for (interval of mp.intervals) {
            for (let i = interval[0]; i <= interval[1]; i++) {
                let line = document.getElementById("line-number-" + i);
                line.classList.add("multi-pattern-middle-line");

                if (i == interval[0]) {
                    line.classList.add("multi-pattern-top-line");
                }
                if (i == interval[1]) {
                    line.classList.add("multi-pattern-bottom-line");
                }

                if (line.style.borderColor == "") {
                    line.style.borderColor = patternColor; 
                }
                
                addShowPatternListenerToLineNumber(i);
            }
        }
        
    }
}

// needed because more pattern can match in a smaller interval when the server calculates it
// but we want to visualize the full space that the snippet takes, taking into account
// where the sub pattern are
function fixObjectInterval(multiLinePattern) {

    if (multiLinePattern.intervals.length == 0) {
        return;
    }

    let pattern = multiLinePattern.pattern;
    let lines = pattern.pattern.split("\n");
    let words = [];
    lines.forEach(function(el) {
        if (el[0] == "!") {
            // nothing
        } else {
            words.push(el.split(" "));
        }
    });
    words = words.flat();

    for (interval of multiLinePattern.intervals) {
        let beginning = interval[0];
        let end = interval[1];
        
        for (const word of words) {
            if (word[0] == "<" && word[word.length - 1] == ">") {
                let possibilities = calculateJSONPath(word.substring(1, word.length - 1), currentSnippet);
                
                let currentWordFit = false;
                let nearestLineInitialValue = -Infinity;
                let nearestLine = nearestLineInitialValue;
                for (p of possibilities) {
                    if (p.lineNo >= beginning && p.lineNo <= end) {
                        currentWordFit = true;
                        break;
                    }

                    // <= because we naturally want the second occurrence in the snippet, not the first
                    if (p.lineNo > end) {
                        if (Math.abs(p.lineNo - end) < Math.abs(nearestLine - end)) {
                            nearestLine = p.lineNo;
                        }
                    } else if (p.lineNo < beginning) {
                        if (Math.abs(beginning - p.lineNo) < Math.abs(nearestLine - p.lineNo)) {
                            nearestLine = p.lineNo;
                        }
                    }
                }

                // console.log(word, nearestLine, currentWordFit);
                
                if (!currentWordFit) {
                    if (nearestLine == nearestLineInitialValue) {
                        continue;
                    }

                    if (nearestLine > end) {
                        interval[1] = nearestLine;
                    } else if (nearestLine < beginning) {
                        interval[0] = nearestLine;
                    }
                }
            }
        }
    }
}

// function parseAstPositions(node) {
// 	if (typeof node !== "object" || node === null) {
// 		return;
// 	}

// 	Object.keys(node).forEach(function(key) {
// 		parseAstPositions(node[key]);
// 	});

// 	if ("_position" in node) {
// 		if (astData[node._position[0]] == undefined) {
// 			astData[node._position[0]] = {};
// 		}
// 		astData[node._position[0]][node._position[1]] = node;
// 	}
// }

// function extractAstData() {
// 	parseAstPositions(currentSnippet.method.ast);
// }
let openedPopovers = [];
function initializeAstPopoverForLine(line) {
	let lineNo = line.getAttribute("data-line-number");
	line.setAttribute("data-toggle", "popover");

    let preTag = line.getElementsByClassName("CodeMirror-line");
    let popoverElement = preTag.length > 0 ? preTag[0] : line;

	let popover = $(popoverElement);

	popover.popover({
		container: "body",
		content: "",
		html: true,
		title: "AST",
		trigger: "click",
		placement: "auto",
		template: astPopoverTemplate.replace(/#LINENO#/g, lineNo)
	});

	popover.on("show.bs.popover", function(e) {
        while (openedPopovers.length > 0) {
            openedPopovers.pop().popover('hide');
        }
        openedPopovers.push(popover);
		let popoverDiv = popover.data("bs.popover").tip;
		let popData = popover.data("bs.popover");
		let startColumn = codeMirror.getCursor("from").ch + 1;
		let endColumn = codeMirror.getCursor("to").ch + 1;
		let astNodes = new Set();

		let collectAstNodes = function(node, parentNode, parentNodeKey) {
			if (typeof node !== "object" || node === null) {
				return;
			}

			if (Array.isArray(node)) {
				node.forEach(function(el) {
					collectAstNodes(el, parentNode, parentNodeKey);
				});
				return;
			}

			if (node != parentNode) {
				node.parentNode = parentNode;
				node.parentNodeKey = parentNodeKey;
			}

			Object.keys(node).forEach(function(key) {
				if (key == "parentNode") {
					return;
				}

				collectAstNodes(node[key], node, key);
				if (node._position != undefined) {
					if (node._position[0] == lineNo) {
						astNodes.add(node);
					}
				}
			});
		};

		let lineData = currentSnippet.astData[lineNo];

		if (lineData == undefined) {
			return;
		}

		let firstElement = Object.keys(lineData).reduce((key, v) =>
			lineData[v] < lineData[key] ? v : key
		);

		collectAstNodes(lineData[firstElement]);

		astNodes = Array.from(astNodes);
		astNodes.sort((a, b) => {
			return a._position[1] > b._position[1] ? 1 : a._position[1] < b._position[1] ? -1 : 0;
		});

		let bestColumnMatch = null;

		// single click, no selection
		if (startColumn == endColumn) {
			for (let i = 0; i < astNodes.length; i++) {
				let node = astNodes[i];

				if (bestColumnMatch == null) {
					bestColumnMatch = node;
					continue;
				}

				let nodeColumn = node._position[1];

				if (startColumn < nodeColumn) {
					continue;
				}

				if (startColumn >= nodeColumn) {
					bestColumnMatch = node;
					continue;
				}
			}

			$("[data-toggle='popover']")
				.not(this)
				.popover("hide");

			if (bestColumnMatch == null) {
				popData.config.content = "";
				return;
			}

			console.log(bestColumnMatch);

			$("#jsonview-tree-store")[0].innerHTML = "";
			let jsonViewer = new JSONViewer();
			$("#jsonview-tree-store")[0].appendChild(jsonViewer.getContainer());
			jsonViewer.showJSON(bestColumnMatch, -1, -1);

			popData.config.content = $("#jsonview-tree-store")[0].innerHTML;
			popData.config.title = "You clicked a " + bestColumnMatch.nodeType;

			// This is very ugly, but Bootstraps blocks the navigation arrows:
			// so, without this, we won't be able to navigate the JSON
			// We need to render it again after the popover is shown
			setTimeout(() => {
				let popoverBody = $("#popover-body-" + lineNo)[0];
				popoverBody.innerHTML = "";

				let jsonViewer = new JSONViewer();
				popoverBody.appendChild(jsonViewer.getContainer());
				// jsonViewer.showJSON(bestColumnMatch, -1, 1);
				jsonViewer.showJSON(astNodes[0], -1, 1);
				addListenerToChildren(popoverBody, "", astNodes[0]);
			}, 200);
			// popData.config.content = buildPopoverShownString(bestColumnMatch);
		} else {
			// some text is selected
			bestColumnMatch = [];
			matchTypes = [];
			for (let i = 0; i < astNodes.length; i++) {
				let node = astNodes[i];
				let nodeColumn = node._position[1];

				if (startColumn <= nodeColumn && nodeColumn <= endColumn) {
					bestColumnMatch.push(node);
					if (node.nodeType != undefined) {
						matchTypes.push(node.nodeType);
					}
					continue;
				}
			}

			if (matchTypes.length != 0) {
				popData.config.content = matchTypes.join(", ");
			} else {
				popData.config.content = "No nodes selected!";
			}
			console.log(bestColumnMatch);
		}
	});

	$("#pattern-textarea").on("change keyup", onTextAreaChange);
}

// do this also periodically maybe?
let lastModificationTimestamp = 0;
function onTextAreaChange(event) {
	if (event.timeStamp - lastModificationTimestamp <= 500) {
		return;
	}
	lastModificationTimestamp = event.timeStamp;

	let text = event.target.value;

	parsePatternForSnippet(text, currentSnippet, true);
}

function attemptToDocument() {
    let result = [];
    let currentLine = currentSnippet.startLine;

    while (currentLine < currentSnippet.endLine) {
        let patternText = getBestPatternForLine(currentLine);
        let multiLinePatternCompatibility = getBestMultiLinePatternForLine(currentLine);
        let currentLineCode = codeMirror.getLine(currentLine - 1);                    

        let whitespaces = "";
        let whiteEndIndex = currentLineCode.search(/\S|$/);
        whitespaces = currentLineCode.substring(0, whiteEndIndex);        

        if (patternText != undefined) {
            let singleLineSnippet = {...currentSnippet};
            singleLineSnippet.endLine = currentLine + 1;
            singleLineSnippet.startLine = currentLine;

            let words = [];
            let lines = patternText.split("\n");
            lines.forEach(function(el) {
                if (el[0] != "!") {
                    words.push(el.split(" "));
                }
            });
            words = words.flat();

            let resultText = "";
            for (const word of words) {
                if (word[0] == "<" && word[word.length - 1] == ">") {
                    resultText = resultText + handleJsonLinkWord(word.substring(1, word.length - 1), singleLineSnippet) + " ";
                } else {
                    resultText = resultText + word + " ";
                }
            }        
            
            result.push(whitespaces + "// " + resultText);
        }

        if (multiLinePatternCompatibility != undefined) {
            let multiLineSnippet = {...currentSnippet};
            multiLineSnippet.endLine = multiLinePatternCompatibility[1][1];
            multiLineSnippet.startLine = multiLinePatternCompatibility[1][0];

            let multiPatternText = multiLinePatternCompatibility[0].pattern;

            let words = [];
            let lines = multiPatternText.split("\n");
            lines.forEach(function(el) {
                if (el[0] != "!") {
                    words.push(el.split(" "));
                }
            });
            words = words.flat();

            let multiResultText = "";
            for (const word of words) {
                if (word[0] == "<" && word[word.length - 1] == ">") {
                    multiResultText = multiResultText + handleJsonLinkWord(word.substring(1, word.length - 1), multiLineSnippet) + " ";
                } else {
                    multiResultText = multiResultText + word + " ";
                }
            }        
            
            result.push(whitespaces + "/* " + multiResultText + " */");
        }

        result.push(currentLineCode);
        currentLine = currentLine + 1;
    }


    let container = document.getElementById("modal-result-textarea");
    container.innerHTML = "";

    resultCodeMirror = CodeMirror(container, {
			value: result.join("\n"),
			mode: "text/x-java",
			matchBrackets: true,
			readOnly: true
		});
    resultCodeMirror.setSize("100%", "100%");
    
    $("#modal-result").on("show.bs.modal", function() {
        // there is a problem with codemirror and bootstrap's modal
        // with this we can solve it
        setTimeout(function() {
            resultCodeMirror.refresh();
        }, 200);
    });

    $("#modal-result").modal("show");
    // document.getElementById("modal-result-textarea").value = 
}

function getBestMultiLinePatternForLine(lineNo) {
    possibleMatches = []
    for (el of currentSnippet.multiLineCompatibilities) {
        for (int of el.intervals) {
            if (int[0] == lineNo) {
                possibleMatches.push([el.pattern, int]);
            }
        }
    }

    if (possibleMatches.length == 0) {
        return undefined;
    }

    if (possibleMatches.length == 1) {
        return possibleMatches[0];
    }

    
    let bestMatch = undefined;
    let bestScore = 0;
    for (m of possibleMatches) {
        let score = getMultiLinePatternScore(m);
        if (bestScore < score) {
            bestMatch = m;
            bestScore = score;
        }
    }

    return bestMatch;
}

function getBestPatternForLine(lineNo) {
	let linePatterns = patternsByLine[lineNo] || [];
    let currentLineCode = codeMirror.getLine(lineNo - 1);   
    let patternIdsInLine = linePatterns.map(e => parseInt(e.pattern.id, 10));

	let singleLinePatterns = {};

	for (const p of linePatterns) {
		if (p.pattern.snippetLength == 1) {
			if (singleLinePatterns[p.pattern.id] == undefined) {
				singleLinePatterns[p.pattern.id] = [p];
			} else {
				singleLinePatterns[p.pattern.id].push(p);
			}
		}
	}

	currentLinePatterns = { ...singleLinePatterns };
    let bestPattern = undefined;
    let bestPatternScore = 0;

    let firstCol = 1000;

    for (const patternId of Object.keys(singleLinePatterns)) {
        let arr = currentLinePatterns[patternId];
        if (arr.length == 0) {
            continue;
        }
        if (firstCol > parseInt(arr[0].colNo, 10)) {
            firstCol = parseInt(arr[0].colNo, 10);
        }
    }

	for (const patternId of Object.keys(singleLinePatterns)) {
		let arr = currentLinePatterns[patternId];
        if (arr.length == 0) {
            continue;
        }
        pattern = arr[0].pattern;
        colNo = parseInt(arr[0].colNo, 10);

        let satisfyRequiredSub = true;
        
        for (requirement of pattern.requiredSubPatterns) {     
            if (!patternIdsInLine.includes(parseInt(requirement, 10))) {
                satisfyRequiredSub = false;
            }
        }
        
        if (!satisfyRequiredSub) {
            continue;
        }

        let subtractScore = 0;

        if (colNo > firstCol) {
            subtractScore = 4;
        }

        if (bestPattern == undefined) {
            bestPattern = pattern;
            bestPatternScore = getPatternScore(pattern, currentLineCode) - subtractScore;
            continue;
        }
		
        let patternScore = getPatternScore(pattern, currentLineCode) - subtractScore;
        if (patternScore > bestPatternScore) {
            bestPatternScore = patternScore;
            bestPattern = pattern;
        }
	}

    if (bestPattern == undefined) {
        return undefined;
    }

    return getDocumentationResult(bestPattern.id);
}

function getMultiLinePatternScore(match) {
	let p = match[0].pattern;
	let requirements = p.match(/^!require.*/gm) || [];
	let scoreRequirements = requirements.length;
    let linesOfCode = "";

    for (let i = match[1][0]; i < match[1][1]; i++) {
        let currentLineCode = codeMirror.getLine(i - 1);  
        linesOfCode = linesOfCode + currentLineCode + "\n";
    }

	for (req of requirements) {
		if (req.includes("member")) {
			scoreRequirements = scoreRequirements + 6;
		}
	}

	let keywords = p.match(/<\S*>/gm) || [];
	let scoreKeywords = keywords.length;

	for (keyword of keywords) {
		if (keyword.includes("^")) {
			let temp = keyword.split("^")[1];
			if (temp.endsWith(">")) {
				temp = temp.substring(0, temp.length - 1);
			}

			if (linesOfCode.includes(temp)) {
				scoreKeywords = scoreKeywords + 3;
			} 
		}
	}

	let scoreRequiredSubPatterns = pattern.requiredSubPatterns.length * 5;

	return scoreRequirements + scoreKeywords + scoreRequiredSubPatterns;
}

function getPatternScore(pattern, line) {
    let p = pattern.pattern;
    let requirements = p.match(/^!require.*/gm) || [];
    let scoreRequirements = requirements.length;

    for (req of requirements) {        
        if (req.includes("member")) {
            scoreRequirements = scoreRequirements + 6;
        }
    }

    let keywords = (p.match(/<\S*>/gm) || []);
    let scoreKeywords = keywords.length;

    for (keyword of keywords) {
        if (keyword.includes("^")) {
            let temp = keyword.split("^")[1];
            if (temp.endsWith(">")) {
                temp = temp.substring(0, temp.length - 1);
            }

            if (line.includes(temp)) {
                scoreKeywords = scoreKeywords + 3;
            } else {
                // there was some error and we have no real match with this
                scoreKeywords = -10000;
            }

        }
    }
    
    let scoreRequiredSubPatterns = pattern.requiredSubPatterns.length * 5;

    return scoreRequirements + scoreKeywords + scoreRequiredSubPatterns;
}

function getDocumentationResult(patternId) {
	let patternsInLine = currentLinePatterns[patternId];
	let pattern = patternsInLine[0].pattern;

	let resultText = "";
	let replacements = [];

	for (let el of patternsInLine) {
		replacements.push([`${el.word}`, `${el.fullPath}`, el.pattern.id]);
	}

	let resultRequirements = "";

	for (const line of pattern.pattern.split("\n")) {
		if (line.startsWith("!")) {
			resultRequirements = resultRequirements + line + "\n";
			continue;
		}

		let resultLine = line;

		for (let repl of replacements) {
			if (resultLine.includes("<" + repl[0] + ">")) {
				resultLine = replaceGlobal(
					resultLine,
					"<" + repl[0] + ">",
					"<" + repl[1] + ">"
				);
			}
		}

		resultLine = replaceGlobal(resultLine, "<", "<" + pattern.id + ":");
		resultText = resultText + resultLine + "\n";
	}

	return resultText.trim();
}

// Would be nice to refactor the parser later
function parsePatternForSnippet(pattern, snippet, render = true) {
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
	words = words.flat();

	let areRequirementsSatisfied = verifyRequirements(specialLines);

    if (render) {
        renderPatternPreview(words, areRequirementsSatisfied);
        return areRequirementsSatisfied;
    } else {
        let result = true;
        let allMatches = [];
        for (const word of words) {
            if (word[0] == "<" && word[word.length - 1] == ">") {
                let possibleMatches = calculateJSONPath(word, snippet);
                allMatches.push(possibleMatches);
                result = result && possibleMatches.length > 0;
            }
        }

        return [result && areRequirementsSatisfied, allMatches]
    }
}

function renderPatternPreview(words, areRequirementsSatisfied) {
    let previewElement = document.getElementById("preview-viewer");
    previewElement.innerHTML = "";
    lineNosByPatternId = {};

    let result = "";
    for (const word of words) {
        if (word[0] == "<" && word[word.length - 1] == ">") {
            result = result + handleJsonLinkWord(word.substring(1, word.length - 1)) + " ";
        } else {
            result = result + word + " ";
        }
    }

    previewElement.innerHTML = result;

    let reqSpan = document.getElementById("requirements-check");
    if (areRequirementsSatisfied) {
        reqSpan.classList.remove("requirements-error");
        reqSpan.classList.add("requirements-ok");
        reqSpan.title = "Requirements satisfied!";
        reqSpan.innerHTML = "✓";
    } else {
        reqSpan.classList.remove("requirements-ok");
        reqSpan.classList.add("requirements-error");
        reqSpan.title = "Requirements not satisfied!";
        reqSpan.innerHTML = "✗";
    }
}

function verifyRequirements(lines) {
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

        if (line.startsWith("!satisfies ")) {
            let data = line.replace("!satisfies ", "");
            let numbers = data.split(",");
            
            let satisfied = true;
            for (n of numbers) {
                let nsatisfied = false;
                for (sp of currentSnippet.compatiblePatterns) {
                    if (parseInt(n) == parseInt(sp.pattern.id)) {
                        nsatisfied = true;
                        break;
                    }
                }

                if (nsatisfied != true) {
                    for (mp of currentSnippet.multiLineCompatibilities) {
                        if (parseInt(n) == parseInt(mp.pattern.id)) {
                            nsatisfied = true;
                            break;
                        }
                    }
                }
                satisfied = satisfied && nsatisfied;
            }
            areAllRequirementsSatisfied[i] = satisfied;
        }
	});
    

	let aggregateChecks = areAllRequirementsSatisfied.reduce(
		(agg, el) => agg && el, true);
    
	return aggregateChecks;
}

function handleJsonLinkWord(word, snippet) {
    let useSnippet = currentSnippet;
    let getSingleResult = false;
    if (snippet != undefined) {
        useSnippet = snippet;
        getSingleResult = true;
    }
	let possibleMatches = calculateJSONPath(word, useSnippet);

    let patternId = undefined;
    if (word.includes(":")) {
        let tempSplit = word.split(":");
        patternId = tempSplit[tempSplit.length - 2];
    }

    if (getSingleResult) {
        if (possibleMatches.length == 0) {
            return "";
        } else {
            return possibleMatches[0].finalValue;
        }
    }
    return generatePreviewWithAlternatives(possibleMatches, patternId);
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
            for (pat of currentSnippet.multiLineCompatibilities) {
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
            for (pat of currentSnippet.compatiblePatterns) {
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

        possibleMatches = possibleMatches.concat(navigateJSONFromNode(firstNode, pathWord));
        possibleMatches.sort(function (a,b) {
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

function navigateJSONFromNode(firstNode, JSONWord) {
    let possibleMatches = [];

    let jsonPath = JSONWord.split(".");
    let currentNode = firstNode;

    let pathIndex = -1;
    for (path of jsonPath) {
        pathIndex = pathIndex + 1;
        if (currentNode === undefined) {
            continue;
        }

        // if we have an array
        if (path.includes("[") && path.includes("]")) {
            let matches = path.match(/\[(.*?)\]/);
            if (matches) {
                let index = parseInt(matches[1]);
                let arrKey = path.split(matches[0])[0];
                currentNode = currentNode[arrKey];
                if (currentNode != undefined) {
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

                if (nodeAtKey == null || nodeAtKey == undefined) {
                    continue;
                }

                let restOfPath = jsonPath.slice(pathIndex + 1).join(".");
                
                let matchesForKey = navigateJSONFromNode(nodeAtKey, restOfPath)
                
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

    if (currentNode !== undefined) {
        if (Array.isArray(currentNode)) {
            currentNode = "Array of " + currentNode.length;
        }
        let tempObj = {
            lineNo: lineNo,
            finalValue: currentNode
        };
        possibleMatches.push(tempObj);
    }

    return possibleMatches;
}

let selectedAlternatives = {};
// let linkedElements = {};

function generatePreviewWithAlternatives(alternatives, patternId) {
	if (alternatives.length <= 0) {
		return generatePreviewError("No matches!");
	}

	let dataAlt = JSON.stringify(alternatives);
	let index = 0;
	if (dataAlt in selectedAlternatives) {
		index = selectedAlternatives[dataAlt];
	} else {
        selectedAlternatives[dataAlt] = index;
    }

    let patternIdData = patternId != undefined ? `data-pattern-id=${patternId} ` : "";

	return `<span class="preview-with-alternatives" 
            onclick="nextAlternative(event);" ${patternIdData}
            data-index=0 data-alternatives='${dataAlt}'>${alternatives[index].finalValue} (${alternatives[index].lineNo})</span>`;
}

let lineNosByPatternId = {};

// From stackoverflow
function getCommonElements(arrays) {
	//Assumes that we are dealing with an array of arrays of integers
	var currentValues = {};
	var commonValues = {};
	for (var i = arrays[0].length - 1; i >= 0; i--) {
		//Iterating backwards for efficiency
		currentValues[arrays[0][i]] = 1; //Doesn't really matter what we set it to
	}
	for (var i = arrays.length - 1; i > 0; i--) {
		var currentArray = arrays[i];
		for (var j = currentArray.length - 1; j >= 0; j--) {
			if (currentArray[j] in currentValues) {
				commonValues[currentArray[j]] = 1; //Once again, the `1` doesn't matter
			}
		}
		currentValues = commonValues;
		commonValues = {};
	}
	return Object.keys(currentValues).map(function(value) {
		return parseInt(value);
	});
}

function nextAlternative(event) {
	let index = parseInt(event.target.getAttribute("data-index"));
	let dataAlt = event.target.getAttribute("data-alternatives");
	let alternatives = JSON.parse(dataAlt);

    let otherAlternatives = document.getElementsByClassName("preview-with-alternatives");
    let samePatternAlternatives = [];
    let patternId = event.target.getAttribute("data-pattern-id");

    if (patternId != undefined) {
        for (el of otherAlternatives) {
            let elPatternId = el.getAttribute("data-pattern-id");
            if (elPatternId != undefined && elPatternId == patternId) {
                samePatternAlternatives.push(el);
            }
        }

        // if we don't already have the common rows, calculate them
        if (lineNosByPatternId[patternId] == undefined) {
            lineNosByPatternId[patternId] = [];
            // let temp = []
            // for (alt of alternatives) {
            //     temp.push(alt.lineNo);
            // }
            // lineNosByPatternId[patternId].push(temp);

            for (p of samePatternAlternatives) {
                let itsAlternatives = JSON.parse(p.getAttribute("data-alternatives"))
                let temp = [];
                for (el of itsAlternatives) {
                    temp.push(el.lineNo)
                }
                lineNosByPatternId[patternId].push(temp);
            }
            lineNosByPatternId[patternId] = getCommonElements(lineNosByPatternId[patternId]);
        }
    } else {
        samePatternAlternatives.push(event.target);
    }

    // nextAlternative( { target: p } , true)
    if (samePatternAlternatives.length == 1 || patternId == undefined) {
        index = index + 1;
        if (index >= alternatives.length) {
            index = 0;
        }

        let lineDiv = getLineDivByNumber(alternatives[index].lineNo);
        lineDiv.classList.add("blink-line");
        setTimeout(function() {
            lineDiv.classList.remove("blink-line");
        }, 1000);

        event.target.setAttribute("data-index", index);
        event.target.innerHTML = `${alternatives[index].finalValue} (${alternatives[index].lineNo})`;
    } else {
        index = index + 1;
        if (index >= lineNosByPatternId[patternId].length) {
            index = 0;
        }
        let newLineNo = lineNosByPatternId[patternId][index];
        
        for (sameIdEl of samePatternAlternatives) {
            let tempDataAlt = JSON.parse(sameIdEl.getAttribute("data-alternatives"));
            let altIndex = 0;

            for (alt of tempDataAlt) {
                if (alt.lineNo == newLineNo) {
                    break;
                }
                altIndex = altIndex + 1;
            }
            
            // we want this only once
            if (sameIdEl == event.target) {
                let lineDiv = getLineDivByNumber(tempDataAlt[altIndex].lineNo);
                lineDiv.classList.add("blink-line");
                setTimeout(function() {
                    lineDiv.classList.remove("blink-line");
                }, 1000);
            }

            sameIdEl.setAttribute("data-index", altIndex);
            sameIdEl.innerHTML = `${tempDataAlt[altIndex].finalValue} (${tempDataAlt[altIndex].lineNo})`;
        }
    }
}

function getLineDivByNumber(lineNo) {
	let lines = document.getElementsByClassName("single-line-of-code");
	for (l of lines) {
		let lineNumber = l.getAttribute("data-line-number");
		if (lineNumber == lineNo) {
			return l;
		}
	}
}

function generatePreviewError(error) {
	return '<span class="preview-error">' + error + "</span>";
}

function addListenerToChildren(node, value) {
	for (let child of node.childNodes) {
		if (child == undefined) {
			continue;
		}

		if (child.tagName == "UL" && child.getAttribute("parent-key") != null) {
			let parentKey = child.getAttribute("parent-key");
			let newValue = value + parentKey + ".";

			addListenerToChildren(child, newValue);
		} else if (
			child.tagName == "LI" &&
			child.getAttribute("data-array-index") != null
		) {
			let arrayIndex = child.getAttribute("data-array-index");
			let newValue = `${value.slice(0, -1)}[${arrayIndex}].`;
			addListenerToChildren(child, newValue);
		} else {
			addListenerToChildren(child, value);
		}

		if (child.tagName == "SPAN") {
			if (child.getAttribute("need-listener") == "true") {
				child.addEventListener("click", function(event) {
					event.stopPropagation();
					let textArea = document.getElementById("pattern-textarea");
                    insertAtCursor(textArea, ` <${value + child.getAttribute("data-key")}> `);
				});
			}
		}
	}
}

// From StackOverflow
function insertAtCursor(textArea, value) {
	//IE support
	if (document.selection) {
		textArea.focus();
		sel = document.selection.createRange();
		sel.text = value;
	}
	//MOZILLA and others
	else if (textArea.selectionStart || textArea.selectionStart == "0") {
		var startPos = textArea.selectionStart;
		var endPos = textArea.selectionEnd;
		textArea.value =
			textArea.value.substring(0, startPos) +
			value +
			textArea.value.substring(endPos, textArea.value.length);
	} else {
		textArea.value += value;
	}
}


function buildPopoverShownString(node) {
	let parentPrefix = "";
	let parentSuffix = "";

	let currentParent = node;

	while (currentParent != undefined) {
		if (currentParent.nodeType != undefined) {
			let parentNodeKey =
				currentParent.parentNodeKey == undefined
					? ""
					: currentParent.parentNodeKey + ": ";
			parentPrefix =
				parentNodeKey + currentParent.nodeType + "(" + parentPrefix;
			parentSuffix = parentSuffix + ")";
		}
		currentParent = currentParent.parentNode;
	}

	let indentationLevel = 1;
	let indentString = "-- ";
	let fullString = parentPrefix + parentSuffix;
	let result = "";

	for (let i = 0; i < fullString.length; i++) {
		let char = fullString[i];

		if (char == "(") {
			result = result + "\n" + indentString.repeat(indentationLevel);
			indentationLevel = indentationLevel + 1;
			continue;
		}

		if (char == ")") {
			indentationLevel = indentationLevel - 1;
			continue;
		}

		result = result + char;
	}

	return result;
}


function submitPattern() {

    let patternText = document.getElementById("pattern-textarea").value;
    let requiredSubPatterns = [];

    for (line of patternText.split("\n")) {
        if (line.startsWith("!satisfies ")) {
            let data = line.replace("!satisfies ", "");
            let numbers = data.split(",");
            
            for (n of numbers) {
                requiredSubPatterns.push(parseInt(n));
            }
        }

        if (line.startsWith("!")) {
            continue;
        }

        for (word of line.split(" ")) {
            if (word[0] == "<" && word[word.length - 1] == ">") {
                let path = word.substring(1, word.length - 1);
                if (path.includes(":")) {
                    let tempSplit = path.split(":");
                    tempSplit.pop(); // remove the path, keep the pattern ids
                    requiredSubPatterns = requiredSubPatterns.concat(tempSplit);
                }
            }
        }
    }

    let patternData = {
        snippetId: currentSnippet.snippetId,
        pattern: patternText,
        snippetLength: currentSnippet.endLine - currentSnippet.startLine,
        selectedAlternatives: selectedAlternatives,
        hadInterruptions: document.getElementById("interruptions-checkbox").checked,
        startTime: startTimeStamp,
        endTime: Date.now(),
        requiredSubPatterns: Array.from(new Set(requiredSubPatterns))
    };

    httpPostAsync(SERVER_URL + "snippet/submit", patternData, function(xhr) {
        if (xhr.readyState === 4 && xhr.status === 200) {
            alert("Pattern submitted correctly!")
            document.getElementById("bottom-bar-btn-cancel").innerHTML = "Next";
        }
    });
}


function initializeNewSnippetModal() {
    $("#new-snippet-modal").on("show.bs.modal", function(e) {
        $("[data-toggle='popover']").popover("hide");
        let startLine = codeMirror.getCursor("from").line + 1;
        let endLine = codeMirror.getCursor("to").line + 1;

        if (startLine == 1 && endLine == 1) {
            $("#new-snippet-modal").modal("hide");
            return e.preventDefault();
        }

        let linesContainer = document.getElementById("new-snippet-code-line-numbers");
        linesContainer.innerHTML = ` (${startLine}-${endLine})`;
        
        let modal = $(this);
        modal.find("#new-snippet-code").val(codeMirror.getSelection());
    });
}

function updateNewSnippetModalArea(enabled) {
    let area = document.getElementById("new-snippet-code");
    if (enabled) {
        area.removeAttribute("disabled", "");
        area.setAttribute("enabled", "");
    } else {
        area.removeAttribute("enabled", "");
        area.setAttribute("disabled", "");
    }
}

function sendNewSnippet() {
	let useSameMethod = document.getElementById("new-snippet-maintain-code")
		.checked;
	let dataToSend = {};

	if (useSameMethod) {
		Object.assign(dataToSend, currentSnippet);
		dataToSend.snippetId = undefined;

		dataToSend.startLine = codeMirror.getCursor("from").line + 1;
		dataToSend.endLine = codeMirror.getCursor("to").line + 1;

		let code = "";

		for (let i = -1; i < dataToSend.endLine - dataToSend.startLine; i++) {
			code = code + codeMirror.getLine(dataToSend.startLine + i) + "\n";
		}

		dataToSend.code = code;
		dataToSend.type = "new-from-method";
	} else {
		dataToSend.code = document.getElementById("new-snippet-code").value;
		dataToSend.type = "new";
	}

	let callback = function(xhr) {
		if (xhr.readyState === 4 && xhr.status === 200) {
			let response = JSON.parse(xhr.response);
			let newSnippetParam =
				"?snippetId=" +
				response.snippetId +
				"&from=" +
				currentSnippet.snippetId;

			$("#new-snippet-modal").modal("hide");
			let newSnippetUrl =
				location.protocol +
				"//" +
				location.host +
				location.pathname +
				newSnippetParam;
			window.location.href = newSnippetUrl;
		} else {
			console.log(xhr); // TODO: error feedback
		}
	}.bind(this);

	httpPostAsync(SERVER_URL + "snippet/new", dataToSend, callback);
}


let patternsByLine = {};

function saveAllPatternPaths() {
    let compatiblePatterns = currentSnippet.compatiblePatterns;
    for (compatiblePattern of compatiblePatterns) {
        let compatibilities = compatiblePattern.compatibilities;
        let pattern = compatiblePattern.pattern;
        let allLines = {};
        for (const compKey of Object.keys(compatibilities)) {
            for (comp of compatibilities[compKey]) {
                comp.fullPath = findCompatiblePatternPath(comp);

                if (comp.fullPath == undefined) {
                    continue;
                }
                
                if (comp.fullPath.startsWith(".")) {
                    comp.fullPath = comp.fullPath.substring(1);
                }
                comp.pattern = pattern;
                if (comp.pattern.snippetLength != 1) {
                    continue;
                }

                if (allLines[comp.lineNo] == undefined) {
                    allLines[comp.lineNo] = [];
                }
                allLines[comp.lineNo].push(comp);
            }

            // check if all the path in a pattern are compatible with a line
            for (lineNo of Object.keys(allLines)) {
                let arr = allLines[lineNo];

                // otherwise skip it
                if (arr.length < Object.keys(compatibilities).length) {
                    continue;
                }

                for (comp of arr) {
                    if (!patternsByLine.hasOwnProperty(comp.lineNo)) {
                        patternsByLine[comp.lineNo] = [];
                    }
                    patternsByLine[comp.lineNo].push(comp);
                    addShowPatternListenerToLineNumber(comp.lineNo);
                }
            }
        }
    }
}

function addShowPatternListenerToLineNumber(lineNo) {
    let line = document.getElementById("line-number-" + lineNo);
    let lineNumber = line.getElementsByClassName("CodeMirror-linenumber")[0];
    lineNumber.style.color = "red";

    lineNumber.addEventListener("mouseup", function (e) {
        if (e.button != 0) { // left click
            return;
        }
        e.stopImmediatePropagation();
        
        $("#line-patterns-modal").modal("show");
        buildPatternModalForLine(lineNo);
    })
}

let currentLinePatterns = undefined; // ugly, but otherwise we can't cancel the event listener
function buildPatternModalForLine(lineNo) {
    let modal = document.getElementById("line-patterns-modal");
    let linePatterns = patternsByLine[lineNo] || [];

    let singleLinePatterns = {};
    let multiLinePatterns = {};

    for (const p of linePatterns) {
        if (p.pattern.snippetLength == 1) {
            if (singleLinePatterns[p.pattern.id] == undefined) {
                singleLinePatterns[p.pattern.id] = [p];
            } else {
                singleLinePatterns[p.pattern.id].push(p);
            }
        }
    }
    
    for (const p of currentSnippet.multiLineCompatibilities) {
        let inInterval = false;
        let newP = JSON.parse(JSON.stringify(p));

        for (const interval of p.intervals) {
            if (interval[0] <= lineNo && interval[1] >= lineNo) {
                inInterval = true;
                newP.realInterval = interval;
            }
        }

        if (!inInterval) {
            continue;
        }

        if (multiLinePatterns[p.pattern.id] == undefined) {
            multiLinePatterns[p.pattern.id] = [newP];
        } else {
            multiLinePatterns[p.pattern.id].push(newP);
        }
    }

    document.getElementById("line-patterns-modal-title").innerHTML = "Patterns for line " + lineNo;

    let select = document.getElementById("line-patterns-modal-select");
    select.innerHTML = "";
    currentLinePatterns = {...singleLinePatterns, ...multiLinePatterns};
    
    for (const patternId of Object.keys(singleLinePatterns)) {
        let firstKey = undefined;
        for (k of singleLinePatterns[patternId]) {
            if (firstKey == undefined) {
                firstKey = k;
                continue;
            }

            if (firstKey.colNo > k.colNo) {
                firstKey = k;
            }
        }

        let newEl = "<option value=" + patternId + ">";
        let astNode = currentSnippet.astData[firstKey.lineNo][firstKey.colNo];
        newEl = newEl + "Pattern for " + astNode.nodeType;
        newEl = newEl + "</option>";
        if (select.innerHTML == "") {
            // if we are adding the first element, render the preview as well
            setResultAreaText({ target: { value: patternId } }); // simulate change
        }
        select.innerHTML = select.innerHTML + newEl;
    }

    for (const patternId of Object.keys(multiLinePatterns)) {
        let newEl = "<option value=" + patternId + ">";
        
        for (k of multiLinePatterns[patternId]) {
            newEl = newEl + "Pattern for line " + k.realInterval[0] + "-" + k.realInterval[1];
            newEl = newEl + "</option>";
            if (select.innerHTML == "") {
                // if we are adding the first element, render the preview as well
                setResultAreaText({ target: { value: patternId } }); // simulate change
            }
            select.innerHTML = select.innerHTML + newEl;
        }
    }
    
    select.removeEventListener("change", setResultAreaText);
    select.addEventListener("change", setResultAreaText);
}

function setResultAreaText(event, areaId = "line-patterns-modal-text") {
	let patternId = event.target.value;
	let area = document.getElementById(areaId);
	let patternsInLine = currentLinePatterns[patternId];
	let pattern = patternsInLine[0].pattern;

	let resultText = "";
	let replacements = [];

	for (let el of patternsInLine) {
		replacements.push([`${el.word}`, `${el.fullPath}`, el.pattern.id]);
	}

	let resultRequirements = "";

	for (const line of pattern.pattern.split("\n")) {
		if (line.startsWith("!")) {
			resultRequirements = resultRequirements + line + "\n";
			continue;
		}

		let resultLine = line;

		for (let repl of replacements) {
			if (resultLine.includes("<" + repl[0] + ">")) {
				resultLine = replaceGlobal(
					resultLine,
					"<" + repl[0] + ">",
					"<" + repl[1] + ">"
				);
			}
		}

		resultLine = replaceGlobal(resultLine, "<", "<" + pattern.id + ":");
		resultText = resultText + resultLine + "\n";
	}

	document.getElementById(
		"line-patterns-requirements-modal-text"
	).value = resultRequirements.trim();
	area.value = resultText.trim();
}


function replaceGlobal(str, replaceWhat, replaceTo) {
	replaceWhat = replaceWhat.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
	var re = new RegExp(replaceWhat, "g");
	return str.replace(re, replaceTo);
}


function addPatternModalTextToDefinition() {
    let textArea = document.getElementById("pattern-textarea");
    let modalArea = document.getElementById("line-patterns-modal-text");
    insertAtCursor(textArea, modalArea.value);
    if (currentSnippet.reusedPatterns == undefined) {
        currentSnippet.reusedPatterns = [];
    }
    currentSnippet.reusedPatterns.push(document.getElementById("line-patterns-modal-select").value);
}


function areObjectsEquals(obj1, obj2) {
    return JSON.stringify(obj1) == JSON.stringify(obj2)
}


function buildPathFromNodeToNode(node1, node2, path) {
    if (node1 == undefined || node2 == undefined) {
        return undefined
    }

    if (areObjectsEquals(node1, node2)) {
        return path;
    }

    if (typeof node1 !== 'object') {
        return undefined;
    }

    for (const key of Object.keys(node1)) {
        let nextPath = path + "." + key;
        if (Array.isArray(node1)) {
            nextPath = path + "[" + key + "]";
        }

        if (areObjectsEquals(node1[key], node2)) {
            return nextPath;
        }
        
        let next = buildPathFromNodeToNode(node1[key], node2, nextPath);
        if (next != undefined) {
            return next;
        }
    }

    return undefined;
}


function findCompatiblePatternPath(pattern) {
    let astLine = currentSnippet.astData[pattern.lineNo];

    let firstElement = Object.keys(astLine).reduce((key, v) =>
        astLine[v] < astLine[key] ? v : key
    );

    let firstAstEl = astLine[firstElement];

    // let firstAstEl = astLine[0];
    let astCol = astLine[pattern.colNo];

    let fromPatternIds = pattern.word.split(":");
    let finalPart = fromPatternIds.pop();

    let start = "";

    for (id of fromPatternIds) {
        start = start + id + ":";
    }

    let path = buildPathFromNodeToNode(firstAstEl, astCol, "");
    if (path == undefined) {
        return undefined;
    }

    path = path.substring(1);

    let end = path + "." + finalPart;

    while (end != "" && end[0] == ".") {
        end = end.substring(1);
    }

    let fullPath = start + end;
    return fullPath;
}


function highlightLineRange(start, end) {
	let lines = document.getElementsByClassName("single-line-of-code");

	for (l of lines) {
		let lineNumber = l.getAttribute("data-line-number");
		if (lineNumber >= start && lineNumber <= end) {
			l.style.backgroundColor = "yellowgreen";
			l.style.width = "100%";
		}
	}
}

function scrollToLine(lineNo) {
	let lines = document.getElementsByClassName("single-line-of-code");
	for (l of lines) {
		let lineNumber = l.getAttribute("data-line-number");
		if (lineNumber == lineNo) {
			l.scrollIntoView({ behavior: "smooth" });
		}
	}
}

function httpGetAsync(url, callback) {
	var xmlHttp = new XMLHttpRequest();
	xmlHttp.onreadystatechange = function() {
		if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
			callback(xmlHttp.responseText);
	};
	xmlHttp.open("GET", url, true); // true for asynchronous
	xmlHttp.send(null);
}

function httpPostAsync(url, payload, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function() { callback(xhr) };

    function replacer(key, value) {
        if (key == "parentNode") return undefined;
        else if (key == "parentNodeKey") return undefined;
        else return value;
    }

    var data = JSON.stringify(payload, replacer);
    xhr.send(data);
}

function openTab(evt, tabName) {
	// Declare all variables
	var i, tabcontent, tablinks;

	// Get all elements with class="tabcontent" and hide them
	tabcontent = document.getElementsByClassName("tabcontent");
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = "none";
	}

	// Get all elements with class="tablinks" and remove the class "active"
	tablinks = document.getElementsByClassName("tablinks");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" active", "");
	}

	// Show the current tab, and add an "active" class to the button that opened the tab
	document.getElementById(tabName).style.display = "block";
	evt.currentTarget.className += " active";
} 