import os
import csv
import pandas as pd
import json
import random
import pathlib
import utils


csv.field_size_limit(1000000000)  # otherwise we can't read long snippets

CSV_SEPARATOR = "█"
snippetsCsv = "../webserver/snippets_data/snippets.csv"
methodsCsv = "../webserver/snippets_data/parsed_methods.csv"
trainSetJson = "../webserver/snippets_data/train-set.json"
outputFile = "ml-methods.csv"
clustersFolder = "./clusters/"

snippetsDf = pd.read_csv(snippetsCsv, sep=CSV_SEPARATOR, engine="python", quoting=3)
methodsDf = pd.read_csv(methodsCsv, sep=CSV_SEPARATOR, engine="python", quoting=3)

f = open(trainSetJson, "r")
jsonText = f.read()
trainSetSnippets = json.loads(jsonText)

trainSetSnippetIds = []

keys = ["android.graphics.BitmapFactory", "android.view.View"]

for key in keys:
    for snippetId in trainSetSnippets[key]:
        trainSetSnippetIds.append(snippetId)

trainSetSnippetIds = list(set(trainSetSnippetIds))
allSnippetsId = list(trainSetSnippetIds)

for sid in trainSetSnippetIds:
    path = clustersFolder + str(sid)
    if not os.path.exists(path):
        path = path + ".0"
    for name in os.listdir(path):
        if ".txt" in name: 
            name = name[:-4]
        allSnippetsId.append(int(float(name)))

allSnippetsId = list(set(allSnippetsId))

methods = []

for sid in allSnippetsId:
    snippet = snippetsDf.loc[(snippetsDf["snippetId"] == sid)]

    if snippet.shape[0] > 0:
        methodId = snippet["methodId"].iloc[0]

        # custom snippet on wrapper code
        if methodId == -1:
            continue

        method = methodsDf.loc[(methodsDf["id"] == methodId)]
        # should always be true
        if method.shape[0] > 0:
            body = method["body"].iloc[0]
            doc = method["documentation"].iloc[0]

            methods.append([body, doc])


f = open(outputFile, "w")


for method in methods:
    f.write(method[0] + CSV_SEPARATOR + method[1] + "\n")

f.close()
