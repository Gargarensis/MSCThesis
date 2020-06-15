## How to define patterns
### The interface
The main interface is divided into 3 main pieces: the code (left), the pattern definition (right) and the option bar (bottom).

Your aim is to submit a pattern (written to the right) of a code snippet (highlighted in the code) and then submit it by pressing the "Submit" button in the bottom bar.
<br>
<br>
#### Code 
In the code part, you can see a complete Java (Android) class extracted by our tool.<br>
You should focus on the part highlighted in green, while using the rest of the class only to check the analyze the context of the highlighted part.

To enhance your pattern definition, you may want to use some details about the code which can vary. <br>
For this reason, you can use AST nodes in your pattern definition.<br>
To do that, simply click anywhere in a line of code (from the snippet, so highlighted in green) and a popup will appear:<br>

<img src="http://foo.inf.usi.ch:3000/webapp/images/popup.png">

To use AST nodes, simply navigate the popup (which contains a JSON-formatted AST) and click to the name of the AST property you want to re-use.

For example, by clicking on <i>nodeType</i> in the image above, you will add the path to that property in the pattern definition area (more on this later).

<br>
Other than showing the code, the code area will also show if existing, pre-defined patterns fits the code snippet.<br>
In this way, it will be possible to re-use them as well.<br>
If a pattern is found within the snippet, the line which contains the pattern will have its line number (on the right) highlighted in red.<br>

<img src="http://foo.inf.usi.ch:3000/webapp/images/patternfound.png"><br>

If multiple lines are covered by a pattern, they will be surrounded by a colored box.<br>


To re-use a pattern, simply click on the red line number and a popup will open:

<img src="http://foo.inf.usi.ch:3000/webapp/images/patternpopup.png"><br>

In the popup, from the top to the bottom, you will see:

 - a list of all the patterns that are found within that line
 - the requirements for that pattern (more on this later)
 - the pattern itself
 - a button to add the pattern in the pattern definition area and one to close the popup

<br>

#### Pattern definition
The pattern definition area is divided in 4 parts:
 - An header, which contains the current snippet id and if the pattern satisfies or not all the requirements (represented with a tick or a cross)
 - A text area where you can write your pattern
 - A preview area, right under the text area, which shows what your pattern will generate when applied to the current snippet
 - 3 different tabs which are able to show details on the Android API methods, single-line and multi-line pattern found in the current snippet

To define a pattern, you have 2 keywords and 1 simple syntax that you should remember.<br>
The 2 keywords are <i>!satisfies</i> and <i>!require</i>.
<br>
##### How to use <i>!satisfies</i>
This keyword is used to signal the system that, in order to re-use your pattern, the snippet should also be able to re-use other patterns chosen by you.<br>
To do that, you use the <i>!satisfies</i> keyword: you add a line in the text area for the pattern definition written as follow:
<br><code>!satisfies 1</code><br>
This line means that the snippet should satisfy the pattern with id 1 in order to re-use your pattern.
You can also specify more than one pattern using a comma:
<br><code>!satisfies 1, 2, 3</code><br>
The id of a pattern can be found in the tabs under the preview area or extracted from the syntax of pattern re-use (we will see this later).
<br>
##### How to use <i>!require</i>
This keyword is used to check particular AST nodes' properties found in the snippet and restrict the reusability of a pattern to snippets that satisfy all the requirements.<br>
In this way we can create more precise patterns and avoid to re-use them wrongly.<br>
For example, if our code snippet is:
<br><code>view.findViewById(R.id.color_view);</code><br>
we may want to define a pattern which describes the behaviour of the <i>findViewById</i> method.<br>
The problem is that, by writing a simple pattern without requirements, then it would be re-usable for every snippet and we definitely do not want that.<br>
So, in order to restrict the re-usability of the pattern to only snippets which contains a method invocation which invokes the <i>findViewById</i> method we can write the requirements:<br>
<code>
!require member == findViewById<br>
!require nodeType == MethodInvocation
</code>
<br>
The general syntax of a <i>!require</i> keyword is:<br>
<code>!require AST-path == String</code>
<br>
You can also specify how many nodes should satisfy that requirements using <code><, ></code>:<br>
<code>!require member == findViewById > 2</code>
<br>
<br>
After writing the requirements, you can check if all of them are satisfied by seeing a tick or a cross just over the pattern definition area.<br>
It is possible that multiple lines satisfy a requirement: in order for it to be satisfied, at least one line must match.<br>
<br>
To retrieve the AST path for a node, you can use the popup shown in the <i>code</i> section.
<br>
<br>
##### Pattern syntax
Now that we know how to write requirements for a pattern, let's see how to write the pattern itself.<br>
This is very easy: since we want a pattern to write a natural language documentation of a piece of code, you can simply write what the code snippet does using natural language.<br>
To make your documentation more precise, you can re-use part of the AST in a similar way to the <i>!require</i> keyword, but, while defining the pattern, you need to put the AST path between <code><</code> and <code>></code>.<br>
For example: <code>Invoke the method \<member\></code>.<br>
<br>
While you edit the pattern, you will see the preview area showing your changes, in the example before, it will show: <code>Invoke the method findViewById (120)</code> where 120 is the line of code that matches your path.<br>
It is possible that more than one line of code matches your AST path, if that is the case, you can reach the correct node by clicking on the preview matched item until you reach the desired node. <br>

The basic syntax to use AST nodes in your pattern is then: <code>\<AST path\></code>. <br>
A more complex syntax will be show later.
<br><br>
When you attempt to re-use an already existing pattern in the way shown in the <i>Code</i> section (clicking on a red line number, choosing the pattern and add it to the cursor), you will notice some numbers before the AST path (i.e. <code>\<1:member\></code>).<br>
That number refers to the re-used pattern id and you should never modify such AST paths. <br>
You are, however, free to delete them and to modify the natural language text.<br>
Just keep in mind that, if you delete all the AST paths that refers to an already existing pattern, you are not re-using that pattern anymore.<br>
When you re-use a pattern in this way, you don't have to re-write all the requirements for that pattern: they are automatically inherited from the re-used pattern.


<br>

##### Advanced syntax
When you write an AST path, both as a requirement or as a documentation helper, you can use the following keywords to augment the basic syntax and achieve a more complex result:
 - <b>?</b> : if, in an AST path, you type a question mark instead of a node, it will match any single node that are in that position.<br>
 For example, if you type <code>expression.?.member</code>, this path will match to every child of <code>expression</code> that have a child with the <code>member</code> property (i.e. <code>expression.expressionl.member</code>).
 - <b>+</b> : similar to the question mark, a plus will attempt to match any number of node until we reach a node which has the next property (if any). <br>
 So, <code>expression.\+.member</code> will match, for example, <code>expression.expressionl.member</code>, but it will also match <code>expression.expressionl.expression.expressionl.member</code>.<br>
 It is important, however, to not use the plus and the question mark as the last node in the AST path: we would have a lot of matches that won't tell us anything about the code we are documenting.
 - <b>^</b> : the last keyword, mostly used to interact with getters and setters. <br>
 This keyword needs to be added <i>at the end</i> of an AST path and works with string results.<br>
 This keyword is used to remove the first part of the matched result and to restrict the result to only strings that starts with a given string.<br>
 An example will clarify it better: suppose we have <code>expression.member</code> that matches with <i>findViewById</i>, <i>getText</i>, <i>setText</i>. <br>
 If we want to match only the getter, we can use the <b>^</b> keyword: <code>expression.member^get</code>. <br>
 This AST path will match only <i>getText</i> and it will return <i>text</i> as result, instead of <i>getText</i>. <br>


#### Bottom bar
The bottom bar is more intuitive: it has 3 buttons and one checkbox.<br>
From right to left:
- Submit button: send the defined pattern to the server. <br>
It won't redirect you to another snippet, since you might want to still interact to the current snippet after submitting.
- Skip button: it let you skip the current snippet and move to another one.<br>
After you submit a pattern, the text of this button becomes "Next", but its functionality is the same.
- Interruptions checkbox: if you were interrupted or distracted by something while defining a pattern, check this box.
- New snippet button (bottom left): this one is more tricky, we will talk about it in the next paragraph.

##### New snippet
It can happen that, while you write your patterns, you see some code that can really use a pattern for itself, but that it is not already defined.<br>
By selecting that code, you can then click on the New Snippet button and generate a new snippet for that code.<br>
The opened popup will allow you to choose between 2 types of new snippets:
- Keep the current method: it will allow you to generate a new snippet from the selected lines while keeping the same method. <br>
So the new snippet will be in the same file as the current one, but it will cover different lines.
- Create a new wrapper code: you should do this only for in-line code, that does not cover the whole line. <br>
While choosing this option, you are able to modify the selected code. <br>
You should only make minor adjustments to make your code <b>compilable</b> by Java (usually, you will need to adjust some parantheses or add a <b>;</b>). <br>
Your code will be wrapped in a clean Java class, inside its <i>Main</i> method and saved as a snippet.<br>

After choosing one of the two options, you will be redirected to your new snippet. <br>
You can always return to the previous one by clicking on the link that will appear on the top of the page, near the Snippet id. <br>


#### Pattern tips
- If in doubt, put more requirements than less!<br>
This will make a pattern less re-usable, but we will be sure that it will be re-used in the correct place.
- Single-line patterns will always be matched to single lines
- If you can re-use a sub-pattern, do it. It will make the pattern more specific.
