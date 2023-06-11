/* eslint-disable no-mixed-spaces-and-tabs */
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

import * as path from "path";

// Remember to rename these classes and interfaces!

enum SortingStrategy {
	ALPHABETICAL = "alphabetical",
	CREATION_TIME = "creation time",
}

enum LowGraneSortingStrategy {
	FILEFIRST = "file first",
	FOLDERFIRST = "folder first",
}

interface MyPluginSettings {
	foldersToIgnore: string[];
	filesToIgnore: string[];
	tagsToIgnore: string[];
	extensionsToIgnore: string[];
	generateTOCs: boolean;
	sortingStrategy: SortingStrategy;
	lowGraneSortingStrategy: LowGraneSortingStrategy;
	// TODO remove this thing
	elements: string[];
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	foldersToIgnore: [],
	filesToIgnore: [],
	tagsToIgnore: [],
	extensionsToIgnore: [],
	generateTOCs: true,
	sortingStrategy: SortingStrategy.ALPHABETICAL,
	lowGraneSortingStrategy: LowGraneSortingStrategy.FILEFIRST,
	elements: [],
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
	document: TAbstractFile;
};

let fileList: fileStruct[] = [];

type SortingSettings = {
	sortingStrategy: SortingStrategy;
	lowGraneSortingStrategy: LowGraneSortingStrategy;
};

function isDocFile(file: TAbstractFile): boolean {
	return file.hasOwnProperty("extension");
}

function isDocFolder(file: TAbstractFile): boolean {
	return file.hasOwnProperty("children");
}

function lineIncludesTag(line: string, tag: string[]): boolean {
	return tag
		.filter((x) => x.trim() != "")
		.some((t) => line.toLowerCase().includes("#" + t.trim().toLowerCase()));
}

/**
 * true if file is valid false if file is to be ignored
 */
async function checkFile(
	app: App,
	file: TFile,
	settings: MyPluginSettings
): Promise<boolean> {
	const fileContent = await app.vault.read(file);
	const isBookIgnore = fileContent.includes("<!--book-ignore-->");
	const isTagIgnore =
		settings.tagsToIgnore.length == 0
			? false
			: fileContent
					.split(/\n/)
					.filter((l) => lineIncludesTag(l, settings.tagsToIgnore))
					.length > 0;

	const isExtIgnore =
		settings.extensionsToIgnore.length == 0
			? false
			: settings.extensionsToIgnore
					.filter((x) => x.trim() != "")
					.some((ext) => ("." + file.extension).includes(ext.trim()));
	const isFileIgnore =
		settings.filesToIgnore.length == 0
			? false
			: settings.filesToIgnore
					.filter((x) => x.trim() != "")
					.some((f) => file.name.trim() == f.trim());

	return Promise.resolve(
		!isBookIgnore && !isTagIgnore && !isExtIgnore && !isFileIgnore
	);
}

async function checkFolder(
	app: App,
	file: TFolder,
	settings: MyPluginSettings
): Promise<boolean> {
	const isFolderIgnore =
		settings.foldersToIgnore.length == 0
			? false
			: settings.foldersToIgnore
					.filter((x) => x.trim() != "")
					.some((f) => file.name.trim() == f.trim());
	return Promise.resolve(!isFolderIgnore);
}

function visitFolder(
	sortingOpt: SortingSettings,
	fileStr: TAbstractFile,
	app: App,
	depth = 0
): void {
	if (isDocFile(fileStr)) {
		const file: TFile = fileStr as TFile;
		fileList.push({
			type: "file",
			path: (depth > 0 ? "/" : "") + file.path,
			name: file.name,
			graphicName: file.basename,
			creationTime: file.stat.ctime,
			modificationTime: file.stat.mtime,
			depth,
			document: file,
		});
	} else if (isDocFolder(fileStr)) {
		const dir: TFolder = fileStr as TFolder;
		fileList.push({
			type: "folder",
			path: (depth > 0 ? "/" : "") + dir.path,
			name: dir.name,
			graphicName: dir.name,
			depth,
			document: dir,
		});
		let allChild: TAbstractFile[] = dir.children;
		allChild = allChild.sort((a, b) => {
			if (isDocFolder(a) && isDocFile(b)) {
				if (
					sortingOpt.lowGraneSortingStrategy ===
					LowGraneSortingStrategy.FILEFIRST
				)
					return 1;
				// Folder First
				else return -1;
			}
			if (isDocFile(a) && isDocFolder(b)) {
				if (
					sortingOpt.lowGraneSortingStrategy ===
					LowGraneSortingStrategy.FILEFIRST
				)
					return -1;
				// Folder First
				else return 1;
			}
			if (isDocFolder(a) && isDocFolder(b)) {
				const dirA: TFolder = a as TFolder;
				const dirB: TFolder = b as TFolder;
				return dirA.name.localeCompare(dirB.name);
			}
			if (isDocFile(a) && isDocFile(b)) {
				const fileA: TFile = a as TFile;
				const fileB: TFile = b as TFile;
				switch (sortingOpt.sortingStrategy) {
					case SortingStrategy.ALPHABETICAL:
						return fileA.basename.localeCompare(fileB.basename);
					case SortingStrategy.CREATION_TIME:
						return fileA.stat.ctime - fileB.stat.ctime;
				}
			}
			return 0;
		});
		allChild.forEach((child) => {
			visitFolder(sortingOpt, child, app, depth + 1);
		});
	}
}

async function getTableOfContent(
	currPath: string,
	currDepth: number,
	fileList: fileStruct[],
	settings: MyPluginSettings
): Promise<string> {
	const tocArray: fileStruct[] = [...fileList].filter(
		(file) => file.depth === currDepth + 1 && file.path.includes(currPath)
	);
	let toc = "";
	for (let i = 0; i < tocArray.length; i++) {
		const file = tocArray[i];
		if (file.type === "folder") {
			const isFolderValid = await checkFolder(
				app,
				file.document as TFolder,
				{ ...settings }
			);
			if (isFolderValid) toc += `📂 [[#${file.graphicName}]]\n`;
		} else {
			const isFileValid = await checkFile(
				app,
				file.document as TFile,
				settings
			);
			if (isFileValid) toc += `📄 [[#${file.graphicName}]]\n`;
		}
	}
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

	const generateTOCs = settings.generateTOCs;
	console.log(generateTOCs);

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

	const sortingOpt: SortingSettings = {
		sortingStrategy: settings.sortingStrategy,
		lowGraneSortingStrategy: settings.lowGraneSortingStrategy,
	};

	visitFolder(sortingOpt, files, app);
	const documents: fileStruct[] = fileList;
	fileList = [];

	console.log(documents);

	let content = `<!--book-ignore-->\n\n`;

	for (let i = 0; i < documents.length; i++) {
		const file = documents[i];
		if (file.type === "folder") {
			const isFolderValid = await checkFolder(
				app,
				file.document as TFolder,
				{ ...settings }
			);
			if (!isFolderValid) continue;
		}
		if (file.type === "file") {
			const isFileValid = await checkFile(app, file.document as TFile, {
				...settings,
			});
			console.log(file.name);
			console.log(isFileValid);
			if (!isFileValid) continue;
		}
		const currToc = await getTableOfContent(
			file.path,
			file.depth,
			documents,
			{ ...settings }
		);
		if (i == 0) {
			content += `# ${vault.getName()}\n\n${
				generateTOCs ? currToc : ""
			}\n\n---\n\n${getSpacer(true)}\n\n`;
		} else {
			if (file.type === "folder") {
				content += `${
					file.depth == 1 ? getSpacer(true) : "---"
				}\n\n${new Array(file.depth > 6 ? 6 : file.depth)
					.fill("#")
					.join("")} ${file.graphicName}\n\n${
					generateTOCs ? currToc : ""
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

	const { adapter } = vault;

	try {
		const fileExists = await adapter.exists(
			path.join(startingFolder, `${vault.getName()}_book.md`)
		);
		if (fileExists) {
			console.log("File exists going into modal");
			new ConfirmModal(
				app,
				"Overwrite",
				`A file named ${vault.getName()}_book.md already exists. Do you want to overwrite it?`,
				() => {
					const file = vault.getAbstractFileByPath(
						`${vault.getName()}_book.md`
					);
					console.log(file);
					if (file === null) return;
					vault
						.modify(file as TFile, content)
						.then(() =>
							app.workspace.getLeaf().openFile(file as TFile)
						);
				},
				() => {}
			).open();
		} else {
			const fileCreated = await vault.create(
				path.join(startingFolder, `${vault.getName()}_book.md`),
				content
			);
			app.workspace.getLeaf().openFile(fileCreated);
		}
	} catch (e) {
		new Notice(e.toString());
	}

	return Promise.resolve(true);
}

class ConfirmModal extends Modal {
	private confirmCallback: () => void;
	private cancelCallback: () => void;

	constructor(
		app: App,
		title: string,
		content: string,
		confirmCallback: () => void,
		cancelCallback: () => void
	) {
		super(app);
		this.titleEl.setText(title);
		this.contentEl.setText(content);
		this.confirmCallback = confirmCallback;
		this.cancelCallback = cancelCallback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createDiv({ cls: "modal-button-container" }, (div) => {
			div.createEl(
				"button",
				{ text: "Confirm", cls: "mod-cta" },
				(button) => {
					button.onClickEvent(() => {
						this.close();
						this.confirmCallback();
					});
				}
			);
			div.createEl("button", { text: "Cancel" }, (button) => {
				button.onClickEvent(() => {
					this.close();
					this.cancelCallback();
				});
			});
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
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
					.setValue(this.plugin.settings.sortingStrategy)
					.onChange(async (value) => {
						console.log("Dropdown: " + value);
						this.plugin.settings.sortingStrategy =
							value as SortingStrategy;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Sorting order")
			.setDesc("Sorting order for the book")
			.addDropdown((dropdown) =>
				dropdown
					.addOption(LowGraneSortingStrategy.FILEFIRST, "File First")
					.addOption(
						LowGraneSortingStrategy.FOLDERFIRST,
						"Folder First"
					)
					.setValue(this.plugin.settings.lowGraneSortingStrategy)
					.onChange(async (value) => {
						console.log("Dropdown: " + value);
						this.plugin.settings.lowGraneSortingStrategy =
							value as LowGraneSortingStrategy;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Add file to ignore")
			.setDesc("Add file name to the list of file to be ignored")
			.addButton((button) =>
				button.setButtonText("Add Element").onClick(async () => {
					this.plugin.settings.filesToIgnore.push("");
					await this.plugin.saveSettings();
					this.display();
				})
			);

		for (let i = 0; i < this.plugin.settings.filesToIgnore.length; i++) {
			const element = this.plugin.settings.filesToIgnore[i];
			new Setting(containerEl)
				.setName("File to ignore " + i)
				.setDesc("Set file name to ignore")
				.addText((text) =>
					text
						.setPlaceholder("Enter file name")
						.setValue(element)
						.onChange(async (value) => {
							console.log("Element: " + value);
							this.plugin.settings.filesToIgnore[i] = value;
							await this.plugin.saveSettings();
						})
				)
				.addButton((button) =>
					button.setButtonText("-").onClick(async () => {
						this.plugin.settings.filesToIgnore.splice(i, 1);
						await this.plugin.saveSettings();
						this.display();
					})
				);
		}

		new Setting(containerEl)
			.setName("Add extension to ignore")
			.setDesc("Add extension to the list of extensions to be ignored")
			.addButton((button) =>
				button.setButtonText("Add Element").onClick(async () => {
					this.plugin.settings.extensionsToIgnore.push("");
					await this.plugin.saveSettings();
					this.display();
				})
			);

		for (
			let i = 0;
			i < this.plugin.settings.extensionsToIgnore.length;
			i++
		) {
			const element = this.plugin.settings.extensionsToIgnore[i];
			new Setting(containerEl)
				.setName("Extension to ignore " + i)
				.setDesc("Set exntesion to ignore")
				.addText((text) =>
					text
						.setPlaceholder("Enter exntesion")
						.setValue(element)
						.onChange(async (value) => {
							console.log("Element: " + value);
							this.plugin.settings.extensionsToIgnore[i] = value;
							await this.plugin.saveSettings();
						})
				)
				.addButton((button) =>
					button.setButtonText("-").onClick(async () => {
						this.plugin.settings.extensionsToIgnore.splice(i, 1);
						await this.plugin.saveSettings();
						this.display();
					})
				);
		}

		new Setting(containerEl)
			.setName("Add folder to ignore")
			.setDesc("Add folder name to the list of folder to be ignored")
			.addButton((button) =>
				button.setButtonText("Add Element").onClick(async () => {
					this.plugin.settings.foldersToIgnore.push("");
					await this.plugin.saveSettings();
					this.display();
				})
			);

		for (let i = 0; i < this.plugin.settings.foldersToIgnore.length; i++) {
			const element = this.plugin.settings.foldersToIgnore[i];
			new Setting(containerEl)
				.setName("Folder to ignore " + i)
				.setDesc("Set folder name to ignore")
				.addText((text) =>
					text
						.setPlaceholder("Enter folder name")
						.setValue(element)
						.onChange(async (value) => {
							console.log("Element: " + value);
							this.plugin.settings.foldersToIgnore[i] = value;
							await this.plugin.saveSettings();
						})
				)
				.addButton((button) =>
					button.setButtonText("-").onClick(async () => {
						this.plugin.settings.foldersToIgnore.splice(i, 1);
						await this.plugin.saveSettings();
						this.display();
					})
				);
		}

		new Setting(containerEl)
			.setName("Add tags to ignore")
			.setDesc("Add tags name to the list of tags to be ignored")
			.addButton((button) =>
				button.setButtonText("Add Element").onClick(async () => {
					this.plugin.settings.tagsToIgnore.push("");
					await this.plugin.saveSettings();
					this.display();
				})
			);

		for (let i = 0; i < this.plugin.settings.tagsToIgnore.length; i++) {
			const element = this.plugin.settings.tagsToIgnore[i];
			new Setting(containerEl)
				.setName("Tag to ignore " + i)
				.setDesc("Set tag to ignore")
				.addText((text) =>
					text
						.setPlaceholder("Enter tag")
						.setValue(element)
						.onChange(async (value) => {
							console.log("Element: " + value);
							this.plugin.settings.tagsToIgnore[i] = value;
							await this.plugin.saveSettings();
						})
				)
				.addButton((button) =>
					button.setButtonText("-").onClick(async () => {
						this.plugin.settings.tagsToIgnore.splice(i, 1);
						await this.plugin.saveSettings();
						this.display();
					})
				);
		}
	}
}
