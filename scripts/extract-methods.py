import os
import ast
import javalang
import re
import jsonpickle
import utils
import pandas as pd
import time

projectDir = "./clone_fdroid/projects"
CSV_SEPARATOR = "█"

javaFiles = utils.traverseDirectory(projectDir, ".java")

parsedMethodHeaders = ['modifiers', 'documentation', 'name']

CSV_METHOD_INVOCATIONS = "./parsed_method_invocations.csv"
CSV_SNIPPETS = "./snippets.csv"
CSV_PARSED_METHODS = "./parsed_methods.csv"
CSV_API_METHOD = "./api_methods.csv"

# Read the Android API methods
apiDf = pd.read_csv(CSV_API_METHOD, sep=CSV_SEPARATOR, doublequote=False, engine="python")
apiDf['parameters'] = apiDf.parameters.fillna('')
apiDf['description'] = apiDf.description.fillna('')

# initialize csv headers
with open(CSV_METHOD_INVOCATIONS, 'w+', encoding="utf8") as invocation_csv_file:
    invocation_csv_file.write("methodId" + CSV_SEPARATOR + "invokedMethod" + CSV_SEPARATOR + 
                              "lineNo" + CSV_SEPARATOR + "colNo" + CSV_SEPARATOR +
                              "package" + CSV_SEPARATOR + "class" + CSV_SEPARATOR +
                              "description\n")
    invocation_csv_file.flush()
with open(CSV_SNIPPETS, 'w+', encoding="utf8") as snippets_csv_file:
    snippets_csv_file.write("snippetId" + CSV_SEPARATOR + "code" + CSV_SEPARATOR + 
                            "type" + CSV_SEPARATOR + "startLine" + CSV_SEPARATOR + "methodId\n")
    snippets_csv_file.flush()

snippetId = 1
SNIPPET_TYPE_FULL_BODY = "full"
SNIPPET_TYPE_EMPTY_LINE = "empty"
SNIPPET_TYPE_EMPTY_LINE_INSIDE_BLOCK = "empty-block"
SNIPPET_TYPE_BLOCK = "block"

# create a snippet with an id, the code and the type
def createSnippet(code, snippetType, startLine, methodId):
    global snippetId

    if code == None:
        return None

    result = [snippetId, utils.escapeString(code, CSV_SEPARATOR), snippetType, startLine, methodId]

    snippetId = snippetId + 1
    return result

# generates all the possible snippets for a given the Java file content
def extractMethodSnippets(node, methodId, methodBody):
    methodLine = node._position.line
    result = []

    # full body snippet
    result.append(createSnippet(methodBody, SNIPPET_TYPE_FULL_BODY, methodLine, methodId))

    # split by new empty lines
    splitOnEmptyLines = re.split("\n\s*\n", methodBody)
    startLine = methodLine
    if len(splitOnEmptyLines) > 1:
        for l in splitOnEmptyLines:
            if not l.isspace():
                result.append(createSnippet(l, SNIPPET_TYPE_EMPTY_LINE, startLine, methodId))
            startLine = startLine + len(l.split("\n")) + 1

    # Try/Finally
    for path, stmt in node.filter(javalang.tree.TryStatement):
        firstLineNo = stmt._position.line - methodLine
        trySnippet = utils.getBlockSnippetFromFirstLine(methodBody, firstLineNo)
        result.append(createSnippet(trySnippet, SNIPPET_TYPE_BLOCK, stmt._position.line, methodId))
        
        # if there is a finally block, extract it as well
        if stmt.finally_block != None:
            firstStatementLineNo = stmt.finally_block[0]._position.line - methodLine - 1
            firstFinallyLineNo = utils.getFirstBlockLineFromStartingLine(methodBody, firstStatementLineNo, "finally")
            firstFinallyLineNoInFile = firstFinallyLineNo + methodLine
            finallySnippet = utils.getBlockSnippetFromFirstLine(methodBody, firstFinallyLineNo)
            result.append(createSnippet(finallySnippet, SNIPPET_TYPE_BLOCK, firstFinallyLineNoInFile, methodId))

    # Catch
    for path, stmt in node.filter(javalang.tree.CatchClause):
        if len(stmt.block) == 0:
            continue
        firstStatementLineNo = stmt.block[0]._position.line - methodLine - 1 # CatchClause do not have _position
        firstLineNo = utils.getFirstBlockLineFromStartingLine(methodBody, firstStatementLineNo, "catch")
        if firstLineNo == None:
            continue
        firstLineNoInFile = firstLineNo + methodLine
        catchSnippet = utils.getBlockSnippetFromFirstLine(methodBody, firstLineNo)
        result.append(createSnippet(catchSnippet, SNIPPET_TYPE_BLOCK, firstLineNoInFile, methodId))
        
    # Do
    for path, stmt in node.filter(javalang.tree.DoStatement):
        firstLineNo = stmt._position.line - methodLine
        doSnippet = utils.getBlockSnippetFromFirstLine(methodBody, firstLineNo)
        lastLineNo = firstLineNo + len(doSnippet.split("\n"))
        bodyLines = methodBody.split("\n")
        lastLine = bodyLines[lastLineNo - 1]

        foundEnd = False
        while ";" not in lastLine:
            lastLineNo = lastLineNo + 1
            if lastLineNo >= len(bodyLines):
                break
            lastLine = bodyLines[lastLineNo - 1]
            foundEnd = True

        if not foundEnd:
            continue

        # need to add the full last line because otherwise we do not save the condition
        doSnippetWithCondition = utils.getProcessedBody("\n".join(methodBody.split("\n")[firstLineNo:lastLineNo]))
        result.append(createSnippet(doSnippetWithCondition, SNIPPET_TYPE_BLOCK, stmt._position.line, methodId))

    # While
    for path, stmt in node.filter(javalang.tree.WhileStatement):
        firstLineNo = stmt._position.line - methodLine
        whileSnippet = utils.getBlockSnippetFromFirstLine(methodBody, firstLineNo)
        result.append(createSnippet(whileSnippet, SNIPPET_TYPE_BLOCK, stmt._position.line, methodId))

    # For
    for path, stmt in node.filter(javalang.tree.ForStatement):
        firstLineNo = stmt._position.line - methodLine
        forSnippet = utils.getBlockSnippetFromFirstLine(methodBody, firstLineNo)
        result.append(createSnippet(forSnippet, SNIPPET_TYPE_BLOCK, stmt._position.line, methodId))

    # Synchronized
    for path, stmt in node.filter(javalang.tree.SynchronizedStatement):
        firstLineNo = stmt._position.line - methodLine
        syncSnippet = utils.getBlockSnippetFromFirstLine(methodBody, firstLineNo)
        result.append(createSnippet(syncSnippet, SNIPPET_TYPE_BLOCK, stmt._position.line, methodId))

    # If and Else If
    for path, stmt in node.filter(javalang.tree.IfStatement):
        # add check on 1 line long if
        firstLineNo = stmt._position.line - methodLine
        ifSnippet = None
        if isinstance(stmt.then_statement, javalang.tree.BlockStatement):
            ifSnippet = utils.getBlockSnippetFromFirstLine(methodBody, firstLineNo)
        else:
            ifSnippet = utils.getProcessedBody(methodBody[firstLineNo:firstLineNo + 1])
        
        result.append(createSnippet(ifSnippet, SNIPPET_TYPE_BLOCK, stmt._position.line, methodId))

        # Else
        if stmt.else_statement != None and not isinstance(stmt.else_statement, javalang.tree.IfStatement):
            firstStatementLineNo = None
            if isinstance(stmt.else_statement, javalang.tree.BlockStatement):
                # it can happen that an else block is empty
                if len(stmt.else_statement.statements) == 0:
                    continue
                firstStatementLineNo = stmt.else_statement.statements[0]._position.line - methodLine - 1
            else:
                firstStatementLineNo = stmt.else_statement._position.line - methodLine - 1

            firstElseLineNo = utils.getFirstBlockLineFromStartingLine(methodBody, firstStatementLineNo, "else")
            elseSnippet = utils.getBlockSnippetFromFirstLine(methodBody, firstElseLineNo)
            if firstElseLineNo != None:
                firstElseLineNoInFile = firstElseLineNo + methodLine
            else:
                firstElseLineNoInFile = 0
            result.append(createSnippet(elseSnippet, SNIPPET_TYPE_BLOCK, firstElseLineNoInFile, methodId))

    # Switch
    for path, stmt in node.filter(javalang.tree.SwitchStatement):
        firstLineNo = stmt._position.line - methodLine
        switchSnippet = utils.getBlockSnippetFromFirstLine(methodBody, firstLineNo)
        result.append(createSnippet(switchSnippet, SNIPPET_TYPE_BLOCK, stmt._position.line, methodId))

        if switchSnippet == None:
            continue

        casePositions = []
        for case in stmt.cases:
            if len(case.statements) > 0:
                casePositions.append((case.statements[0]._position.line, case.case))

        if len(casePositions) == 0:
            continue

        lastPosition = firstLineNo + len(switchSnippet.split("\n"))
        while len(casePositions) > 0:
            positionTuple = casePositions.pop()
            currentPosition = positionTuple[0] - methodLine
            currentPosition = utils.getFirstBlockLineFromStartingLine(methodBody, currentPosition, "case")

            # this is the number of cases we need to reach since it can happen this:
            # case 1:
            # case 2:
            #   ...
            # and the parser will consider them as a single case
            i = len(positionTuple[1]) - 1
            while i > 0:
                currentPosition = utils.getFirstBlockLineFromStartingLine(methodBody, currentPosition - 1, "case")
                i = i - 1
            
            if currentPosition == None:
                continue

            caseSnippet = "\n".join(methodBody.split("\n")[currentPosition:lastPosition])
            lastPosition = currentPosition
            currentPositionInFile = currentPosition + methodLine
            if "default:" in caseSnippet:
                defaultSplit = caseSnippet.split("default:")
                defaultBlock = "default:" + defaultSplit.pop()
                caseBlock = "default:".join(defaultSplit) # in case of some strings or comments
                defaultPositionInFile = currentPositionInFile + len(caseBlock.split("\n")) - 1
                result.append(createSnippet(utils.getProcessedBody(
                    defaultBlock), SNIPPET_TYPE_BLOCK, defaultPositionInFile, methodId))
                result.append(createSnippet(utils.getProcessedBody(
                    caseBlock), SNIPPET_TYPE_BLOCK, currentPositionInFile, methodId))
            else:
                result.append(createSnippet(utils.getProcessedBody(
                    caseSnippet), SNIPPET_TYPE_BLOCK, currentPositionInFile, methodId))
                  
    # filter Nones
    result = [snippet for snippet in result if snippet is not None]

    # split by empty lines inside the blocks
    emptyLinesSnippets = []
    for snippet in result:              
        splitOnEmptyLines = re.split("\n\s*\n", utils.removeStringEscapes(snippet[1]))
        startLine = methodLine
        if len(splitOnEmptyLines) > 1:
            for l in splitOnEmptyLines:
                if not l.isspace():
                    emptyLinesSnippets.append(createSnippet(
                        l, SNIPPET_TYPE_EMPTY_LINE_INSIDE_BLOCK, startLine, methodId))
                startLine = startLine + len(l.split("\n")) + 1

    # append new snippets to the result
    result = result + emptyLinesSnippets
    with open(CSV_SNIPPETS, 'a+', encoding="utf8") as snippets_csv_file:
        for snippet in result:
            snippets_csv_file.write(str(snippet[0]) + CSV_SEPARATOR + 
            snippet[1] + CSV_SEPARATOR + snippet[2] + CSV_SEPARATOR + str(snippet[3]) +
            CSV_SEPARATOR + str(snippet[4]) + "\n")
        snippets_csv_file.flush()

    return result


def getMethodDetailsFromAPI(invocationNode, fullTree):

    # Extract only API methods with the same name
    invocationDf = apiDf[apiDf['methodName'] == invocationNode.member]
    if len(invocationDf) == 0:
        return None

    # Extract imports
    fileImports = []
    for imp in fullTree.imports:
        if (imp.wildcard == True):
            fileImports.append(imp.path + ".*")
        else:
            fileImports.append(imp.path)

    # check all possible import path to see which methods from the API have been imported
    possibleAPIMethods = []
    for index, row in invocationDf.iterrows():
        fullPath = row.package + "." + row.containerName
        possibleImports = []
        path = fullPath.split(".")
        possibleImports.append(fullPath)
        while len(path) > 1:
            path.pop()
            newPath = ".".join(path) + ".*"
            possibleImports.append(newPath)
        
        for original in fileImports:
            for possible in possibleImports:
                if possible == original:
                    possibleAPIMethods.append(row)

    if len(possibleAPIMethods) == 0:
        return None

    # qualifiers are like android.x.y.z, one can call the method as y.z.Method
    # so we need to check, if there is a qualifier, if it has been imported
    qualifiers = []
    if invocationNode.qualifier != None and invocationNode.qualifier != "":
        if '.' in invocationNode.qualifier:
            # so we generate all the possible paths i.e.:
            # qualifier = y.z -> y, y.*, y.z, y.z.*
            qualPath = invocationNode.qualifier.split(".")
            for i in range(0, len(qualPath)):
                qualToAppend = qualPath[i]
                for j in range(0, i): 
                    qualToAppend = qualPath[j] + "." + qualToAppend
                qualifiers.append(qualToAppend)
        else:
            qualifiers.append(invocationNode.qualifier)

    isQualifierImported = len(qualifiers) == 0
    filteredPossibleAPIMethods = []
    for qual in qualifiers:
        for method in possibleAPIMethods:
            packageCheck = method.package.split(".")
            qualList = qual.split(".")
            if packageCheck[-(len(qualList)):] == qualList: # check if the end qualifiers matches
                isQualifierImported = True
                filteredPossibleAPIMethods.append(method)
            fullQualNameList = (method.package + "." + method.containerName).split(".")
            if fullQualNameList[-(len(qualList)):] == qualList:
                isQualifierImported = True
                filteredPossibleAPIMethods.append(method)

    if not isQualifierImported:
        return None

    # Check if number of parameters is equal
    for method in filteredPossibleAPIMethods:
        parametersNumber = 0
        if method.parameters != None and method.parameters != "":
            parametersNumber = len(method.parameters.split(","))

        if len(invocationNode.arguments) == parametersNumber:
            return method
    
    return None

# Extract all the method invocations from a node and save them to a CSV file
def extractMethodInvocations(node, methodId, fullTree):
    with open(CSV_METHOD_INVOCATIONS, 'a+', encoding="utf8") as invocation_csv_file:
        for path, invocation in node.filter(javalang.tree.MethodInvocation):
            methodDetails = getMethodDetailsFromAPI(invocation, fullTree)
            if methodDetails is None:
                continue    

            invocation_csv_file.write(str(methodId) + CSV_SEPARATOR +
             invocation.member + CSV_SEPARATOR + 
             str(invocation._position.line) + CSV_SEPARATOR + 
             str(invocation._position.column) + CSV_SEPARATOR + 
             methodDetails.package + CSV_SEPARATOR + 
             methodDetails.containerName + CSV_SEPARATOR +
             methodDetails.description + "\n")
        invocation_csv_file.flush()

# Analyze the given method node, extracting snippets and method invocations
# It saves all this data plus data about the method inside CSV files 
methodId = 0
def analyzeMethod(file, node, fileContent, fullTree):
    global methodId
    methodId = methodId + 1
    lineNo = node._position.line
    
    if "abstract" in node.modifiers or node.body == None:
        return []

    extractionResult = utils.extractBlockBodyAndHeader(fileContent, lineNo - 1)
    
    if extractionResult == None:
        print("There was a problem while extracting the method: unexpected end of file.")
        print("File: " + file)
        print("Method: " + node.name)
        print("Start at line number: " + str(lineNo))
        print("Method content:")
        print(content)
        print(node)
        return []

    methodHeader = extractionResult[0]
    methodBody = extractionResult[1]

    extractMethodSnippets(node, methodId, methodBody)
    extractMethodInvocations(node, methodId, fullTree)

    methodData = [methodId]
    for header in parsedMethodHeaders:
        methodData.append(utils.escapeString(str(getattr(node, header)), CSV_SEPARATOR))

    endLineNo = lineNo + len(methodBody.split("\n"))

    methodData.append(utils.escapeString(methodHeader, CSV_SEPARATOR))
    methodData.append(utils.escapeString(methodBody, CSV_SEPARATOR))
    methodData.append(str(lineNo))
    methodData.append(str(node._position.column))
    methodData.append(str(endLineNo))

    # if unpickable = False we can't regenerate the oobject in Python later
    ast = jsonpickle.encode(node, unpicklable=False) 
    methodData.append(ast)
    # originalObject = jsonpickle.decode(ast)

    return methodData


# Main
with open(CSV_PARSED_METHODS, 'w+', encoding="utf8") as csv_file:
    # write header
    csv_file.write("id" + CSV_SEPARATOR + "file" + CSV_SEPARATOR)
    for val in parsedMethodHeaders:
        csv_file.write(val + CSV_SEPARATOR)

    csv_file.write("header" + CSV_SEPARATOR + "body" + CSV_SEPARATOR + 
                   "lineNo" + CSV_SEPARATOR + "colNo" + CSV_SEPARATOR +
                   "endLineNo" + CSV_SEPARATOR + "ast\n")

    for file in javaFiles:
        try:
            content = ""
            with open(file, 'r', encoding="utf8") as content_file:
                content = content_file.read()

            # print("Parsing " + file + "...")

            try:
                tree = javalang.parse.parse(content)
            except:
                print("Unable to parse: " + file)
                continue

            fileMethods = []

            for path, node in tree.filter(javalang.tree.ConstructorDeclaration):
                fileMethods.append(analyzeMethod(file, node, content, tree))

            for path, node in tree.filter(javalang.tree.MethodDeclaration):
                fileMethods.append(analyzeMethod(file, node, content, tree))

            for method in fileMethods:
                if len(method) == 0:
                    continue

                csv_file.write(str(method[0]) + CSV_SEPARATOR + file +
                            CSV_SEPARATOR + CSV_SEPARATOR.join(method[1:]) + "\n")
                csv_file.flush()
        except Exception as e:
            print(e)
            continue
            
