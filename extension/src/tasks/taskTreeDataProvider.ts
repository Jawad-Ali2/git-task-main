import * as vscode from 'vscode';
import { CodeTask, TaskStatus, TaskType } from './taskTypes';
import { TaskParser } from './taskParser';

export type StatusFilter = 'all' | TaskStatus;
export type TypeFilter = 'all' | TaskType;
export type SortBy = 'file' | 'priority' | 'none';

export class TaskTreeItem extends vscode.TreeItem {
	constructor(public readonly task: CodeTask) {
		// Display the task text and make it non-collapsible
		super(task.label, vscode.TreeItemCollapsibleState.None);

		this.id = task.id;
		// Shown next to the label (src/app.ts:42)
		this.description = `${vscode.workspace.asRelativePath(task.fileUri)}:${task.line + 1}`;
		this.tooltip = this.buildTooltip(task);
		this.contextValue = 'gittask.taskItem'; // For menu actions in package.json, allows targeting types for dynamic menus
		this.iconPath = this.buildIcon(task);
		this.resourceUri = task.fileUri; // Enables file decoration providers

		// Executes when clicked
		this.command = { 
			command: 'gittask.openTask',
			title: 'Open Task',
			arguments: [task],
		};
	}

	private buildTooltip(task: CodeTask): vscode.MarkdownString {
		const lines: string[] = [];
		lines.push(`### ${task.label}`);
		lines.push('');
		lines.push(`**Type**: \`${task.type.toUpperCase()}\``);
		lines.push(`**Status**: \`${task.status}\``);
		
		if (task.priority) {
			const priorityIcon = this.getPriorityIcon(task.priority);
			lines.push(`**Priority**: ${priorityIcon} \`${task.priority}\``);
		}
		
		if (task.author) {
			lines.push(`**Author**: 👤 \`${task.author}\``);
		}

		if (task.createdDate) {
			const formattedDate = this.formatDate(task.createdDate);
			lines.push(`**Created**: 📅 ${formattedDate}`);
		}

		lines.push('');
		lines.push(`📂 **Location**: \`${vscode.workspace.asRelativePath(task.fileUri)}:${task.line + 1}\``);
		lines.push('');

		const md = new vscode.MarkdownString(lines.join('  \n'));
		md.isTrusted = true;
		md.supportHtml = true;
		return md;
	}

	private getPriorityIcon(priority: string): string {
		const normalized = priority.toLowerCase();
		if (normalized === 'p0' || normalized === 'blocker' || normalized === 'critical') {
			return '🔴';
		}
		if (normalized === 'p1' || normalized === 'high') {
			return '🟠';
		}
		if (normalized === 'p2' || normalized === 'medium') {
			return '🟡';
		}
		if (normalized === 'p3' || normalized === 'low') {
			return '🟢';
		}
		return '⚪';
	}

	private formatDate(date: Date): string {
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		const month = months[date.getMonth()];
		const day = date.getDate();
		const year = date.getFullYear();
		return `${month} ${day}, ${year}`;
	}

	private buildIcon(task: CodeTask): vscode.ThemeIcon {
		if (task.status === 'done') {
			return new vscode.ThemeIcon('check');
		}
		if (task.type === 'fixme') {
			return new vscode.ThemeIcon('wrench');
		}
		if (task.type === 'hack') {
			return new vscode.ThemeIcon('flame');
		}
		if (task.type === 'note') {
			return new vscode.ThemeIcon('note');
		}
		return new vscode.ThemeIcon('circle-large-outline');
	}
}

export class TaskTreeDataProvider implements vscode.TreeDataProvider<TaskTreeItem> {
	private readonly parser = new TaskParser();

	private readonly tasksByUri = new Map<string, CodeTask[]>();

	// One broadcasts changes and other listens
	// Good practice to keep the emitter private and listener public
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private statusFilter: StatusFilter = 'all';
	private typeFilter: TypeFilter = 'all';
	private authorFilter: string | undefined;
	private sortBy: SortBy = 'file';

	// Scans the entire workspace for files and updates tasks for each
	async scanWorkspace(): Promise<void> {
		this.tasksByUri.clear();

		const includePattern = '**/*';
		const excludeGlobs = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'];

		const files = await vscode.workspace.findFiles(includePattern, `{${excludeGlobs.join(',')}}`);

		for (const uri of files) {
			await this.updateTasksForUri(uri);
		}

		this.fireChanged();
	}

	async updateTasksForDocument(document: vscode.TextDocument): Promise<void> {
		if (document.uri.scheme !== 'file') {
			return;
		}
		const tasks = await this.parser.parseDocument(document);
		this.tasksByUri.set(document.uri.toString(), tasks);
		this.fireChanged(); // Fixme: Might not be optimal to refresh entire tree on each document change
	}

	async updateTasksForUri(uri: vscode.Uri): Promise<void> {
		if (uri.scheme !== 'file') {
			return;
		}
		try {
			const document = await vscode.workspace.openTextDocument(uri);
			const tasks = await this.parser.parseDocument(document);
			this.tasksByUri.set(uri.toString(), tasks);
			this.fireChanged();
		} catch (error) {
			// Ignore files that cannot be opened as text documents.
		}
	}

	removeTasksForUris(uris: readonly vscode.Uri[]): void {
		for (const uri of uris) {
			this.tasksByUri.delete(uri.toString());
		}
		this.fireChanged();
	}

	getAllTasks(): CodeTask[] {
		const all: CodeTask[] = [];
		for (const tasks of this.tasksByUri.values()) {
			all.push(...tasks);
		}
		return all;
	}

	getTreeItem(element: TaskTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): vscode.ProviderResult<TaskTreeItem[]> {
		const tasks = this.applyFiltersAndSorting(this.getAllTasks());
		return tasks.map((task) => new TaskTreeItem(task));
	}

	refresh(): void {
		this.fireChanged();
	}

	setStatusFilter(filter: StatusFilter): void {
		this.statusFilter = filter;
		this.fireChanged();
	}

	setTypeFilter(filter: TypeFilter): void {
		this.typeFilter = filter;
		this.fireChanged();
	}

	setAuthorFilter(author: string | undefined): void {
		this.authorFilter = author && author.trim() ? author.trim() : undefined;
		this.fireChanged();
	}

	setSortBy(sortBy: SortBy): void {
		this.sortBy = sortBy;
		this.fireChanged();
	}

	private applyFiltersAndSorting(tasks: CodeTask[]): CodeTask[] {
		let result = tasks.slice(); // Creates a shallow copy

		if (this.statusFilter !== 'all') {
			result = result.filter((task) => task.status === this.statusFilter);
		}

		if (this.typeFilter !== 'all') {
			result = result.filter((task) => task.type === this.typeFilter);
		}

		if (this.authorFilter) {
			const filterLower = this.authorFilter.toLowerCase();
			result = result.filter((task) => task.author?.toLowerCase() === filterLower);
		}

		// If negative number is returned, a comes before b and vice versa
		result.sort((a, b) => {
			if (this.sortBy === 'file') {
				const aPath = vscode.workspace.asRelativePath(a.fileUri).toLowerCase();
				const bPath = vscode.workspace.asRelativePath(b.fileUri).toLowerCase();
				if (aPath !== bPath) {
					return aPath.localeCompare(bPath);
				}
				return a.line - b.line; // if same file, sort by line number
			}

			if (this.sortBy === 'priority') {
				const priorityOrder = (priority?: string): number => {
					if (!priority) {
						return 99;
					}
					const normalized = priority.toLowerCase();
					if (normalized === 'p0' || normalized === 'blocker') {
						return 0;
					}
					if (normalized === 'p1' || normalized === 'high') {
						return 1;
					}
					if (normalized === 'p2' || normalized === 'medium') {
						return 2;
					}
					if (normalized === 'p3' || normalized === 'low') {
						return 3;
					}
					return 50;
				};
				const aPriority = priorityOrder(a.priority);
				const bPriority = priorityOrder(b.priority);
				if (aPriority !== bPriority) {
					return aPriority - bPriority;
				}
				// Tiebreaker: file then line
				const aPath = vscode.workspace.asRelativePath(a.fileUri).toLowerCase();
				const bPath = vscode.workspace.asRelativePath(b.fileUri).toLowerCase();
				if (aPath !== bPath) {
					return aPath.localeCompare(bPath); // a comes before b etc
				}
				return a.line - b.line;
			}

			// Default: keep original order but stable sort by file path + line
			const aPath = vscode.workspace.asRelativePath(a.fileUri).toLowerCase();
			const bPath = vscode.workspace.asRelativePath(b.fileUri).toLowerCase();
			if (aPath !== bPath) {
				return aPath.localeCompare(bPath);
			}
			return a.line - b.line;
		});

		return result;
	}

	private fireChanged(): void {
		this._onDidChangeTreeData.fire(); // No specific element, refreshes entire tree
	}
}
