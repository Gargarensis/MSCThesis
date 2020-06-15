import os
import re
import pandas as pd
import csv
import networkx as nx
from time import gmtime, strftime
from sklearn import metrics

csv.field_size_limit(1000000000) # otherwise we can't read long snippets

graphCsv = "./graph.csv"
snippetsCsv = "./snippets.csv"
centroidList = "./centroid-list.txt"

SNIPPET_CSV_SEPARATOR = "█"
SIMILARITY_THRESHOLD = 0.9
CLUSTER_FOLDER = "./clusters"

print(strftime("%Y-%m-%d %H:%M:%S", gmtime()) + "  -  Initialization..")

snippetsDf = pd.read_csv(snippetsCsv, sep=SNIPPET_CSV_SEPARATOR, engine='python', quoting=3)
graphDf = pd.read_csv(graphCsv, names=['node1', 'node2', 'similarity'])

# print(snippetsDf)
# print(graphDf)
print(strftime("%Y-%m-%d %H:%M:%S", gmtime()) + "  -  Building the graph..")

G = nx.Graph()

numberOfEdgesDict = {}

for uniqueId in graphDf.node1.unique():
    G.add_node(uniqueId)
    for index, row in graphDf.loc[graphDf['node1'] == uniqueId].iterrows():
        if row.similarity < SIMILARITY_THRESHOLD:
            continue

        if not row.node1 in numberOfEdgesDict:
            numberOfEdgesDict[row.node1] = 0
        
        numberOfEdgesDict[row.node1] = numberOfEdgesDict[row.node1] + 1

        G.add_edge(row.node1, row.node2)
        G[row.node1][row.node2]['weight'] = row.similarity

print(strftime("%Y-%m-%d %H:%M:%S", gmtime()) + "  -  Finding connected components..")

components = nx.connected_components(G)

centroids = []
connectedComponentsDict = {}

for nodes in components:
    temp = []
    centroid = [None, 0]
    for node in nodes:
        nodeEdges = 0
        if node in numberOfEdgesDict:
            nodeEdges = numberOfEdgesDict[node]

        if centroid[1] < nodeEdges:
            centroid = [node, nodeEdges]
        temp.append(node)

    centroids.append(centroid[0])
    connectedComponentsDict[centroid[0]] = temp

print(strftime("%Y-%m-%d %H:%M:%S", gmtime()) + "  -  Saving the clusters..")

if not os.path.exists(CLUSTER_FOLDER):
    os.makedirs(CLUSTER_FOLDER)

for key, value in connectedComponentsDict.items():
    centroidFolder = CLUSTER_FOLDER + "/" + str(key)
    if not os.path.exists(centroidFolder):
        os.makedirs(centroidFolder)

    for node in value:
        f = open(centroidFolder + "/" + str(node) + ".txt", "w+")
        f.write(snippetsDf.loc[snippetsDf['snippetId'] == node].iloc[0].code)
        f.close()


f = open(centroidList, "w+")
f.write(centroidList.join("\n"))
f.close()

print(strftime("%Y-%m-%d %H:%M:%S", gmtime()) + "  -  Creating adjacency matrix..")


labels = []
values = []
samples = []


# singletonLabelCounter = -1


for key, value in connectedComponentsDict.items():
    for v in value:
        if not v in values:
            # values.append(v)
            if key == None:
                G.remove_node(v)
                # labels.append(singletonLabelCounter)
                # singletonLabelCounter = singletonLabelCounter - 1
            else:
                values.append(v)
                labels.append(key)

matrix = nx.to_numpy_matrix(G, nodelist=values, weight="weight")

print(strftime("%Y-%m-%d %H:%M:%S", gmtime()) + "  -  Computing silhouette..")

silhouette = metrics.silhouette_score(matrix, labels, metric='precomputed')

print("Silhouette score: ")
print(silhouette)
print("\n")

print(strftime("%Y-%m-%d %H:%M:%S", gmtime()) + "  -  Finished!")
