# Obsidian 2 Book

## Installation

> **Note:** This plugin is not yet available in the official Obsidian plugin library. You can install it manually by following the instructions below.

1. Install [Node.js](https://nodejs.org/en/download/)
1. Install [Obsidian](https://obsidian.md/)
2. Enable third party plugin in Obsidian settings: `Settings > Third-party plugin > Obsidian 2 Book > Enable`
3. Navigate to the plugins folder on your machine: `VaultFolder/.obsidian/plugins/`
4. Clone the [Obsidian 2 Book](https://github.com/Mitra98t/obsidian2book-plugin) repository inside the plugin folder
5. Run `npm install` inside the repository folder
6. Run `npm run build` inside the repository folder
7. In Obsidian, make sure the plugin is enabled in `Settings > Third-party plugin > Obsidian 2 Book > Enable`

## Usage

Generate a book from your Obsidian vault by running the command `Obsidian 2 Book: Generate book from the entire vault` from the command palette (`Ctrl/Cmd + P`). The book will be generated in the root of your vault.

Generate a book from a specific folder in your vault by running the command `Obsidian 2 Book: Generate a book from a specified folder` from the command palette (`Ctrl/Cmd + P`). The book will be generated in the root of your vault.
(You should be able to navigate to the folder you want to generate the book from directly inside the command palette.)

## Configuration

You can configure the plugin by going to `Settings > Community plugins > Obsidian 2 Book > Settings`.
