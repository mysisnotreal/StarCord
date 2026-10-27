/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { StarcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { AccessibilityStore } from "@webpack/common";

import style from "./style.css?managed";

const isOptimized = () => Settings.optimizedDiscord;

function forceDisable(flag: string) {
    return (match: string, rest: string) => /}=.+/.test(rest) ? match : `${flag}:!1${rest}`;
}

export default definePlugin({
    name: "OptimizedDiscord",
    description: "Removes Discord's animations when Optimized Discord is enabled in the Starcord settings.",
    authors: [StarcordDevs.Starcord],
    required: true,
    hidden: true,

    patches: [
        {
            // Avatars, server icons, avatar decorations and more
            find: "canAnimate:",
            predicate: isOptimized,
            all: true,
            noWarn: true,
            replacement: {
                match: /canAnimate:.+?([,}].*?\))/g,
                replace: forceDisable("canAnimate")
            }
        },
        {
            // Status emojis
            find: "#{intl::GUILD_OWNER}),children:",
            predicate: isOptimized,
            replacement: {
                match: /(\.CUSTOM_STATUS.+?animateEmoji:)\i/,
                replace: "$1!1"
            }
        },
        {
            // Server banners
            find: "#{intl::DISCOVERABLE_GUILD_HEADER_PUBLIC_INFO}",
            predicate: isOptimized,
            replacement: {
                match: /(guildBanner:\i,animate:)\i(?=}\):null)/,
                replace: "$1!1"
            }
        },
        {
            // Gradient roles in chat
            find: "=!1,contentOnly:",
            predicate: isOptimized,
            replacement: {
                match: /animate:\i/,
                replace: "animate:!1"
            }
        },
        {
            // Gradient roles in member list
            find: '="left",className:',
            predicate: isOptimized,
            replacement: {
                match: /,animateGradient:/,
                replace: ",animateGradient:!1,_oldAnimateGradient:"
            }
        },
        {
            // Nameplates
            find: ".MINI_PREVIEW,[",
            predicate: isOptimized,
            replacement: {
                match: /animate:\i,loop:/,
                replace: "animate:!1,loop:!1,_loop:"
            }
        },
        {
            // Role gradients everywhere else
            find: "animateGradient:",
            predicate: isOptimized,
            all: true,
            noWarn: true,
            replacement: {
                match: /animateGradient:.+?([,}].*?\))/g,
                replace: forceDisable("animateGradient")
            }
        },
        {
            // Profile effects
            find: "bannerAdjustment,isHovering",
            predicate: isOptimized,
            noWarn: true,
            replacement: {
                match: /\i=function\((\i)\)\{(?=.{0,50}\.useReducedMotion\))/,
                replace: "$&if(!$1.shopPreview)return null;"
            }
        }
    ],

    start() {
        if (!isOptimized()) return;

        enableStyle(style);
        Object.defineProperty(AccessibilityStore, "useReducedMotion", { get: () => true, configurable: true });
        AccessibilityStore.emitChange();
    },

    stop() {
        disableStyle(style);
        Reflect.deleteProperty(AccessibilityStore, "useReducedMotion");
        AccessibilityStore.emitChange();
    }
});
