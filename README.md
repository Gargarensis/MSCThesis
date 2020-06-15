# POET (Pattern-based dOcumentation gEneraTion)
Pattern-based generation of software documentation for Android apps.

Quick start with the Replication Package:
- Clone the repository
- Install Node.js and Python
- Extract the files "webserver/snippets_data*.zip" in the same folder to reuse our snippets and defined patterns
- Go back to the main folder and run `npm install` to install the Node dependencies
- Run `pip install ast javalang jsonpickle` to install the Python dependencies
- Run `npm run start` to start the server
- Wait for the loading until the message "Data storage ready!" appears, it should take around 15 minutes.
- Navigate to http://localhost:3000/webapp/index.html

If you do not want to reuse our patterns and snippets, do not extract the files "webserver/snippets_data*.zip", but, instead run the preprocessing pipeline as described in the PDF file "POET.pdf".
If you wish to reuse our snippets, but not our patterns, extract the files normally and then delete the file "webserver/snippets_data/defined_patterns.json".