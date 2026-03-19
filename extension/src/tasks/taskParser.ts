import * as vscode from 'vscode';
import { CodeTask, TaskStatus, TaskType } from './taskTypes';

// Without comment syntax (//, #, etc.)
interface CommentExtractionResult {
	commentText: string;
}

export class TaskParser {
	async parseDocument(document: vscode.TextDocument): Promise<CodeTask[]> {
		const tasks: CodeTask[] = [];

		for (let line = 0; line < document.lineCount; line += 1) {
			const lineObj = document.lineAt(line);
			const extraction = this.extractCommentText(lineObj.text, document.languageId);
			if (!extraction) {
				continue;
			}

			const { commentText } = extraction;
			const structured = this.parseStructuredComment(commentText, document, line);
			if (structured) {
				tasks.push(structured);
				continue;
			}

			const simple = this.parseSimpleTaskComment(commentText, document, line);
			if (simple) {
				tasks.push(simple);
			}
		}

		// Attempt to get creation dates via git blame (best effort)
		await this.enrichWithCreationDates(tasks, document.uri);

		return tasks;
	}

	private async enrichWithCreationDates(tasks: CodeTask[], uri: vscode.Uri): Promise<void> {
		if (tasks.length === 0 || uri.scheme !== 'file') {
			return;
		}

		try {
			// Try to get file modification time as fallback
			const stat = await vscode.workspace.fs.stat(uri);
			const fallbackDate = new Date(stat.mtime);

			for (const task of tasks) {
				// Simple heuristic: use file mtime as creation date
				// In a full implementation, you could parse git blame for each line
				(task as any).createdDate = fallbackDate;
			}
		} catch {
			// Ignore errors; tasks will have no creation date
		}
	}

	private extractCommentText(lineText: string, languageId: string): CommentExtractionResult | undefined {
		const trimmed = lineText.trim();
		if (!trimmed) {
			return undefined;
		}

		// Handle common single-line comment syntaxes.
		if (trimmed.startsWith('//')) {
			return { commentText: trimmed.substring(2).trim() };
		}

		if (trimmed.startsWith('#')) {
			return { commentText: trimmed.substring(1).trim() };
		}

		// Basic support for languages that use '--' (SQL-like)
		if (trimmed.startsWith('--')) {
			return { commentText: trimmed.substring(2).trim() };
		}

		// Fallback: for other languages, ignore for now.
		return undefined;
	}

	private parseStructuredComment(commentText: string, document: vscode.TextDocument, line: number): CodeTask | undefined {
		const taskMatch = commentText.match(/^@task\b(.*)$/); //^ - Start of line, \b - word boundary, (.*) - capture rest of line (returned as second item in array, first element is the full matching part), $ - end of line. Function returns an array or null
		if (!taskMatch) {
			return undefined;
		}

		// Parse fields from the rest of the line
		let rest = taskMatch[1].trim();
		const fields: Record<string, string> = {};

		// Parse field blocks like [priority:high] [status:done] [author:alice]
		const fieldPattern = /^\[(.+?)\]\s*/; // Matches [key:value] at the start of the string, \s* - optional whitespace after the block
		while (rest.length > 0) {
			const match = rest.match(fieldPattern);
			if (!match) {
				break;
			}
			const content = match[1].trim();
			const separatorIndex = content.search(/[:=]/); // Find first occurrence of ':' or '='
			if (separatorIndex > 0) {
				const key = content.substring(0, separatorIndex).trim().toLowerCase();
				const value = content.substring(separatorIndex + 1).trim();
				if (key && value) {
					fields[key] = value;
				}
			}
			rest = rest.substring(match[0].length); // Remove the matched block from the rest string and re-iterate
		}

		let description = rest.trim();

		if (!description) {
			// If no description on the @task line, try the next comment line as the description.
			if (line + 1 < document.lineCount) {
				const nextLine = document.lineAt(line + 1);
				const nextExtraction = this.extractCommentText(nextLine.text, document.languageId);
				if (nextExtraction && !nextExtraction.commentText.startsWith('@task')) {
					description = nextExtraction.commentText;
				}
			}
		}

		if (!description) {
			description = 'Untitled task';
		}

		const status: TaskStatus = (fields.status?.toLowerCase() === 'done') ? 'done' : 'active'; // Todo: Add in-progress option here
		const priority = fields.priority;
		const author = fields.author;

		const type: TaskType = 'structured';
		const range = document.lineAt(line).range;
		const id = this.buildTaskId(document.uri, line, type, description);

		return {
			id,
			label: description,
			type,
			status,
			priority,
			author,
			fileUri: document.uri,
			line,
			range,
			source: 'structured',
		};
	}

	private parseSimpleTaskComment(commentText: string, document: vscode.TextDocument, line: number): CodeTask | undefined {
		const match = commentText.match(/\b(TODO|FIXME|HACK|NOTE)\b[:\-]?\s*(.*)$/i); // ? - optional colon or dash after the keyword, i - case insensitive
		if (!match) {
			return undefined;
		}

		const rawType = match[1].toLowerCase();
		const tail = match[2] ?? '';

		let label = tail.trim() || rawType.toUpperCase();
		let author: string | undefined;

		// Extract a simple author marker like @alice
		const authorMatch = label.match(/@([a-zA-Z0-9_-]+)/);
		if (authorMatch) {
			author = authorMatch[1];
			label = label.replace(authorMatch[0], '').trim();
		}

		const type: TaskType = (rawType === 'todo' || rawType === 'fixme' || rawType === 'hack' || rawType === 'note')
			? rawType as TaskType
			: 'todo';

		const status: TaskStatus = 'active';
		const range = document.lineAt(line).range;
		const id = this.buildTaskId(document.uri, line, type, label);

		return {
			id,
			label,
			type,
			status,
			priority: undefined,
			author,
			fileUri: document.uri,
			line,
			range,
			source: 'comment',
		};
	}

	private buildTaskId(uri: vscode.Uri, line: number, type: TaskType, label: string): string {
		return `${uri.toString()}:${line}:${type}:${this.simpleHash(label)}`;
	}

	// Generates a simple hash code to give unique IDs based on task label, in case the comment was modified on the same line, it should be treated as a new task
	private simpleHash(text: string): number {
		let hash = 0;
		for (let i = 0; i < text.length; i += 1) {
			// Simple string hash (not for security, only for IDs)
			// Binary example:
			// hash = 5
			// Binary: 00000000 00000000 00000000 00000101
			
			// hash << 5 (shift left by 5):
			// Binary: 00000000 00000000 00000000 10100000
			// Decimal: 160
			
			// Math: 5 × (2^5) = 5 × 32 = 160
			hash = ((hash << 5) - hash) + text.charCodeAt(i);
			hash |= 0; // Convert to 32bit integer, takes modulo % 2^32
		}
		return hash;
	}
}
