/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PaletteCommand } from "../api/types";
import { GearIcon, PaintIcon, RestartIcon } from "../ui/icons";
import { openSettingsPage } from "./openSettings";

const SECTION = "Starcord";

export const starcordCommands: PaletteCommand[] = [
    {
        id: "starcord.settings",
        title: "Open Starcord Settings",
        section: SECTION,
        keywords: ["starcord", "vencord", "settings"],
        icon: GearIcon,
        actions: [{
            id: "run",
            label: "Open Starcord Settings",
            run: () => void openSettingsPage("starcord_main")
        }]
    },
    {
        id: "starcord.quickCss",
        title: "Open QuickCSS",
        section: SECTION,
        keywords: ["css", "quickcss", "editor", "style"],
        icon: PaintIcon,
        actions: [{
            id: "run",
            label: "Open QuickCSS",
            run: () => VencordNative.quickCss.openEditor()
        }]
    },
    {
        id: "starcord.restart",
        title: "Restart Discord",
        section: SECTION,
        keywords: ["restart", "reload", "refresh"],
        icon: RestartIcon,
        actions: [{
            id: "run",
            label: "Restart Discord",
            run: () => window.location.reload()
        }]
    }
];
