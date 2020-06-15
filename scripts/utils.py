import os
import ast
import javalang
import re
import jsonpickle

# Escape a string to make it suitable for a CSV file
def escapeString(strng, separator = None):
    result = strng
    result = result.replace("\n", "\\n")
    result = result.replace("\t", "\\t")
    result = result.replace("\r", "\\r")
    if separator != None:
        result = result.replace(separator, "\\" + separator)
    return result

# Remove the CSV string escaping
def removeStringEscapes(strng, separator=None):
    result = strng
    result = result.replace("\\n", "\n")
    result = result.replace("\\t", "\t")
    result = result.replace("\\r", "\r")
    if separator != None:
        result = result.replace("\\" + separator, separator)
    return result

# Traverse a directory and return a list with all the files with the given extension
def traverseDirectory(path, ext):
    result = []
    for root, dirs, files in os.walk(path):
        for file in files:
            if file.endswith(ext):
                 result.append(os.path.join(root, file))
    return result


# process the body of the method
# it removes leading indentation to fix indentation when taken out of context
def getProcessedBody(body):
    result = ""

    if body == None or not isinstance(body, str):
        return result

    result = body
    lines = result.split("\n")
    lines = [l for l in lines if l != None]

    if (len(lines) == 0):
        return result

    cleanLines = []
    extraIndentation = 0

    # remove extra leading indentation that may come from the class
    for l in lines:
        if (len(l) == 0 or l.isspace()):
            continue

        extraIndentation = len(l) - len(l.lstrip())
        break

    for l in lines:
        if l[:extraIndentation].isspace():
            cleanLines.append(l[extraIndentation:])
        else:
            # if this happen, the code has a bad indentation and we just remove what we can
            # the bad indentation will be preserved in the snippet as well, sadly
            cleanLines.append(l.lstrip())

    result = "\n".join(cleanLines)

    return result

# given a piece of code and the starting line from it, it extracts the next block found
# it return a tuple containing:
# - the method header (everything from startLine to first open bracket {)
# - the method body (everything from the first bracket { to the corresponding closed bracket })
def extractBlockBodyAndHeader(fileContent, startLine):
    contentFromStatement = '\n'.join(fileContent.split('\n')[startLine:])
    statementBody = ""
    statementHeader = ""

    isExtractionFinished = False
    if (len(contentFromStatement) != 0):
        bracketLevel = 0
        firstBracketFound = False
        insideAString = False

        for i in range(len(contentFromStatement)):
            currChar = contentFromStatement[i]

            if bracketLevel != 0 and (currChar != "}" or insideAString):
                statementBody = statementBody + currChar

            if not firstBracketFound and (currChar != "{" or insideAString):
                statementHeader = statementHeader + currChar

            if currChar == "\"" and not (not insideAString and
                                         contentFromStatement[i - 1] == "'" and contentFromStatement[i + 1] == "'"):
                countEscape = 0
                prevChar = i - 1
                while prevChar >= 0:
                    if contentFromStatement[prevChar] == "\\":
                        countEscape = countEscape + 1
                        prevChar = prevChar - 1
                    else:
                        break

                if countEscape % 2 == 0:
                    insideAString = not insideAString

            if currChar == "{" and not insideAString:
                bracketLevel = bracketLevel + 1
                firstBracketFound = True
            if currChar == "}" and not insideAString and firstBracketFound:
                bracketLevel = bracketLevel - 1
                if bracketLevel != 0:
                    statementBody = statementBody + currChar

            if bracketLevel == 0 and firstBracketFound == True:
                isExtractionFinished = True
                break
    else:
        isExtractionFinished = True

    if not isExtractionFinished:
        return None

    return (statementHeader, statementBody)


# Return a snippet given the full method body and the first line where the snippet starts
# The returned snippet is everything from the given line until the first block encountered is finished
def getBlockSnippetFromFirstLine(methodBody, firstLineNo):
    extractionResult = extractBlockBodyAndHeader(methodBody, firstLineNo)

    if extractionResult == None or firstLineNo == None or firstLineNo < 0:
        return None

    blockHeader = extractionResult[0]
    blockBody = extractionResult[1]
    lastLineNo = firstLineNo + len(blockBody.split("\n"))
    finalSnippet = getProcessedBody(blockHeader + "{" + blockBody) + "}"

    return finalSnippet

# Given the body of the method, a line and an optional keyword, it returns the line at which 
# the block containing the given line starts
# if no keyword is given, the block must start with a '{'
# if keyword is given, the block must start with the given keyword
def getFirstBlockLineFromStartingLine(methodBody, startingLine, keyword=None):
    useKeyword = True
    methodLines = methodBody.split("\n")
    currentLine = startingLine
    if keyword == None or keyword == "":
        useKeyword = False

    while (useKeyword and not keyword in methodLines[currentLine]) or (
            not useKeyword and not "{" in methodLines[currentLine]):
        currentLine = currentLine - 1
        if currentLine < 0:
            return None

    return currentLine
