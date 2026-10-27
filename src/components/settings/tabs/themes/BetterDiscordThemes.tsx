/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Heading } from "@components/Heading";
import { Link } from "@components/Link";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import type { BetterDiscordTheme } from "@main/betterDiscordThemes";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import { Select, showToast, TextInput, useMemo, useState } from "@webpack/common";

const cl = classNameFactory("vc-settings-theme-bd-");
const formatCount = new Intl.NumberFormat("en-US", { notation: "compact" }).format;

const SortOptions = {
    downloads: { label: "Most Downloaded", compare: (a: BetterDiscordTheme, b: BetterDiscordTheme) => b.downloads - a.downloads },
    likes: { label: "Most Liked", compare: (a: BetterDiscordTheme, b: BetterDiscordTheme) => b.likes - a.likes },
    name: { label: "Name", compare: (a: BetterDiscordTheme, b: BetterDiscordTheme) => a.name.localeCompare(b.name) },
} as const;
type SortKey = keyof typeof SortOptions;

interface BetterDiscordThemesProps {
    installedFileNames: string[];
    onInstalled(fileName: string): void;
}

export function BetterDiscordThemesSection({ installedFileNames, onInstalled }: BetterDiscordThemesProps) {
    const [result, , pending] = useAwaiter(VencordNative.themes.getBetterDiscordThemes);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<SortKey>("downloads");
    const [installing, setInstalling] = useState<number | null>(null);

    const themes = useMemo(() => {
        if (!result?.success) return [];

        const query = search.trim().toLowerCase();
        return result.themes
            .filter(t => !query || [t.name, t.author, t.description, ...t.tags].some(s => s.toLowerCase().includes(query)))
            .sort(SortOptions[sort].compare);
    }, [result, search, sort]);

    async function install(theme: BetterDiscordTheme) {
        setInstalling(theme.id);
        const res = await VencordNative.themes.installBetterDiscordTheme(theme.id, theme.name);
        setInstalling(null);

        if (!res.success) {
            showToast({ text: res.error, variant: "critical" });
            return;
        }

        onInstalled(res.fileName);
        showToast({ text: `Installed and enabled ${theme.name}!`, variant: "success" });
    }

    return (
        <>
            <Heading className={Margins.top20}>BetterDiscord Themes</Heading>
            <Paragraph className={Margins.bottom16}>
                Browse every theme from the <Link href="https://betterdiscord.app/themes">BetterDiscord theme store</Link>. Installing a theme downloads it into your themes folder and enables it.
            </Paragraph>

            {IS_WEB ? (
                <Notice.Info>Browsing BetterDiscord themes is only available in the desktop version of Starcord.</Notice.Info>
            ) : pending ? (
                <Paragraph color="text-muted">Loading BetterDiscord themes...</Paragraph>
            ) : !result?.success ? (
                <Notice.Danger>{result?.error ?? "Failed to load BetterDiscord themes."}</Notice.Danger>
            ) : (
                <>
                    <div className="vc-settings-theme-filter-row">
                        <TextInput
                            placeholder={`Search ${result.themes.length} BetterDiscord themes...`}
                            value={search}
                            onChange={setSearch}
                        />
                        <div>
                            <Select
                                options={Object.entries(SortOptions).map(([value, { label }]) => ({ label, value }))}
                                select={setSort}
                                isSelected={v => v === sort}
                                serialize={v => v}
                            />
                        </div>
                    </div>

                    {themes.length === 0 ? (
                        <Paragraph color="text-muted" className={Margins.top16}>No BetterDiscord themes match your search.</Paragraph>
                    ) : (
                        <div className={classes("vc-settings-theme-grid", Margins.top16)}>
                            {themes.map(theme => {
                                const installed = installedFileNames.includes(theme.fileName);

                                return (
                                    <Card key={theme.id} className={cl("card")}>
                                        {theme.thumbnail && (
                                            <img className={cl("thumbnail")} src={theme.thumbnail} alt="" loading="lazy" />
                                        )}
                                        <div className={cl("body")}>
                                            <Paragraph weight="semibold">{theme.name}</Paragraph>
                                            <Paragraph size="sm" color="text-muted">by {theme.author}</Paragraph>
                                            <Paragraph size="sm" className={cl("description")}>{theme.description}</Paragraph>
                                            <div className={cl("footer")}>
                                                <Paragraph size="sm" color="text-muted">
                                                    {formatCount(theme.downloads)} downloads · {formatCount(theme.likes)} likes
                                                </Paragraph>
                                                <Button
                                                    size="small"
                                                    variant={installed ? "secondary" : "primary"}
                                                    disabled={installing !== null}
                                                    onClick={() => install(theme)}
                                                >
                                                    {installing === theme.id ? "Installing..." : installed ? "Reinstall" : "Install"}
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </>
    );
}
