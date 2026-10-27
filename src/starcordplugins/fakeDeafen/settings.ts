/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 hyyven and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export default definePluginSettings({
    fakeMute: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Appears as muted to others when fake deafen is enabled.",
    },
    fakeDeafen: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Appears as deafened to others when fake deafen is enabled.",
    },
    showButton: {
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
        description: "Show the fake deafen button in the account area.",
    },
    enableKeybind: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Enable the keybind (Ctrl+Shift+Q) to toggle fake deafen.",
    }
});
