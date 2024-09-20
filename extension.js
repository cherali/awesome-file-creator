const vscode = require("vscode");
const path = require("path");
const uuid = require("uuid4");

const rootPath = vscode.workspace.rootPath;
const templateFilesPath = path.join(rootPath, "templateFiles");

function showProgress(title, handler) {
	vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title,
			cancellable: false,
		},
		handler,
	);
}

function interpolate(text, input) {
	return text.replace(/__\$name\$\__/g, input);
}

function removeFalsy(arr) {
	return arr.filter(r => r != undefined && r != "" && r != null);
}

// remove first part of name and replace it with target
function getNewFileName(inputName, targetName) {
	const target = targetName.split("/").pop();
	if (inputName.indexOf("{{name}}") > -1) {
		return [target].concat(inputName.split(".").slice(1)).join(".");
	}
	return inputName;
}

function getSubPath(path, fileName) {
	return path ? `${path},${fileName}` : fileName;
}

function getTemplateFilePath(filePath, fileName, subPath = "") {
	const pathArray = removeFalsy([templateFilesPath, ...filePath.split(","), ...subPath.split(","), fileName]);

	return vscode.Uri.file(path.join(...pathArray));
}

function getNewFilePath(argPath, name, userInput, treePath) {
	const tree = removeFalsy((treePath || "").split(","));

	// if user types a path remove last item
	const userInputPath = userInput.indexOf("/") > -1 ? userInput.split("/").slice(0, -1) : [];
	// if user types / at start // remove it
	if (userInput.indexOf("/") == 0) {
		userInputPath.shift();
	}

	const pathArray = removeFalsy([argPath, ...userInputPath, ...tree, name]);
	return vscode.Uri.file(path.join(...pathArray));
}

function getRelativePath(filePath) {
	const relativePath = filePath.replace(templateFilesPath, "");
	let sliceIndex = relativePath[0] == path.sep ? 1 : 0;

	return relativePath.replaceAll(path.sep, ",").slice(sliceIndex);
}

function getUserInputName(input) {
	return input.split("/").pop();
}

function validateInput(input) {
	// if input is empty: show error
	if (!input) {
		const error = "Empty name not allowed.";
		vscode.window.showErrorMessage(error);
		throw new Error(error);
	}

	// if last input is '/': show error
	if (input.lastIndexOf("/") == input.length - 1) {
		const error = "Invalid name.";
		vscode.window.showErrorMessage(error);
		throw new Error(error);
	}
}

function getFolderMenuItem(group, ext) {
	return {
		command: "awesome-file-creator.newFolderTemplate." + ext,
		group: `0_${group}@1`,
	};
}

function getFolderAndSubMenuItem(group, ext) {
	return {
		command: "awesome-file-creator.newFolderAndSubTemplate." + ext,
		group: `0_${group}@1`,
	};
}

function getPackageAttrs(fileTree, group, parentId, data) {
	data.menus[parentId] = data.menus[parentId] ?? [];

	let fileCount = 0;
	let pushedCommonFolder = false;
	let pushedCommonSub = false;
	fileTree.forEach(sub => {
		const subType = sub.get("type");
		const name = sub.get("name");
		const filePath = sub.get("path") || "";

		if (subType == "file") {
			fileCount += 1;

			const fileName = name.split(".");
			const commandName = `awesome-file-creator.newTemplate.${filePath.replaceAll(",", ".")}.${name}`;

			// push to command
			data.command.push({
				command: commandName,
				title: `File: ${fileName[0]} (${fileName[1]})`,
				category: "Awesome File Creator",
				filePath,
				fileName: name,
			});

			// push to command palette, for prevent selecting generated command in command palette
			data.commandPalette.push({
				command: commandName,
				when: "false",
			});

			// create menu
			data.menus[parentId].push({
				command: commandName,
				group: `1_${group}@99`,
			});

			// push common
			if (fileCount > 1 && !pushedCommonFolder) {
				const ext = filePath.replaceAll(",", ".");
				data.menus[parentId].push(getFolderMenuItem(group, ext));
				pushedCommonFolder = true;

				data.command.push({
					command: `awesome-file-creator.newFolderTemplate.${ext}`,
					title: "All: Files In Folder",
					category: "Awesome File Creator",
					filePath,
				});

				// push to command palette, for prevent selecting generated command in command palette
				data.commandPalette.push({
					command: `awesome-file-creator.newFolderTemplate.${ext}`,
					when: "false",
				});
			}
		} else {
			const folderId = uuid();

			data.menus[folderId] = data.menus[folderId] || [];

			data.menus[parentId].push({
				submenu: folderId,
				group: `1_${group}@1`,
			});

			data.submenus.push({ id: folderId, label: "Folder: " + name });

			const children = sub.get("children");

			//	push common
			if (children?.length > 0 && !pushedCommonSub) {
				const ext = filePath.split(",").slice(0, -1).join(".");
				data.menus[parentId].push(getFolderAndSubMenuItem(group, ext));
				pushedCommonSub = true;

				data.command.push({
					command: `awesome-file-creator.newFolderAndSubTemplate.${ext}`,
					title: "All: Files + Sub Folders",
					category: "Awesome File Creator",
					filePath: ext.replaceAll(".", ","),
				});

				// push to command palette, for prevent selecting generated command in command palette
				data.commandPalette.push({
					command: `awesome-file-creator.newFolderAndSubTemplate.${ext}`,
					when: "false",
				});
			}

			getPackageAttrs(children, group, folderId, data);
		}
	});
}

function createPackageAttributes(fileTree, group, parentId) {
	const data = {
		command: [],
		menus: {},
		submenus: [],
		commandPalette: [],
	};

	getPackageAttrs(fileTree, group, parentId, data);

	return data;
}

/**
 * @param {vscode.ExtensionContext} context
 */
async function createNestedMenu(context, fileTree) {
	const packageJsonPath = vscode.Uri.file(path.join(context.extensionPath, "package.json"));

	try {
		const packageBuffer = await vscode.workspace.fs.readFile(packageJsonPath);
		const packageJson = JSON.parse(packageBuffer.toString("utf-8"));

		const nestedMenu = [
			{
				when: "explorerResourceIsFolder",
				command: "awesome-file-creator.syncTemplateFiles",
				group: "0_navigation",
			},
			{
				submenu: "depth0",
				group: "0_navigation",
				when: "explorerResourceIsFolder",
			},
		];
		// Add the nested menu to the contributes section
		if (!packageJson.contributes) {
			packageJson.contributes = {};
		}
		if (!packageJson.contributes.menus) {
			packageJson.contributes.menus = {};
		}

		const generatedAttributes = createPackageAttributes(fileTree, "AFC", "depth0");

		packageJson.contributes.commands = [
			{
				command: "awesome-file-creator.syncTemplateFiles",
				title: "Sync Template Files",
				category: "Awesome File Creator",
			},
			...generatedAttributes.command,
		];

		packageJson.contributes.menus = generatedAttributes.menus;
		packageJson.contributes.submenus = [
			{
				id: "depth0",
				label: "New Template Files",
			},
			...generatedAttributes.submenus,
		];

		// disable some command in command palette
		packageJson.contributes.menus["commandPalette"] = [...generatedAttributes.commandPalette];

		packageJson.contributes.menus["explorer/context"] = nestedMenu;

		try {
			await vscode.workspace.fs.writeFile(
				packageJsonPath,
				new TextEncoder().encode(JSON.stringify(packageJson, null, 2)),
			);
			vscode.window
				.showInformationMessage(
					"For showing file tree in context menu you need to reload the editor",
					"Reload",
					"Cancel",
				)
				.then(selection => {
					if (selection === "Reload") {
						vscode.commands.executeCommand("workbench.action.reloadWindow");
					}
				});
		} catch (err) {
			console.error("Error writing package.json:", err);
		}
	} catch (err) {
		console.error("Error reading package.json:", err);
		return;
	}
}

async function readDirectoryRecursive(dir) {
	try {
		const dirUri = vscode.Uri.file(dir); // Convert to URI
		const files = await vscode.workspace.fs.readDirectory(dirUri); // Read directory

		// Create a directory node
		const directoryNode = new Map([
			["name", path.basename(dir)],
			["type", "directory"],
			["children", []],
			["path", getRelativePath(dir)],
		]);

		const promises = files.map(async ([fileName, fileType]) => {
			const fullPath = path.join(dir, fileName);

			if (fileType === vscode.FileType.Directory) {
				// If it is a directory, read it recursively
				const subDirNode = await readDirectoryRecursive(fullPath);
				// Add the subdirectory node
				directoryNode.get("children").push(subDirNode);
			} else {
				// If it's a file, add it to children
				directoryNode.get("children").push(
					new Map([
						["name", fileName],
						["type", "file"],
						["path", getRelativePath(dir)],
					]),
				);
			}
		});

		// Wait for all promises to resolve
		await Promise.all(promises);
		return directoryNode;
	} catch (err) {
		throw err;
	}
}

async function saveAndCreate(readPath, writePath, userFileName, workspaceEdit) {
	try {
		const templateData = await vscode.workspace.fs.readFile(readPath);
		const content = templateData.toString("utf-8");
		workspaceEdit.createFile(writePath, { ignoreIfExists: true });

		await vscode.workspace.fs.writeFile(
			writePath,
			new TextEncoder().encode(interpolate(content, getUserInputName(userFileName))),
		);
	} catch (err) {
		throw err;
	}
}

async function handleCommand(args, command) {
	let userFileName = await vscode.window.showInputBox({
		placeHolder: "Name...",
	});

	// remove start and end spaces
	userFileName = userFileName.trim();

	// validate input
	try {
		validateInput(userFileName);
	} catch (err) {
		console.error(err);
		return;
	}

	showProgress("Creating Template files....", async () => {
		try {
			let infoMessage = "";
			const promises = [];

			const workspaceEdit = new vscode.WorkspaceEdit();

			function readAll(pathFiles, readSub = true, subPath = "") {
				// map through files in directory
				const result = pathFiles.map(async ([fileName, fileType]) => {
					// get new file name
					const templateName = getNewFileName(fileName, userFileName);

					// the full path that file must be created at
					const newFileFullPath = getNewFilePath(args.path, templateName, userFileName, subPath);

					// where to find the template
					const templateFilePath = getTemplateFilePath(command.filePath, fileName, subPath);

					// if directory
					if (fileType === vscode.FileType.Directory && readSub) {
						// create directory
						await vscode.workspace.fs.createDirectory(newFileFullPath);

						// read sub directory files
						const subDirFiles = await vscode.workspace.fs.readDirectory(templateFilePath);

						// call read
						readAll(subDirFiles, true, getSubPath(subPath, fileName));
					} else {
						// create file operation
						await saveAndCreate(templateFilePath, newFileFullPath, userFileName, workspaceEdit);

						// update message info
						infoMessage = "Files Created.";
					}
				});

				promises.push(result);
			}

			if (command.command.indexOf("FolderTemplate") > -1) {
				// get template path folder // use to read templates from this path
				const templateFolderPath = getTemplateFilePath(command.filePath);

				// read the folder
				const files = await vscode.workspace.fs.readDirectory(templateFolderPath);

				// read folder
				readAll(files, false);

				// wait for all files to be created
				await Promise.all(promises);
			} else if (command.command.indexOf("FolderAndSubTemplate") > -1) {
				// get template path folder // use to read templates from this path
				const templateFolderPath = getTemplateFilePath(command.filePath);

				// read the folder
				const files = await vscode.workspace.fs.readDirectory(templateFolderPath);

				// read folder
				readAll(files, true);
				// wait for all files to be created
				await Promise.all(promises);
			} else {
				// get new file name
				const templateName = getNewFileName(command.fileName, userFileName);

				// the full path that file must be created at
				const newFileFullPath = getNewFilePath(args.path, templateName, userFileName);

				// where to find the template
				const templateFilePath = getTemplateFilePath(command.filePath, command.fileName);

				// create file operation
				await saveAndCreate(templateFilePath, newFileFullPath, userFileName, workspaceEdit);

				// update message info
				infoMessage = `'${templateName}' Created.`;
			}

			// if everything goes right, show creation message.
			setTimeout(() => {
				vscode.window.showInformationMessage(infoMessage);
			}, 500);
		} catch (err) {
			vscode.window.showErrorMessage("Failed to create files.");
			console.error(err);
		}
	});
}

/**
 * @param {vscode.ExtensionContext} context
 */
async function registerCommands(context) {
	try {
		const packageJsonPath = vscode.Uri.file(path.join(context.extensionPath, "package.json"));
		const packageBuffer = await vscode.workspace.fs.readFile(packageJsonPath);

		const packageJson = JSON.parse(packageBuffer.toString("utf-8"));

		packageJson?.contributes?.commands?.slice(1)?.forEach(command => {
			context.subscriptions.push(
				vscode.commands.registerCommand(command.command, function (args) {
					handleCommand(args, command);
				}),
			);
		});
	} catch (err) {
		console.error("Error reading package.json:", err);

		return;
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	registerCommands(context);

	const syncCommand = vscode.commands.registerCommand("awesome-file-creator.syncTemplateFiles", function () {
		showProgress("Reading template files...", async () => {
			try {
				const fileTree = await readDirectoryRecursive(templateFilesPath);

				await createNestedMenu(context, fileTree.get("children"));
			} catch (err) {
				console.error(err);
				vscode.window.showErrorMessage("Failed to Read `templateFiles` Directory Or Files");
			} finally {
				return;
			}
		});
	});

	context.subscriptions.push(syncCommand);
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate,
};
