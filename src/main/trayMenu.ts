/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { gitHash, gitRemote } from "@shared/vencordUserAgent";
import { BrowserWindow, Menu, MenuItemConstructorOptions, shell } from "electron";
import aboutHtml from "file://about.html?minify";

import { SETTINGS_DIR, THEMES_DIR } from "./utils/constants";

function findInsertIndex(template: MenuItemConstructorOptions[]): number {
    const openIndex = template.findIndex(item => {
        const label = item.label?.toLowerCase() ?? "";
        return label.includes("open") || label.includes("show");
    });
    return openIndex !== -1 ? openIndex + 1 : 0;
}

function isTrayMenu(template: MenuItemConstructorOptions[]): boolean {
    if (!template.length) return false;

    const hasOpenOrShow = template.some(item => {
        const label = item.label?.toLowerCase() ?? "";
        return label.includes("open") || label.includes("show");
    });

    const hasQuit = template.some(item =>
        item.label?.toLowerCase().includes("quit") || item.role === "quit"
    );

    const isNotAppMenu = !template.some(item =>
        item.label === "&File" || item.label === "File" ||
        item.label === "&Edit" || item.label === "Edit"
    );

    return hasOpenOrShow && hasQuit && isNotAppMenu;
}

let aboutWindow: BrowserWindow | null = null;

function openAboutWindow() {
    if (aboutWindow) {
        aboutWindow.focus();
        return;
    }

    aboutWindow = new BrowserWindow({
        center: true,
        autoHideMenuBar: true,
        height: 525,
        width: 900
    });

    aboutWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    aboutWindow.webContents.on("will-navigate", (e, url) => {
        e.preventDefault();
        shell.openExternal(url);
    });

    const aboutParams = aboutHtml
        .replaceAll("{{VERSION}}", VERSION)
        .replaceAll("{{GIT_HASH}}", gitHash) // change to gitHashShort if/when its added
        .replaceAll("{{GIT_REMOTE}}", gitRemote);
    const base64Html = Buffer.from(aboutParams).toString("base64");
    aboutWindow.loadURL(`data:text/html;base64,${base64Html}`);
    aboutWindow.on("closed", () => {
        aboutWindow = null;
    });
}

function createVencordMenuItems(): MenuItemConstructorOptions[] {
    return [
        {
            label: "Starcord",
            submenu: [
                {
                    label: "About Starcord",
                    click: () => openAboutWindow()
                },
                { type: "separator" },
                {
                    label: "Open Settings Folder",
                    click: () => shell.openPath(SETTINGS_DIR)
                },
                {
                    label: "Open Themes Folder",
                    click: () => shell.openPath(THEMES_DIR)
                }
            ]
        },
    ];
}

export function patchTrayMenu(): void {
    const originalBuildFromTemplate = Menu.buildFromTemplate;

    Menu.buildFromTemplate = function (template: MenuItemConstructorOptions[]) {
        const alreadyPatched = template.some(item => item.label === "Starcord");
        if (isTrayMenu(template) && !alreadyPatched) {
            const insertIndex = findInsertIndex(template);
            const vencordItems = createVencordMenuItems();
            template.splice(insertIndex, 0, ...vencordItems);
        }

        return originalBuildFromTemplate.call(this, template);
    };
}
