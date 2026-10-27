/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { BadgePosition, ProfileBadge } from "@api/Badges";
import { PlainSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { StarcordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin from "@utils/types";
import { User } from "@vencord/discord-types";
import { Tooltip, UserStore } from "@webpack/common";
import starcordIcon from "file://../../components/settings/tabs/vencord/starcord.png?base64";

import { getStarcordUser, hasJoined, isConfigured, joinStarcord, logger, refreshUsers, useStarcordUser } from "./api";
import { BadgeMenuButton } from "./BadgeMenu";
import { arrangeBadges, BadgesById } from "./badges";
import { NameEditorButton } from "./NameEditor";
import { attachNames, startNicknames, stopNicknames } from "./names";
import { settings } from "./settings";

const cl = classNameFactory("vc-starcord-users-");
const STARCORD_ICON = `data:image/png;base64,${starcordIcon}`;
const REFRESH_INTERVAL = 10 * 60_000;

let refreshInterval: ReturnType<typeof setInterval> | undefined;
let askTimeout: ReturnType<typeof setTimeout> | undefined;

function StarIcon() {
    return (
        <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
            <path fill="currentColor" d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.5 5.9 21l1.5-6.8-5.2-4.7 6.9-.7z" />
        </svg>
    );
}

const StarcordTag = ErrorBoundary.wrap(({ userId }: { userId: string; }) => {
    const user = useStarcordUser(userId);
    if (!user || !settings.store.showTags) return null;

    return (
        <Tooltip text={`Starcord User #${user.number}`}>
            {props => (
                <span {...props} className={cl("tag")}>
                    <StarIcon />
                    {user.number}
                </span>
            )}
        </Tooltip>
    );
}, { noop: true });

/** The picked badges shown on someone's profile, in Discord's order */
function shownBadges(userId: string) {
    const isSelf = userId === UserStore.getCurrentUser()?.id;
    const ids = arrangeBadges(isSelf ? settings.store.badges ?? [] : getStarcordUser(userId)?.badges ?? []);
    return ids.flatMap(id => {
        const badge = BadgesById.get(id);
        return badge && (isSelf || !badge.localOnly) ? [badge] : [];
    });
}

const StarcordBadges: ProfileBadge = {
    id: "starcord-users",
    position: BadgePosition.END,
    getBadges({ userId }) {
        const user = getStarcordUser(userId);
        const badges: ProfileBadge[] = shownBadges(userId).map(badge => ({
            id: `starcord-badge-${badge.id}`,
            description: badge.name,
            name: badge.name,
            detail: badge.detail,
            iconSrc: badge.icon,
        }));

        if (user) {
            badges.unshift({
                id: "starcord-user",
                description: `Starcord User #${user.number}`,
                name: "Starcord User",
                detail: `The #${user.number} person to join Starcord`,
                iconSrc: STARCORD_ICON,
                props: { style: { imageRendering: "pixelated" } },
            });
        }

        return badges;
    }
};

const WrappedBadgeMenuButton = ErrorBoundary.wrap(BadgeMenuButton, { noop: true });
const WrappedNameEditorButton = ErrorBoundary.wrap(NameEditorButton, { noop: true });

export default definePlugin({
    name: "StarcordUsers",
    description: "Shows which people use Starcord with a numbered star and badge, lets you pick Discord badges for your profile that other Starcord users can see, and lets you change your name for yourself.",
    tags: ["Appearance", "Friends"],
    authors: [StarcordDevs.Starcord],
    dependencies: ["MemberListDecoratorsAPI"],
    enabledByDefault: true,
    settings,

    patches: [
        {
            // Name and badge buttons, left of PlatformSpoofer's button which sits left of the help button
            find: '?"BACK_FORWARD_NAVIGATION":',
            replacement: {
                match: /(?=(?:Vencord\.Plugins\.plugins\["PlatformSpoofer"\]\.renderPlatformButton\(\),)?\i\?\(0,\i\.jsx\)\(\i,\{focusSectionProps:"HELP"===)/,
                replace: "$self.renderNameButton(),$self.renderBadgeButton(),"
            }
        },
        {
            // Puts the Starcord badge first and hides real badges that a picked badge replaces, like a real Nitro Silver when Nitro Opal is picked
            find: "getLegacyUsername(){",
            replacement: {
                match: /(?<=getBadges\(\)\{return)(\[.{0,300}?\])(?=\}getLegacyUsername)/,
                replace: " $self.arrangeProfileBadges(this,$1)"
            }
        },
        {
            // Your local display name and username
            find: "hasBouncedEmail=e.has_bounced_email??",
            replacement: {
                match: /(?<=this\.username=(\i)\.username\?\?"")/,
                replace: ",$self.attachNames(this,$1)"
            }
        },
        {
            // Voice channel users in the channel list
            find: ".VOICE_PANEL}}",
            replacement: {
                match: /children:\[\i\?\?\i\.\i\.getName\((\i)\)/,
                replace: "$&,$self.renderTag($1)"
            }
        }
    ],

    userProfileBadges: [StarcordBadges],

    renderMemberListDecorator({ user }) {
        return user ? <StarcordTag userId={user.id} /> : null;
    },

    renderBadgeButton: () => <WrappedBadgeMenuButton key="vc-starcord-badges" />,
    renderNameButton: () => <WrappedNameEditorButton key="vc-starcord-name" />,

    attachNames,

    arrangeProfileBadges(profile: { userId?: string; }, badges: { id?: string; }[]) {
        if (!profile?.userId) return badges;

        const replaced = new Set(shownBadges(profile.userId).flatMap(b => b.replaces ?? []));
        const kept = badges.filter(b => !b?.id || !replaced.has(b.id));

        const starcordBadge = kept.findIndex(b => b?.id === "starcord-user");
        if (starcordBadge > 0) kept.unshift(...kept.splice(starcordBadge, 1));
        return kept;
    },

    flux: {
        CONNECTION_OPEN({ user }: { user: { id: string; }; }) {
            settings.store.userId = user.id;
        }
    },

    renderTag(user?: User) {
        return user ? <StarcordTag key="vc-starcord-tag" userId={user.id} /> : null;
    },

    async start() {
        // names used to be set in the LocalUsername plugin
        const oldNames = PlainSettings.plugins.LocalUsername;
        if (oldNames && settings.store.displayName === undefined && settings.store.username === undefined) {
            settings.store.displayName = oldNames.displayName ?? "";
            settings.store.username = oldNames.username ?? "";
        }

        startNicknames();

        if (!isConfigured()) return;

        refreshUsers().catch(err => logger.error("Failed to load Starcord users", err));
        refreshInterval = setInterval(() => refreshUsers().catch(err => logger.error("Failed to load Starcord users", err)), REFRESH_INTERVAL);

        if (!settings.store.askedToJoin && !await hasJoined()) {
            settings.store.askedToJoin = true;
            askTimeout = setTimeout(() => joinStarcord(settings.store.badges ?? []), 5000);
        }
    },

    stop() {
        stopNicknames();
        clearInterval(refreshInterval);
        clearTimeout(askTimeout);
        refreshInterval = askTimeout = undefined;
    }
});
