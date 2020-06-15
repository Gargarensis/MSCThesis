import os
import re
from urllib.request import urlopen
from bs4 import BeautifulSoup
import ssl

CSV_SEPARATOR = "█"

ssl._create_default_https_context = ssl._create_unverified_context

androidDocSite = urlopen("https://developer.android.com/reference/packages").read()
soup = BeautifulSoup(androidDocSite, features="html.parser")

class Package:
    def __init__(self, name, description, url):
        self.name = name
        self.description = description
        self.url = url

    def __str__(self):
        return self.name
    
    def __repr__(self):
        return self.name


class JavaEntity:
    def __init__(self, name, description, url, javaType, package):
        self.name = name
        self.description = description
        self.url = url
        self.javaType = javaType
        self.package = package

    def __str__(self):
        return self.name

    def __repr__(self):
        return self.name


packages = []
print("Extracting packages..")

for tr in soup.find_all("tr"):
    for link in tr.find_all("td", class_="jd-linkcol"):
        aTag = link.find("a")
        tagText = aTag.getText()
        if tagText.startswith("android"):
            for desc in tr.find_all("td", class_="jd-descrcol"):
                pTag = desc.find("p")
                if pTag != None:
                    descText = pTag.getText()
                else:
                    descText = ""
                packages.append(Package(tagText, descText, aTag["href"]))


print("Done!\n\nExtracting classes and interfaces:")
totalPackagesDone = 0
classes = []
interfaces = []
# For each package, extract its classes and interfaces
for pkg in packages:
    # print status
    totalPackagesDone = totalPackagesDone + 1
    print("\t(" + str(totalPackagesDone) + "/" +
          str(len(packages)) + ") Parsing " + pkg.name + "..")

    url = "https://developer.android.com" + pkg.url
    pkgPage = urlopen(url).read()
    soupPkg = BeautifulSoup(pkgPage, features="html.parser")

    pkgContent = soupPkg.find("div", id="jd-content")
    firstChildren = pkgContent.find_all(recursive=False)
    
    # Extract the nodes that contains classes and interfaces, sadly they have no defined class or id
    nextIsClasses = False
    nextIsInterfaces = False
    interfacesNode = None
    classesNode = None
    for i in range(0, len(firstChildren)):
        if nextIsClasses:
            classesNode = firstChildren[i]
            nextIsClasses = False
        if nextIsInterfaces:
            interfacesNode = firstChildren[i]
            nextIsInterfaces = False
        if firstChildren[i].name == "h2":
            if firstChildren[i].get_text() == "Classes":
                nextIsClasses = True
            if firstChildren[i].get_text() == "Interfaces":
                nextIsInterfaces = True
    

    # Extract rows and the data we need
    def extractEntities(node, container, javaType):
        if node != None:
            for tr in node.find_all("tr"):
                for link in tr.find_all("td", class_="jd-linkcol"):
                    aTag = link.find("a")
                    tagText = aTag.getText()
                    for desc in tr.find_all("td", class_="jd-descrcol"):
                        pTag = desc.find("p")
                        if pTag != None:
                            descText = pTag.getText()
                        else:
                            descText = ""
                        container.append(JavaEntity(tagText, descText, aTag["href"], javaType, pkg.name))

    # Extract classes and interfaces
    extractEntities(interfacesNode, interfaces, "Interface")
    extractEntities(classesNode, classes, "Class")


print("Done!\n\nExtracting methods:")
# For each class and interface, extract its methods
allEntities = classes + interfaces
totalEntitiesDone = 0
with open("./api_methods.csv", 'w+', encoding="utf8") as csv_file:
    csv_file.write("methodName" + CSV_SEPARATOR + "package" + CSV_SEPARATOR + 
        "qualifiers" + CSV_SEPARATOR + "parameters" + CSV_SEPARATOR +
        "description" + CSV_SEPARATOR + "containerName" + CSV_SEPARATOR +
        "containerType\n")
    csv_file.flush()
    for entity in allEntities:
        # print status
        totalEntitiesDone = totalEntitiesDone + 1
        print("\t(" + str(totalEntitiesDone) + "/" +
            str(len(allEntities)) + ") Parsing " + entity.name + "..")

        url = "https://developer.android.com" + entity.url
        entityPage = urlopen(url).read()
        soupEntity = BeautifulSoup(entityPage, features="html.parser")

        # Extract the table containing all the public methods
        methodsTable = soupEntity.find("table", id="pubmethods")
        
        if methodsTable == None:
            continue

        def cleanCodeTagFromExcessiveWhitespaces(codeTag):
            return " ".join([s for s in re.split('\s+', codeTag.get_text()) if s != ""])

        for tr in methodsTable.find_all("tr"):
            codeTags = tr.find_all("code")
            if len(codeTags) == 0:
                continue

            qualifiers = cleanCodeTagFromExcessiveWhitespaces(codeTags[0])
            methodNameAndParameters=cleanCodeTagFromExcessiveWhitespaces(codeTags[1]) 

            description = tr.find("p")
            if description != None:
                description = description.get_text().strip().replace("\n", "")

            # methodSignature = qualifiers + " " + methodNameAndParameters
            methodName = methodNameAndParameters.split("(")[0]
            parametersSearch = re.search("\((.*)\)", methodNameAndParameters, re.IGNORECASE)
            parameters = []
            if parametersSearch != None:
                parameters = parametersSearch.group(1)

            csv_file.write(methodName + CSV_SEPARATOR + entity.package + CSV_SEPARATOR +
                           qualifiers + CSV_SEPARATOR + str(parameters) + CSV_SEPARATOR +
                           str(description) + CSV_SEPARATOR + entity.name + CSV_SEPARATOR +
                           entity.javaType + "\n")
            csv_file.flush()
