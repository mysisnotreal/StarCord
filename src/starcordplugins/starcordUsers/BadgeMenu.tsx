/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { Menu, Popout, showToast, useRef, useState } from "@webpack/common";

import { logger, uploadBadges } from "./api";
import { arrangeBadges, BadgeCategories, BadgeInfo, BadgesById, UnrankedGroups } from "./badges";
import { settings } from "./settings";

const BADGES_KEY: ["badges"] = ["badges"];

let uploadTimeout: ReturnType<typeof setTimeout> | undefined;

function setBadges(badges: string[]) {
    settings.store.badges = arrangeBadges(badges);

    clearTimeout(uploadTimeout);
    uploadTimeout = setTimeout(() => {
        uploadBadges(settings.store.badges ?? []).catch(err => {
            logger.error("Failed to save badges", err);
            showToast({ text: err instanceof Error ? err.message : "Couldn't save your badges", variant: "critical" });
        });
    }, 2500);
}

function toggleBadge(badges: string[], id: string) {
    if (badges.includes(id)) return setBadges(badges.filter(b => b !== id));

    const { group } = BadgesById.get(id)!;
    if (group && UnrankedGroups.has(group)) badges = badges.filter(b => BadgesById.get(b)!.group !== group);

    const next = arrangeBadges([...badges, id]);
    if (!next.includes(id)) {
        showToast({ text: `You already have a higher ${BadgesById.get(id)!.name.split(" ")[0]} badge. Remove it first to pick a lower one.` });
        return;
    }
    setBadges(next);
}

function Toggle({ enabled }: { enabled: boolean; }) {
    return (
        <svg viewBox="0 0 34 20" width={34} height={20} aria-hidden="true">
            <rect width="34" height="20" rx="10" fill={enabled ? "#23a55a" : "#80848e"} />
            <circle cx={enabled ? 24 : 10} cy="10" r="7" fill="#fff" />
        </svg>
    );
}

const ToggleOn = () => <Toggle enabled />;
const ToggleOff = () => <Toggle enabled={false} />;

function BadgeIcon() {
    return (
        <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
            <path fill="currentColor" d="M12 1.5 4 4.8v6.1c0 5 3.4 9.6 8 11.1 4.6-1.5 8-6.1 8-11.1V4.8l-8-3.3Zm0 4.6 1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5L12 6.1Z" />
        </svg>
    );
}

// a plain function and not a component, Discord's menu only accepts its own items as children
function badgeItem(badge: BadgeInfo, badges: string[]) {
    return (
        <Menu.MenuItem
            key={badge.id}
            id={`vc-starcord-badge-${badge.id}`}
            label={badge.name}
            leadingAccessory={{ type: "image", src: badge.icon }}
            icon={badges.includes(badge.id) ? ToggleOn : ToggleOff}
            dontCloseOnAction
            action={() => toggleBadge(badges, badge.id)}
        />
    );
}

function BadgeMenu({ onClose }: { onClose(): void; }) {
    const { badges = [] } = settings.use(BADGES_KEY);

    return (
        <Menu.Menu navId="vc-starcord-badges" onClose={onClose} aria-label="Profile Badges">
            <Menu.MenuGroup label="Profile Badges">
                {BadgeCategories.map(category => {
                    const count = category.badges.filter(b => badges.includes(b.id)).length;
                    return (
                        <Menu.MenuItem
                            key={category.name}
                            id={`vc-starcord-badges-${category.name.toLowerCase().replace(/\W+/g, "-")}`}
                            label={count ? `${category.name} (${count} on)` : category.name}
                        >
                            {category.badges.map(badge => badgeItem(badge, badges))}
                        </Menu.MenuItem>
                    );
                })}
            </Menu.MenuGroup>
            <Menu.MenuSeparator />
            <Menu.MenuItem
                id="vc-starcord-badges-clear"
                label="Turn Off All Badges"
                color="danger"
                disabled={!badges.length}
                action={() => setBadges([])}
            />
        </Menu.Menu>
    );
}

export function BadgeMenuButton() {
    const buttonRef = useRef(null);
    const [show, setShow] = useState(false);

    return (
        <Popout
            position="bottom"
            align="center"
            spacing={0}
            animation={Popout.Animation.NONE}
            shouldShow={show}
            onRequestClose={() => setShow(false)}
            targetElementRef={buttonRef}
            renderPopout={() => <BadgeMenu onClose={() => setShow(false)} />}
        >
            {(_, { isShown }) => (
                <HeaderBarButton
                    ref={buttonRef}
                    onClick={() => setShow(v => !v)}
                    tooltip={isShown ? null : "Profile Badges"}
                    icon={BadgeIcon}
                    selected={isShown}
                />
            )}
        </Popout>
    );
}
