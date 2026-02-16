
> *What I cannot create, I do not understand — Richard Feynman.*

### LOGIC Mind | Logical Mind map generator & editor
***1. Vision & Inquiry***
**Logic is often fragmented, but cognitive processing should be seamless.** LOGIC Mind was conceived to transforming thoughts and designing into visualized graphs.
It merges generative AI and a webpage based graph editor, in order to help with:

Brainstorming abstract ideas
Reconsider an issue with more rational perspective
Visualize interconnections between events

***2. Deployment Notes&Tech stack***
### 1. Prerequisites
Node.js (v16+)

Python (3.8+)

OpenAI API Key

### Files
**App.jsx** Main designing for the website.


**my_logic_ai.py**	Backend server, connects to AI model and get feedback.


**history/**	Example of it is the Logic_XXXXX(numbers).json, it is the folder where the document you saved goes.


**data.json**	It is the initial file from AI, you can save it by hitting the save button, and it converts to the history file



### 2. Key Dependencies (Automatically installed)
The project uses several powerful libraries. You don't need to install them manually one by one; just follow the installation steps below:

* **Cytoscape.js**: The core engine for drawing the logic graphs.


* **Flask-CORS**: To let the Frontend talk to the Backend.


* **OpenAI SDK**: To connect with GPT-4o.


### 3. Setup & Installation
Step 1: Backend
Install Python libraries:

Bash
pip install flask flask-cors openai

Setup API Key:
Replace your API Key in the python file

Run Server:

Bash
python my_logic_ai.py

Step 2: Frontend
Install Node packages:

Bash
npm install
Start App:

Bash
npm run dev

### 4. How to Use (In the Webpage)
Enter your text: Type any complex idea or problem in the input box.

Generate: Click the button. The AI will analyze the logic and draw a graph.

Edit: You can move nodes or right-click to create new connections manually.

Save: Hit "Save" to move your current logic from data.json to the history/ folder.
