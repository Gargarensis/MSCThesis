import os
import csv
import pandas as pd
import json
import random
import utils


csv.field_size_limit(1000000000)  # otherwise we can't read long snippets

CSV_SEPARATOR = "█"
snippetsCsv = "../webserver/snippets_data/snippets.csv"
methodsCsv = "../webserver/snippets_data/parsed_methods.csv"
testSetJson = "../webserver/snippets_data/test-set.json"
outputFile = "adana-snippets.csv"

snippetsDf = pd.read_csv(snippetsCsv, sep=CSV_SEPARATOR, engine="python", quoting=3)
methodsDf = pd.read_csv(methodsCsv, sep=CSV_SEPARATOR, engine="python", quoting=3)

f = open(testSetJson, "r")
jsonText = f.read()
testSetSnippets = json.loads(jsonText)

testSetSnippetIds = []

keys = ["android.graphics.BitmapFactory", "android.view.View"]

for key in keys:
    for snippetId in testSetSnippets[key]:
        testSetSnippetIds.append(snippetId)

testSetSnippetIds = list(set(testSetSnippetIds))

snippets = []

for sid in testSetSnippetIds:
    snippet = snippetsDf.loc[(snippetsDf["snippetId"] == sid)]

    if snippet.shape[0] > 0:
        code = snippet["code"].iloc[0]
        snippets.append([str(sid), code])


f = open(outputFile, "w")

for snippet in snippets:
    f.write(snippet[0] + CSV_SEPARATOR + snippet[1] + "\n")

f.close()
