/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Badge images and descriptions from https://github.com/mezotv/discord-badges (MIT License, Copyright (c) 2022 Dominik K.)
const ASSETS = "https://cdn.jsdelivr.net/gh/mezotv/discord-badges@83a26125fdbd67b62d67128f235440e9b07c0a51/assets";

export interface BadgeInfo {
    id: string;
    name: string;
    detail: string;
    icon: string;
    /** Badges in the same group are tiers of one badge, only the highest one is kept */
    group?: string;
    /** Only shown on your own client, never to other Starcord users */
    localOnly?: boolean;
    /** Ids of real Discord badges this badge hides, so a real Nitro Silver badge makes way for a picked Nitro Opal */
    replaces?: string[];
}

export interface BadgeCategory {
    name: string;
    badges: BadgeInfo[];
}

// Real Discord badge ids, a picked badge hides all real badges of its group
const RealBadgeGroups: Record<string, string[]> = {
    "nitro": ["premium", ...[1, 3, 6, 12, 24, 36, 60, 72].map(months => `premium_tenure_${months}_month_v2`)],
    "boost": Array.from({ length: 9 }, (_, i) => `guild_booster_lvl${i + 1}`),
    "hypesquad-house": ["hypesquad_house_1", "hypesquad_house_2", "hypesquad_house_3"],
    "bug-hunter": ["bug_hunter_level_1", "bug_hunter_level_2"],
    "gifting": ["gifting"],
    "account-age": ["account_age"],
    "streaming": ["streaming"],
    "game-time": ["game_time"],
    "game-variety": ["game_variety"],
};

const badge = (id: string, name: string, path: string, detail: string, extra?: Partial<BadgeInfo>): BadgeInfo =>
    ({ id, name, detail, icon: `${ASSETS}/${path}`, ...extra, replaces: extra?.replaces ?? (extra?.group ? RealBadgeGroups[extra.group] : undefined) });

const tiers = (prefix: string, folder: string, names: string[], details: string[]) =>
    names.map((name, i) => badge(`${prefix}-${name.toLowerCase()}`, name, `${folder}/${name.toLowerCase()}.svg`, details[i], { group: prefix }));

// Ordered like Discord orders badges on profiles, Nitro always comes first
export const BadgeCategories: BadgeCategory[] = [
    {
        name: "Nitro",
        badges: [
            badge("nitro-basic", "Nitro Basic", "discord-nitro-basic.svg", "Subscribed to Discord Nitro Basic", { group: "nitro" }),
            badge("nitro", "Subscriber", "discord-nitro.svg", "Subscribed to Discord Nitro", { group: "nitro" }),
            ...["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Emerald", "Ruby", "Opal"].map((name, i) =>
                badge(`nitro-${name.toLowerCase()}`, `Nitro ${name}`, `subscriptions/badges/${name.toLowerCase()}.png`,
                    `Subscribed to Nitro for ${["1 month", "3 months", "6 months", "12 months", "24 months", "36 months", "60 months", "72 months or more"][i]}`,
                    { group: "nitro" }))
        ]
    },
    {
        name: "Server Boosting",
        badges: ["1 Month", "2 Months", "3 Months", "6 Months", "9 Months", "1 Year", "1 Year & 3 Months", "1 Year & 6 Months", "2 Years"].map((length, i) =>
            badge(`boost-${i + 1}`, `Server Booster (${length})`, `boosts/discord-boost-${i + 1}.svg`, `Boosted a server for ${length.toLowerCase()} straight`, { group: "boost" }))
    },
    {
        name: "General",
        badges: [
            // never shared, so nobody can pretend to be Discord staff to other Starcord users
            badge("staff", "Discord Staff", "discord-staff.svg", "Works at Discord", { localOnly: true, replaces: ["staff", "staff_hidden", "staff_personal"] }),
            badge("hypesquad-events", "HypeSquad Events", "hype-squad-events.svg", "Attended or represented Discord at events", { replaces: ["hypesquad"] }),
            badge("hypesquad-bravery", "HypeSquad Bravery", "hype-squad-bravery.svg", "Joined the HypeSquad Bravery house", { group: "hypesquad-house" }),
            badge("hypesquad-brilliance", "HypeSquad Brilliance", "hype-squad-brilliance.svg", "Joined the HypeSquad Brilliance house", { group: "hypesquad-house" }),
            badge("hypesquad-balance", "HypeSquad Balance", "hype-squad-balance.svg", "Joined the HypeSquad Balance house", { group: "hypesquad-house" }),
            badge("partner", "Partnered Server Owner", "discord-partner.svg", "Owns a server in the Discord Partner Program", { replaces: ["partner"] }),
            badge("moderator-alumni", "Moderator Programs Alumni", "discord-mod.svg", "Was part of Discord's moderator programs", { replaces: ["certified_moderator"] }),
            badge("certified-moderator", "Discord Certified Moderator", "old-discord-mod.svg", "Passed the Discord Moderator Academy exam", { replaces: ["certified_moderator"] }),
            badge("early-bot-developer", "Early Verified Bot Developer", "discord-bot-dev.svg", "Owned a verified bot before August 19, 2020", { replaces: ["verified_developer"] }),
            badge("active-developer", "Active Developer", "active-developer.svg", "Owns an application that was used recently", { replaces: ["active_developer"] }),
            badge("early-supporter", "Early Supporter", "discord-early-supporter.svg", "Subscribed to Nitro before October 10, 2018", { replaces: ["early_supporter"] }),
            badge("bug-hunter", "Discord Bug Hunter", "discord-bug-hunter-green.svg", "Helped find and squash bugs in Discord", { group: "bug-hunter" }),
            badge("bug-hunter-gold", "Discord Bug Hunter", "discord-bug-hunter-gold.svg", "Reached the highest Bug Hunter level", { group: "bug-hunter" }),
            badge("quest", "Completed a Quest", "quest.png", "Completed a Quest from the Gift Inventory", { replaces: ["quest_completed"] }),
            badge("orb", "Orbs Apprentice", "orb.svg", "Bought from the Orbs Exclusives shop", { replaces: ["orb_profile_badge"] }),
            badge("last-meadow", "Last Meadow Online", "last-meadow.png", "Played Last Meadow Online"),
            badge("lootbox-clown", "A clown, for a limited time", "special/discord-lootbox.svg", "Unlocked every Lootbox reward on April Fools 2024"),
            badge("legacy-username", "Originally known as", "username.png", "Had a username with a discriminator before the new username system", { replaces: ["legacy_username"] }),
            badge("hypesquad-balance-koth", "HypeSquad Balance (King of the Hat)", "koth-hype-squad-balance.svg", "Balance badge from the King of the Hat event in 2019", { group: "hypesquad-house" }),
            badge("hypesquad-balance-gold", "HypeSquad Balance (Snowsgiving)", "golden-hype-squad-balance.svg", "Golden Balance badge from Snowsgiving 2019", { group: "hypesquad-house" }),
        ]
    },
    {
        name: "Gifting",
        badges: ["Patron", "Champion", "Luminary", "Icon", "Hero", "Legend"].map((name, i) =>
            badge(`gifting-${name.toLowerCase()}`, name, `gifting/${name.toLowerCase()}.png`, `Sent ${[1, 2, 3, 6, 10, 20][i]} gift${i ? "s" : ""} from the Shop or a Wishlist`, { group: "gifting" }))
    },
    {
        name: "Account Age",
        badges: tiers("account-age", "account-age",
            ["Seed", "Sprout", "Bud", "Sapling", "Blossom", "Redwood", "Sequoia", "Bristlecone", "Stromatolite", "Primordial"],
            ["1 year", "2 years", "3 years", "4 years", "5 years", "6 years", "7 years", "8 years", "9 years", "10 years or more"].map(age => `Had a Discord account for ${age}`))
    },
    {
        name: "Streaming",
        badges: tiers("streaming", "streaming",
            ["Newcomer", "Fledgling", "Breakout", "Standout", "Trendsetter", "Headliner", "Star", "Sensation", "Visionary", "Phenomenon"],
            ["1", "5", "20", "75", "150", "300", "500", "1,000", "2,000", "5,000+"].map(hours => `Streamed to other users for ${hours} hours`))
    },
    {
        name: "Game Time",
        badges: tiers("game-time", "game-time",
            ["Casual", "Recreational", "Dedicated", "Committed", "Serious", "Devoted", "Seasoned", "Ironclad", "Unshakeable", "Eternal"],
            ["1", "5", "20", "75", "150", "300", "500", "1,000", "2,000", "5,000+"].map(hours => `Played ${hours} hours of games with Discord open`))
    },
    {
        name: "Game Variety",
        badges: tiers("game-variety", "game-variety",
            ["Sampler", "Dabbler", "Enthusiast", "Ranger", "Explorer", "Adventurer", "Voyager", "Maverick", "Polymath", "Universalist"],
            ["2", "5", "10", "15", "20", "30", "40", "60", "80", "100+"].map(games => `Played ${games} different games with Discord open`))
    },
];

/** Groups whose badges aren't tiers, picking one simply replaces the other */
export const UnrankedGroups = new Set(["hypesquad-house"]);

export const AllBadges = BadgeCategories.flatMap(category => category.badges);
export const BadgesById = new Map(AllBadges.map(b => [b.id, b]));
const BadgeOrder = new Map(AllBadges.map((b, i) => [b.id, i]));

/** Puts badges in Discord's order and keeps only the highest tier of each group, tiers are listed from lowest to highest */
export function arrangeBadges(ids: Iterable<string>) {
    const highestInGroup = new Map<string, string>();
    const arranged = [...new Set(ids)]
        .filter(id => BadgesById.has(id))
        .sort((a, b) => BadgeOrder.get(a)! - BadgeOrder.get(b)!);

    for (const id of arranged) {
        const { group } = BadgesById.get(id)!;
        if (group) highestInGroup.set(group, id);
    }

    return arranged.filter(id => {
        const { group } = BadgesById.get(id)!;
        return !group || highestInGroup.get(group) === id;
    });
}
