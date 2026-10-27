/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type FoodType = "hay" | "fish";

interface FeedingOptions {
    food: FoodType;
    buddyId: string;
    /** How close the food has to be to the buddy's center to get eaten */
    eatRadius: number;
    scale: number;
    onScaleChange(scale: number): void;
}

const PIXEL = 3;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const GROWTH_PER_MEAL = 0.12;
const STARVE_AFTER = 90_000;
const SHRINK_PER_STEP = 0.0008;
const GROUND_FOOD_LIFETIME = 20_000;
const EDGE_GAP = 12;

// Anything the food pile must never cover. Message rows and list rows count too, since hovering them shows buttons.
const BLOCKING_SELECTOR = [
    "button", "a[href]", "input", "textarea", "select", "summary", "[contenteditable='true']",
    "[role='button']", "[role='link']", "[role='tab']", "[role='menuitem']", "[role='switch']",
    "[role='checkbox']", "[role='radio']", "[role='option']", "[role='slider']", "[role='textbox']",
    "[role='treeitem']", "[role='listitem']", "[role='article']", "li[id^='chat-messages']"
].join(",");

const Palettes = {
    hay: { o: "#5c4307", d: "#8f6e12", m: "#c9a227", l: "#e8c547", h: "#f6e08a" },
    fish: { o: "#1f3a5f", l: "#5aa9e6", b: "#cfe8ff", e: "#0d0d0d", f: "#3d7fbf" },
} as const;

const FISH = [
    "..ooooo......",
    ".olllllo...oo",
    "olelllllo.ofo",
    "olllllllooffo",
    "obbbbbbbo.ofo",
    ".obbbbbo...oo",
    "..ooooo......",
];

const HAY_STRAND = [
    "h.......",
    ".ll....m",
    "..mllll.",
    "....dl..",
];

function drawGrid(ctx: CanvasRenderingContext2D, grid: string[], palette: Record<string, string>, dx = 0, dy = 0, mirror = false) {
    const width = Math.max(...grid.map(row => row.length));
    grid.forEach((row, y) => {
        [...row].forEach((char, x) => {
            const color = palette[char];
            if (!color) return;
            ctx.fillStyle = color;
            ctx.fillRect(dx + (mirror ? width - 1 - x : x), dy + y, 1, 1);
        });
    });
}

function makeSprite(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) draw(ctx);
    return { url: canvas.toDataURL(), width: width * PIXEL, height: height * PIXEL };
}

function drawHayStack(ctx: CanvasRenderingContext2D) {
    const { o, d, m, l, h } = Palettes.hay;
    const width = 22, height = 15, top = 3;
    const inside = (x: number, y: number) => {
        if (y < top || y >= height) return false;
        const half = Math.round(11 * Math.sqrt((y - top + 1) / (height - top)));
        return x >= 11 - half && x < 11 + half;
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!inside(x, y)) continue;
            const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || y === height - 1;
            const noise = (x * 7 + y * 13 + ((x * y) % 5)) % 7;
            ctx.fillStyle = edge ? o : y > height - 4 ? (noise < 3 ? d : m) : [d, m, m, l, l, h, m][noise];
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // straws sticking out of the top
    for (const [x, length, color] of [[7, 3, l], [10, 2, h], [12, 3, m], [15, 2, l]] as const) {
        ctx.fillStyle = color;
        ctx.fillRect(x, top - length + 1, 1, length);
    }
}

function createSprites(food: FoodType) {
    if (food === "hay") {
        return {
            pile: makeSprite(22, 15, drawHayStack),
            piece: makeSprite(8, 4, ctx => drawGrid(ctx, HAY_STRAND, Palettes.hay)),
        };
    }

    return {
        pile: makeSprite(26, 13, ctx => {
            drawGrid(ctx, FISH, Palettes.fish, 0, 6);
            drawGrid(ctx, FISH, Palettes.fish, 13, 6, true);
            drawGrid(ctx, FISH, Palettes.fish, 6, 0);
        }),
        piece: makeSprite(13, 7, ctx => drawGrid(ctx, FISH, Palettes.fish)),
    };
}

function styleSprite(el: HTMLElement, sprite: { url: string; width: number; height: number; }, zIndex: number) {
    Object.assign(el.style, {
        position: "fixed",
        width: `${sprite.width}px`,
        height: `${sprite.height}px`,
        backgroundImage: `url(${sprite.url})`,
        backgroundSize: "100% 100%",
        imageRendering: "pixelated",
        zIndex: String(zIndex),
        userSelect: "none",
    });
}

function isBlocking(el: Element) {
    return el.closest(BLOCKING_SELECTOR) != null || getComputedStyle(el).cursor === "pointer";
}

export function startFeeding({ food, buddyId, eatRadius, scale: initialScale, onScaleChange }: FeedingOptions) {
    const sprites = createSprites(food);
    const foodName = food === "hay" ? "hay" : "a fish";

    let scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, initialScale));
    let savedScale = scale;
    let lastMealAt = Date.now();

    const pile = document.createElement("div");
    pile.id = "vc-cursor-buddy-food-pile";
    pile.title = `Hold to grab ${foodName}`;
    pile.ariaHidden = "true";
    styleSprite(pile, sprites.pile, 2147483646);
    pile.style.cursor = "grab";
    pile.style.visibility = "hidden";
    document.body.appendChild(pile);

    let held: HTMLElement | null = null;
    const groundFood = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

    function isSpotClear(right: number, bottom: number) {
        const { width, height } = sprites.pile;
        const left = window.innerWidth - right - width;
        const top = window.innerHeight - bottom - height;
        if (left < 0 || top < 0) return false;

        for (let ix = 0; ix <= 4; ix++) {
            for (let iy = 0; iy <= 3; iy++) {
                const x = left + (width * ix) / 4;
                const y = top + (height * iy) / 3;
                const below = document.elementsFromPoint(Math.min(x, window.innerWidth - 1), Math.min(y, window.innerHeight - 1))
                    .find(el => el !== pile && !pile.contains(el));
                if (below && isBlocking(below)) return false;
            }
        }
        return true;
    }

    function findSpot(maxRight: number, maxBottom: number) {
        for (let right = EDGE_GAP; right <= maxRight; right += 24) {
            for (let bottom = EDGE_GAP; bottom <= maxBottom; bottom += 16) {
                if (isSpotClear(right, bottom)) return { right, bottom };
            }
        }
        return null;
    }

    function placePile() {
        const current = pile.style.visibility === "visible"
            ? { right: parseFloat(pile.style.right), bottom: parseFloat(pile.style.bottom) }
            : null;
        if (current && isSpotClear(current.right, current.bottom)) return;

        const spot = findSpot(window.innerWidth / 2, window.innerHeight / 2)
            ?? findSpot(window.innerWidth - sprites.pile.width, window.innerHeight - sprites.pile.height);

        if (!spot) {
            pile.style.visibility = "hidden";
            return;
        }

        pile.style.right = `${spot.right}px`;
        pile.style.bottom = `${spot.bottom}px`;
        pile.style.visibility = "visible";
    }

    function moveFood(el: HTMLElement, x: number, y: number) {
        el.style.left = `${x - sprites.piece.width / 2}px`;
        el.style.top = `${y - sprites.piece.height / 2}px`;
    }

    function onHeldMove(e: MouseEvent) {
        if (held) moveFood(held, e.clientX, e.clientY);
    }

    function stopHolding() {
        document.removeEventListener("mousemove", onHeldMove);
        document.removeEventListener("mouseup", onRelease);
    }

    function removeFood(el: HTMLElement) {
        clearTimeout(groundFood.get(el));
        groundFood.delete(el);
        el.remove();
    }

    function onRelease() {
        stopHolding();
        if (!held) return;

        const dropped = held;
        held = null;
        dropped.style.opacity = "0.85";
        groundFood.set(dropped, setTimeout(() => removeFood(dropped), GROUND_FOOD_LIFETIME));
    }

    function onPileMouseDown(e: MouseEvent) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        if (held) removeFood(held);
        held = document.createElement("div");
        held.ariaHidden = "true";
        styleSprite(held, sprites.piece, 2147483646);
        held.style.pointerEvents = "none";
        moveFood(held, e.clientX, e.clientY);
        document.body.appendChild(held);

        document.addEventListener("mousemove", onHeldMove);
        document.addEventListener("mouseup", onRelease);
    }

    function applyScale() {
        const buddy = document.getElementById(buddyId);
        if (buddy) buddy.style.transform = `scale(${scale})`;

        if (Math.abs(scale - savedScale) >= 0.02) {
            savedScale = scale;
            onScaleChange(scale);
        }
    }

    function showHeart(x: number, y: number) {
        const heart = document.createElement("div");
        heart.textContent = "♥";
        heart.ariaHidden = "true";
        Object.assign(heart.style, {
            position: "fixed",
            left: `${x}px`,
            top: `${y - 24 * scale}px`,
            color: "#ed4245",
            font: "bold 16px monospace",
            pointerEvents: "none",
            zIndex: "2147483647",
            transition: "transform 0.7s ease-out, opacity 0.7s ease-out",
        });
        document.body.appendChild(heart);
        requestAnimationFrame(() => {
            heart.style.transform = "translateY(-20px)";
            heart.style.opacity = "0";
        });
        setTimeout(() => heart.remove(), 750);
    }

    function eat(el: HTMLElement, x: number, y: number) {
        if (el === held) {
            stopHolding();
            held = null;
        }
        removeFood(el);

        scale = Math.min(MAX_SCALE, scale + GROWTH_PER_MEAL);
        lastMealAt = Date.now();
        applyScale();
        showHeart(x, y);
    }

    function onFrame(x: number, y: number, walking: boolean) {
        for (const el of [held, ...groundFood.keys()]) {
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            const distance = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
            if (distance <= eatRadius) eat(el, x, y);
        }

        if (walking && Date.now() - lastMealAt > STARVE_AFTER && scale > MIN_SCALE) {
            scale = Math.max(MIN_SCALE, scale - SHRINK_PER_STEP);
            applyScale();
        }
    }

    pile.addEventListener("mousedown", onPileMouseDown);
    window.addEventListener("resize", placePile);
    const placementInterval = setInterval(placePile, 1000);
    placePile();
    requestAnimationFrame(applyScale);

    return {
        onFrame,
        destroy() {
            stopHolding();
            clearInterval(placementInterval);
            window.removeEventListener("resize", placePile);
            held?.remove();
            held = null;
            [...groundFood.keys()].forEach(removeFood);
            pile.remove();
            onScaleChange(scale);
        }
    };
}
