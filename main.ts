import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";

// Remember to rename these classes and interfaces!

enum SortingStrategy {
	ALPHABETICAL = "alphabetical",
	CREATION_TIME = "creation time",
	MODIFICATION_TIME = "modification time",
}

interface MyPluginSettings {
	foldersToIgnore: string;
	filesToIgnore: string;
	tagsToIgnore: string;
	generateTOCs: boolean;
	sortingStrategy: SortingStrategy;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	foldersToIgnore: "",
	filesToIgnore: "",
	tagsToIgnore: "",
	generateTOCs: true,
	sortingStrategy: SortingStrategy.ALPHABETICAL,
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open sample modal (simple)",
			callback: () => {
				new SampleModal(this.app).open();
			},
		});

		this.addCommand({
			id: "generate-vault-book",
			name: "Generates a book from the entire vault",
			callback: () => {
				generateBook(this.app, this.settings);
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
type fileStruct = {
	type: "file" | "folder";
	path: string;
	name: string;
	graphicName: string;
	creationTime?: number;
	modificationTime?: number;
	depth: number;
};

let fileList: fileStruct[] = [];
function visitFolder(fileStr: TAbstractFile, depth = 0): void {
	if (fileStr.hasOwnProperty("extension")) {
		const file: TFile = fileStr as TFile;
		fileList.push({
			type: "file",
			path: file.path,
			name: file.name,
			graphicName: file.basename,
			creationTime: file.stat.ctime,
			modificationTime: file.stat.mtime,
			depth,
		});
	} else if (fileStr.hasOwnProperty("children")) {
		const dir: TFolder = fileStr as TFolder;
		fileList.push({
			type: "folder",
			path: dir.path,
			name: dir.name,
			graphicName: dir.name,
			depth,
		});
		// TODO: sort children
		dir.children.forEach((child) => {
			visitFolder(child, depth + 1);
		});
	}
}

function getTableOfContent(currPath: string, currDepth: number): string {
	const tocArray: fileStruct[] = [...fileList].filter(
		(file) => file.depth === currDepth + 1 && file.path.includes(currPath)
	);
	let toc = "";
	tocArray.forEach((file) => {
		if (file.type === "folder") {
			toc += `📂 [[#${file.graphicName}]]\n`;
		} else {
			toc += `📄 [[#${file.graphicName}]]\n`;
		}
	});
	return toc;
}

function getSpacer(isFullPage = false): string {
	if (isFullPage) {
		return '<div style="page-break-after: always;"></div>';
	}
	return '<div style="height: 200px;"></div>';
}

async function generateBook(
	app: App,
	settings: MyPluginSettings,
	startingFolder = "/"
): Promise<boolean> {
	const { vault } = app;

	// const foldersToIgnore = settings.foldersToIgnore.split(",");
	// const filesToIgnore = settings.filesToIgnore.split(",");
	// const tagsToIgnore = settings.tagsToIgnore.split(",");
	const generateTOCs = settings.generateTOCs;

	// const files: TFile[] = await vault.getMarkdownFiles();
	const files: TAbstractFile | null = await vault.getAbstractFileByPath(
		startingFolder
	);
	if (files === null) {
		console.error("Could not find folder: " + startingFolder);
		if (startingFolder === "/") new Notice("Empty Vault");
		else new Notice("Could not find folder: " + startingFolder);
		return Promise.resolve(false);
	}
	visitFolder(files);
	const documents: fileStruct[] = fileList;
	fileList = [];

	let content = "";

	for (let i = 0; i < documents.length; i++) {
		const file = documents[i];
		if (i == 0) {
			content += `# ${file.graphicName}\n\n${
				generateTOCs ? getTableOfContent(file.path, file.depth) : ""
			}\n\n---\n\n${getSpacer(true)}\n\n`;
		} else {
			if (file.type === "folder") {
				content += `${
					file.depth == 1 ? getSpacer(true) : "---"
				}\n\n${new Array(file.depth > 6 ? 6 : file.depth)
					.fill("#")
					.join("")} ${file.graphicName}\n\n${
					generateTOCs ? getTableOfContent(file.path, file.depth) : ""
				}\n\n---\n\n`;
			} else {
				content += `\n\n${new Array(file.depth > 6 ? 6 : file.depth)
					.fill("#")
					.join("")} ${file.graphicName}\n\n![[${
					file.name
				}]]\n\n---\n\n`;
			}
		}
	}

	console.log(content);

	return Promise.resolve(true);
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Settings for my awesome plugin." });

		new Setting(containerEl)
			.setName("Ignore files pattern")
			.setDesc(
				"Describe a pattern of files to ignore separated by comma: *.png, *.jpg"
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter patterns")
					.setValue(this.plugin.settings.filesToIgnore)
					.onChange(async (value) => {
						console.log("Pattern: " + value);
						this.plugin.settings.filesToIgnore = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ignore folder patterns")
			.setDesc(
				"Describe a pattern of folders to ignore separated by comma: template, media"
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter patterns")
					.setValue(this.plugin.settings.foldersToIgnore)
					.onChange(async (value) => {
						console.log("Secret: " + value);
						this.plugin.settings.foldersToIgnore = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ignore tags")
			.setDesc("Describe a tags ignore separated by comma: index, todo")
			.addText((text) =>
				text
					.setPlaceholder("Enter tags")
					.setValue(this.plugin.settings.tagsToIgnore)
					.onChange(async (value) => {
						console.log("Secret: " + value);
						this.plugin.settings.tagsToIgnore = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Generate TOCs")
			.setDesc("Generate Tablo of Contents for all directories")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.generateTOCs)
					.onChange(async (value) => {
						console.log("Toggle: " + value);
						this.plugin.settings.generateTOCs = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Sorting strategy")
			.setDesc("Sorting strategy for the book")
			.addDropdown((dropdown) =>
				dropdown
					.addOption(SortingStrategy.ALPHABETICAL, "Alphabetical")
					.addOption(SortingStrategy.CREATION_TIME, "Creation time")
					.addOption(
						SortingStrategy.MODIFICATION_TIME,
						"Modification time"
					)
					.setValue(this.plugin.settings.sortingStrategy)
					.onChange(async (value) => {
						console.log("Dropdown: " + value);
						this.plugin.settings.sortingStrategy =
							value as SortingStrategy;
						await this.plugin.saveSettings();
					})
			);
	}
}
