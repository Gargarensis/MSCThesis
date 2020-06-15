import os
import csv
import pandas as pd
import json
import random


csv.field_size_limit(1000000000)  # otherwise we can't read long snippets

SNIPPET_CSV_SEPARATOR = "█"
snippetsCsv = "../webserver/snippets_data/snippets.csv"
methodsCsv = "../webserver/snippets_data/parsed_methods.csv"
definedJson = "../webserver/snippets_data/defined_patterns.json"
trainSetJson = "../webserver/snippets_data/train-set.json"
customSnippetsCsv = "../webserver/snippets_data/custom_snippets.csv"

snippetsDf = pd.read_csv(snippetsCsv, sep=SNIPPET_CSV_SEPARATOR, engine="python", quoting=3)
customSnippetsDf = pd.read_csv(customSnippetsCsv, sep=SNIPPET_CSV_SEPARATOR, engine="python", quoting=3)
methodsDf = pd.read_csv(methodsCsv, sep=SNIPPET_CSV_SEPARATOR, engine="python", quoting=3)

f = open(definedJson, "r")
jsonText = f.read();
definedPatterns = json.loads(jsonText)

f = open(trainSetJson, "r")
jsonText = f.read()
trainSetSnippets = json.loads(jsonText)

coveredSnippetsId = []


resultPatternsNumber = len(definedPatterns)


for pattern in definedPatterns:
    coveredSnippetsId.append(pattern["snippetId"])

coveredSnippetsId = list(set(coveredSnippetsId))

coveredMethods = []
coveredFiles = []

for sid in coveredSnippetsId:
    snippet = snippetsDf.loc[(snippetsDf["snippetId"] == sid)]

    # if none is found, it is a custom snippet
    if snippet.shape[0] == 0:
        snippet = customSnippetsDf.loc[(customSnippetsDf["snippetId"] == sid)]

    if snippet.shape[0] > 0:
        methodId = snippet["methodId"].iloc[0]

        # custom snippet on wrapper code
        if methodId == -1:
            continue

        coveredMethods.append(methodId)

        method = methodsDf.loc[(methodsDf["id"] == methodId)]
        # should always be true
        if method.shape[0] > 0:
            coveredFiles.append(method["file"].iloc[0])

coveredMethods = list(set(coveredMethods))
coveredFiles = list(set(coveredFiles))

print("Defined patterns: " + str(resultPatternsNumber))
print("Covered methods: " + str(len(coveredMethods)))
print("Covered files: " + str(len(coveredFiles)))
