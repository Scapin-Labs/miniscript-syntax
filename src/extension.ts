import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as childproc from 'child_process';

let diagnosticCollection: vscode.DiagnosticCollection;
let codeJson = os.homedir() + "/work/scapin/code.json";
let path = "";
let timeout : NodeJS.Timeout | null = null;

function check(document: vscode.TextDocument) {


	if (document.uri.scheme == "git") {
		return;
	}
	console.log("Checking " + document.fileName + " " + document.uri)
	const cmd = path + "/bin/MiniParser.dll"
	const child = childproc.spawn('dotnet',
		[cmd, '-n', document.fileName, '-c', codeJson, '--stdin' ]) 
	child.stdin.setDefaultEncoding('utf-8');

	let stdout = "";
	let stderr = "";
	child.stdout.on("data", (data) => stdout += data.toString());
	child.stderr.on("data", (data) => stderr += data.toString());
	child.on("error", (e) => {
		console.log(e);
	});
	child.on("close", () => {
		diagnosticCollection.clear();
		console.log(stdout)
		const lines = stdout.split('\n')
		const diagnostics = []
		//let fileName = ""
		for (const line of lines) {
			const parts = line.split(':')
			if (parts.length < 6) {
				break;
			}
			//fileName = parts[0]
			const [lineNo, startCol, endCol] = parts.slice(1,4).map(Number)
			const range = new vscode.Range(lineNo-1, startCol-1, lineNo-1, endCol-1);
			const severity = vscode.DiagnosticSeverity.Warning;
			diagnostics.push(new vscode.Diagnostic(range, parts[5], severity));
		}
		// 	vscode.Uri.parse("file://" + fileName)
		const uri = vscode.Uri.parse(document.fileName)
		diagnosticCollection.set(uri, diagnostics);
	});

	child.stdin.write(document.getText());
	child.stdin.end()
}

export function activate(context: vscode.ExtensionContext) {

	const disposable = vscode.commands.registerCommand('miniscript-syntax.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from miniscript-syntax!');
	});
	context.subscriptions.push(disposable);

	diagnosticCollection = vscode.languages.createDiagnosticCollection('miniscript');
    context.subscriptions.push(diagnosticCollection);

	if (vscode.workspace.workspaceFolders) {
		for (const ws of vscode.workspace.workspaceFolders) {
			console.log(ws.name);
			const code = ws + "/code.json";
			if (fs.existsSync(code)) {
				codeJson = code;
				break;
			}
		}
	}	

	if (codeJson) {
		const obj = JSON.parse(fs.readFileSync(codeJson, 'utf8'));

		const hover = vscode.languages.registerHoverProvider(
			'miniscript', { 
			provideHover(document, position) {

				const range = document.getWordRangeAtPosition(position);
				const word = document.getText(range);

				const fn = obj['functions'][word]

				if (fn != null) {
					const doc : string = fn['doc'] ?? "Undocumented"
					const proto = fn['proto']
					return new vscode.Hover(`#### ${proto}\n${doc}`);
				}
			}
		});
		context.subscriptions.push(hover);
	}

	path = context.extension.extensionPath;

	vscode.workspace.onDidOpenTextDocument(async function (document) {
		check(document);
	});

	vscode.workspace.onDidChangeTextDocument(async function (event) {

		if (timeout != null) {
			clearTimeout(timeout)
		}
		timeout = setTimeout(() => {
			timeout = null;
			check(event.document)
		}, 250)
	});

}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log("DEACTIVATE");
}
