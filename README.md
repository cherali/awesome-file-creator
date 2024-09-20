# Awesome File Creator
Create files based on your desire template. <br>
With this extension you can define your template and create from that template easily, this helps you to keep the project source code uniform and reduces spelling mistakes.<br>
Not only you can create a single file, also you can create all files in folder (directory), and all files with sub folder [More info](#how-to-use).

## How To Use?
- After installation, you need to create a folder (directory) at the root of your project, this folder contains all your template files. This folder name is important, so you can't change it, and name should be: `templateFiles`. <br>

- In the `templateFiles` you can create your desired files and folder structure, by default any given name for folders, files, and code inside the files will be preserve, but don't worry you can use dynamic names [Check Dynamic Names](#dynamic-names-placeholder). <br>

- After installation, this extension adds `Sync Template Files` to your context menu (after navigation section { the first group at the top of the context menu list } ). When you right-click on a folder (this is also a command, so it's possible to select this using the command palette).<br>

- After you're done with creating your templates, right-click on any folder and press `Sync Template Files`, then wait..., after a while you can see the reload notification, and asks you to reload vs code, press reload (this reload is very important!).<br>

- After reload, the new menu item will be added at top of `Sync Template Files` with the name `New Template Files`, this is a nested menu represents your `templateFiles` files and folder structure. <br>

- You can choose any option that you want, then vs code asks you for a name, after typing the name and press enter, the corresponding file/files will be created. [Why asks you for a name?](#dynamic-names-placeholder) <br>

- If you have more than one file in a folder, you can see `All: Files In Folder` option at top, this creates all files in the folder. <br>

- If you have nested folders, you can see `All: Files + Sub Folders` option at the top, this creates all files in the folders and sub folders. <br>


### Dynamic Names (Placeholder)
By default, folder names, file names, and code inside the files will be preserved, but if you want to replace file names and codes you can use dynamic names:
- For files: use `{{name}}`
- For codes inside files: use `__$name$__`
When you select an option from `New Template Files`, vs code asks you for a name, any input you provide will puts in these placeholders. <br>

For example:
If you type 'Button' in the input, and have a file with name `{{name}}.style.ts`, in the context menu this file will be named `File: {{name}} (style)`, the final file will be named: `Button.style.ts`, now imagine the `{{name}}.style.ts` file contains the following code:
```ts
export function __$name$__(){
  return <></>
}

```
And output will be like this:
```ts
export function Button(){
  return <></>
}
```

## Important Notes

- **Also possible to type a path when vs code asks for a name, this works like vs code default behavior, any names before last '/' consider as path, and the rest is your dynamic name**
    - input: `test/test2/inputName`: path: `test/test2`, name: `inputName` 
<br >

- ***every time you create/remove templates you need to sync the files***
<br>

- When choosing an option vs code read files and folders so make sure file exist (you may need to sync for every project).