/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { registerCommands } from "../api/registry";
import { loadCustomCommands, registerCustomCommands } from "./custom";
import { discordCommands } from "./discordActions";
import { navigationCommands } from "./navigation";
import { pluginCommands } from "./pluginManagement";
import { sendDmCommand } from "./sendDm";
import { starcordCommands } from "./starcord";

export async function registerBuiltinCommands() {
    registerCommands("CommandPalette.builtin", [
        ...navigationCommands,
        ...discordCommands,
        ...pluginCommands,
        ...starcordCommands,
        sendDmCommand
    ]);

    await loadCustomCommands();
    registerCustomCommands();
}
