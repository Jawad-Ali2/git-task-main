import * as vscode from 'vscode';

export class TaskCompletionProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
	): vscode.ProviderResult<vscode.CompletionItem[]> {

		// Extracts text till cursor
		const linePrefix = document.lineAt(position).text.substring(0, position.character);

		// Detect if we're in a comment context
		const commentInfo = this.getCommentInfo(linePrefix, document.languageId);
		if (!commentInfo) {
			return undefined;
		}

		// Trigger completion for @task - keep it visible as user types
		// If the last "word" in the line starts with @t..., offer the snippet
		const lastTokenMatch = linePrefix.match(/(?:^|\s)(@[A-Za-z]*)$/); // ?: non-capturing group for preceding space or start
		if (lastTokenMatch) {
			const token = lastTokenMatch[1];
			if ('@task'.startsWith(token.toLowerCase())) {
				// Calculate range that includes the @ symbol so VS Code knows what to replace
				const startPos = new vscode.Position(position.line, position.character - token.length);
				const range = new vscode.Range(startPos, position);
				return [this.createTaskSnippet(commentInfo.commentPrefix, range)];
			}
		}

		return undefined;
	}

	private getCommentInfo(linePrefix: string, languageId: string): { commentPrefix: string } | undefined {
		const trimmed = linePrefix.trim();
		
		// JavaScript/TypeScript/C-style
		if (trimmed.startsWith('//')) {
			return { commentPrefix: '//' };
		}

		if (trimmed.startsWith('/*') || trimmed.startsWith('*')) {
			return { commentPrefix: ' *' };
		}

		// Python/Shell/Ruby
		if (trimmed.startsWith('#')) {
			return { commentPrefix: '#' };
		}

		// SQL-style
		if (trimmed.startsWith('--')) {
			return { commentPrefix: '--' };
		}

		return undefined;
	}

	private createTaskSnippet(commentPrefix: string, range: vscode.Range): vscode.CompletionItem {
		const snippet = new vscode.CompletionItem('@task', vscode.CompletionItemKind.Snippet);
		snippet.insertText = new vscode.SnippetString(
			`@task [priority:\${1|high,medium,low,p0,p1,p2,p3|}] [status:\${2|active,in-progress,done|}] [author:\${3:username}]\n${commentPrefix} \${0:Task description here}`
		);
		snippet.documentation = new vscode.MarkdownString(
			'Insert a structured GitTask comment with priority, status, and author fields.\n\nPress `Tab` to navigate between fields.'
		);
		snippet.detail = 'GitTask structured comment';
		snippet.filterText = '@task';
		snippet.sortText = '0'; // Sort to top
		snippet.range = range; // Tell VS Code exactly what text to replace
		return snippet;
	}
}
