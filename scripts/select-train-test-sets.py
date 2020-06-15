import pathlib
import os
import ast
import javalang
import utils
import csv
import pandas as pd
import json
import random


csv.field_size_limit(1000000000)  # otherwise we can't read long snippets

SNIPPET_CSV_SEPARATOR = "█"
invocationsCsv = "./parsed_method_invocations.csv"
snippetsCsv = "./snippets.csv"
# relative path was not working with listdir
absPath = os.path.abspath(os.path.dirname(__file__))
clustersFolder = absPath + "/clusters"


invDf = pd.read_csv(invocationsCsv, sep=SNIPPET_CSV_SEPARATOR,
                    engine="python", quoting=3)
sniDf = pd.read_csv(snippetsCsv, sep=SNIPPET_CSV_SEPARATOR,
                    engine="python", quoting=3)

centroids = [int(float(name)) for name in os.listdir(clustersFolder)
             if os.path.isdir(clustersFolder + "/" + name) and name != "None"]

sniDf = sniDf[sniDf["snippetId"].isin(centroids)]  # we only want centroids

apiData = {}

for index, row in sniDf.iterrows():
    startLine = row["startLine"]
    endLine = startLine + len(row["code"].split("\\n"))
    methodId = row["methodId"]
    invokedApis = invDf.loc[(invDf["methodId"] == methodId) & (
        invDf["lineNo"] >= startLine) & (invDf["lineNo"] <= endLine)]

    thisCentroidInvocations = []

    if (len(invokedApis) > 0):
        for i2, r2 in invokedApis.iterrows():
            qualName = r2["package"] + "." + r2["class"]
            if (qualName in apiData):
                if not qualName in thisCentroidInvocations:
                    apiData[qualName].append(row["snippetId"])
            else:
                apiData[qualName] = [row["snippetId"]]

            thisCentroidInvocations.append(qualName)


trainSet = {}
testSet = {}
for k, v in apiData.items():
    random.shuffle(v)
    train = v[:int(len(v) * .8)]
    test = v[int(len(v) * .8):]
    trainSet[k] = train
    testSet[k] = test

with open('train-set.json', 'w') as fp:
    json.dump(trainSet, fp)

with open('test-set.json', 'w') as fp:
    json.dump(testSet, fp)
