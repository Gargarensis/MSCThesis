import os
import ast
import javalang
import jsonpickle
import sys

# run as python3 parser.py $'convertView.findViewById(R.id.project_name);\nint hello = 0;'
try:
    firstPart = """public class test { 
    public static void main(String[] args) { 
        """
    secondPart = """
    }
}       
"""
    content = firstPart + sys.argv[1] + secondPart
    tree = javalang.parse.parse(content);
    print(jsonpickle.encode(tree, unpicklable=False))
except:
    print({})

