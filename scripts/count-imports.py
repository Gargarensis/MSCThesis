import os
import ast
import javalang
import utils
import pandas as pd

# SNIPPET_CSV_SEPARATOR = "█"
# invocationsCsv = "./parsed_method_invocations.csv"

# df = pd.read_csv(invocationsCsv, sep=SNIPPET_CSV_SEPARATOR, engine='python', quoting=3)

projectDir = "./clone_fdroid/projects"
javaFiles = utils.traverseDirectory(projectDir, ".java")

result = {}

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
        
        for imp in tree.imports:
            path = imp.path
            if path.startswith("android"):
                if path in result:
                    result[path] = result[path] + 1
                else:
                    result[path] = 1
    except KeyboardInterrupt:
        exit(0)
    except:
        pass


# print(result)

orderedResult = [(v, k) for k, v in result.items()]
orderedResult.sort(reverse=True)
for v, k in orderedResult:
    print(str(k) + ": " + str(v))
