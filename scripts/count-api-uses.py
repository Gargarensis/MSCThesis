import pathlib
import os
import ast
import javalang
import utils
import csv
import pandas as pd


csv.field_size_limit(1000000000)  # otherwise we can't read long snippets

SNIPPET_CSV_SEPARATOR = "█"
invocationsCsv = "./parsed_method_invocations.csv"
snippetsCsv = "./snippets.csv"
absPath = os.path.abspath(os.path.dirname(__file__)) # relative path was not working with listdir
clustersFolder = absPath + "/clusters" 


invDf = pd.read_csv(invocationsCsv, sep=SNIPPET_CSV_SEPARATOR, engine='python', quoting=3)
sniDf = pd.read_csv(snippetsCsv, sep=SNIPPET_CSV_SEPARATOR, engine='python', quoting=3)

centroids = [int(float(name)) for name in os.listdir(clustersFolder)
             if os.path.isdir(clustersFolder + "/" + name) and name != "None"]

sniDf = sniDf[sniDf['snippetId'].isin(centroids)] # we only want centroids

apiData = {}

for index, row in sniDf.iterrows():
    startLine = row["startLine"]
    endLine = startLine + len(row["code"].split("\\n"))
    methodId = row["methodId"]
    invokedApis = invDf.loc[(invDf["methodId"] == methodId) & (invDf["lineNo"] >= startLine) & (invDf["lineNo"] <= endLine)]
    
    thisCentroidInvocations = []

    if (len(invokedApis) > 0):
        for i2, r2 in invokedApis.iterrows():
            qualName = r2["package"] + "." + r2["class"]
            if (qualName in apiData):
                if not qualName in thisCentroidInvocations:
                    apiData[qualName] = apiData[qualName] + 1
            else:
                apiData[qualName] = 1

            thisCentroidInvocations.append(qualName)


orderedResult = [(v, k) for k, v in apiData.items()]
orderedResult.sort(reverse=True)
for v, k in orderedResult:
    print(str(k) + ": " + str(v))
