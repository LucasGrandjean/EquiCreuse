// ==UserScript==
// @name         EquiCreuse
// @namespace    https://github.com/LucasGrandjean/EquiCreuse
// @version      0.1
// @description  La Creuse gagne toujours.
// @author       Lucas Grandjean
// @license      AGPL3.0
// @match        https://*.herozerogame.com
// @require      https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/numeral.js/2.0.6/numeral.min.js
// @resource     BS5_CSS https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==


// ===== namespace.js =====

(function () {
    'use strict';

    window.EquiCreuseNS = window.EquiCreuseNS || {
        constants: {},
        keys: {},
        classes: {}
    };
})();

// ===== constants.js =====

(function () {
    'use strict';

    const ns = window.EquiCreuseNS;

    ns.constants.MISSION_FOCUS = Object.freeze({
        XP: 'XP',
        COINS: 'COINS',
        COMBAT: 'COMBAT',
        TIME: 'TIME',
        MIN_ENERGY: 'MIN_ENERGY',
        HC: 'HC',
        HEROBOOK_ITEM: 'HEROBOOK_ITEM',
        EVENT_ITEM: 'EVENT_ITEM',
        SLOTMACHINE: 'SLOTMACHINE'
    });

    ns.constants.QUEST_STAGES = Object.freeze({
        '1': 'At Home in Humphreydale',
        '2': 'Dirty Downtown',
        '3': 'Center of Granbury',
        '4': 'State Capitol',
        '5': 'Switzerland',
        '6': 'The Big Crumble',
        '7': 'Yoyo Island',
        '8': 'Gamble City',
        '9': 'Sillycon Valley',
        '10': 'Paris',
        '11': 'Yollywood',
        '12': 'Australia',
        '13': 'Yokio',
        '14': 'The Golden Desert'
    });
})();

// ===== storage-keys.js =====

(function () {
    'use strict';

    const ns = window.EquiCreuseNS;

    ns.keys = Object.freeze({
        missionFocus: 'mission-focus',
        fps: 'fps',
        maxEnergyQuest: 'max-energy-quest',
        maxMotivationTrain: 'max-motivation-train',
        autoStartQuest: 'auto-start-quest',
        autoClaimQuest: 'quest-auto-claim',
        autoNextQuest: 'quest-auto-next',
        autoStartTrain: 'auto-start-train',
        autoClaimTrain: 'train-auto-claim',
        autoNextTrain: 'train-auto-next',
        autoRedeemVoucherLater: 'auto-redeem-voucher-later',
        autoDismissLevelUp: 'auto-dismiss-level-up',
        autoDismissPetLevelUp: 'auto-dismiss-pet-level-up',
        questSenseBooster: 'sense-booster',
        trainSenseBooster: 'train-sense-booster',
        autoTrain: 'auto-train',
        trainFocusOrder: 'train-focus-order',
        quest_status: 'quest-status'
    });
})();

// ===== app.js =====

(function () {
    'use strict';

    const ns = window.EquiCreuseNS;
    const {MISSION_FOCUS} = ns.constants;
    const keys = ns.keys;

    class EquiCreuse {
        constructor() {
            this.currentQuests = [];
            this.currentTrains = [];
            this.trainingEnergy = 0;
            this.questStatus = 0;
            this.trainStatus = 0;
            this.lastTrainingFinished = 0;
            this.questCompleteTimer = 0;
            this.serverTime = 0;
            this.motivationCount = 0;

            this.currentMissionFocus = GM_getValue(keys.missionFocus, MISSION_FOCUS.XP);
            this.currentFPS = GM_getValue(keys.fps, 30);
            this.maxEnergyPerQuest = GM_getValue(keys.maxEnergyQuest, 20);
            this.maxMotivationPerTrain = GM_getValue(keys.maxMotivationTrain, 20);

            this.autoStartQuest = GM_getValue(keys.autoStartQuest, false);
            this.autoClaimQuest = GM_getValue(keys.autoClaimQuest, true);
            this.autoNextQuest = GM_getValue(keys.autoNextQuest, false);

            this.autoStartTrain = GM_getValue(keys.autoStartTrain, false);
            this.autoClaimTrain = GM_getValue(keys.autoClaimTrain, true);
            this.autoNextTrain = GM_getValue(keys.autoNextTrain, false);

            this.autoRedeemVoucherLater = GM_getValue(keys.autoRedeemVoucherLater, false);
            this.autoDismissLevelUp = GM_getValue(keys.autoDismissLevelUp, false);
            this.autoDismissPetLevelUp = GM_getValue(keys.autoDismissPetLevelUp, false);

            this.questSenseBoosterActive = GM_getValue(keys.questSenseBooster, false);
            this.trainSenseBoosterActive = GM_getValue(keys.trainSenseBooster, false);

            this.autoTrain = GM_getValue(keys.autoTrain, false);
            this.trainQuests = [];

            this.isMissionRunning = false;
            this.isTrainingRunning = false;
            this.uiSyncInterval = null;
            this.autoTrainingRetryTimeout = null;

            this.init();
        }

        /**
         * Initializes the script by applying styles, setting up the request proxy,
         * and binding lifecycle events.
         */
        init() {
            this.applyStyles();
            this.setupRequestProxy();

            document.addEventListener('DOMContentLoaded', this.onDOMContentLoaded.bind(this));
            window.addEventListener('load', this.onWindowLoad.bind(this));
        }

        /**
         * Applies external Bootstrap CSS to the page.
         */
        applyStyles() {
            const bs5Css = GM_getResourceText('BS5_CSS');
            GM_addStyle(bs5Css);
        }

        /**
         * Handles DOM content load, injects game hooks, and builds the custom UI.
         */
        onDOMContentLoaded() {
            document.Creuse = {};

            const embedScript = this.findScriptWithCode('function embedGame()');
            if (embedScript) {
                embedScript.parentNode.removeChild(embedScript);
            }

            this.injectFixedEmbedCode();
            this.createUI();

            console.log('[Creuse] Setup complete!');
        }

        /**
         * Starts the UI synchronization loop used to keep toggles, popups,
         * and action buttons synchronized with the live game UI.
         */
        onWindowLoad() {
            if (this.uiSyncInterval) {
                clearInterval(this.uiSyncInterval);
            }

            this.uiSyncInterval = setInterval(() => {
                try {
                    const questPanel = document.Creuse?.quest;
                    if (questPanel?._btnSenseBooster) {
                        const boosterVisible = questPanel._btnSenseBooster.get_visible();
                        const shouldHideBooster = this.questSenseBoosterActive;

                        if (boosterVisible === shouldHideBooster) {
                            questPanel._btnSenseBooster.set_visible(!shouldHideBooster);
                            questPanel._btnMostXPQuest?.set_visible(shouldHideBooster);
                            questPanel._btnMostGameCurrencyQuest?.set_visible(shouldHideBooster);
                        }
                    }

                    const trainPanel = document.Creuse?.train;
                    if (trainPanel?._btnTrainingSenseBooster) {
                        const boosterVisible = trainPanel._btnTrainingSenseBooster.get_visible();
                        const shouldHideBooster = this.trainSenseBoosterActive;

                        if (boosterVisible === shouldHideBooster) {
                            trainPanel._btnTrainingSenseBooster.set_visible(!shouldHideBooster);
                            trainPanel._btnMostGameCurrencyTrainingQuest?.set_visible(shouldHideBooster);
                            trainPanel._btnMostTrainingProgressTrainingQuest?.set_visible(shouldHideBooster);
                            trainPanel._btnMostXPTrainingQuest?.set_visible(shouldHideBooster);
                        }
                    }

                    if (this.autoRedeemVoucherLater && document.Creuse?.new_voucher?._btnClose) {
                        document.Creuse.new_voucher.handleClickClose();
                    }

                    if (this.autoDismissLevelUp && document.Creuse?.level_up?._btnClose) {
                        document.Creuse.level_up.handleClickClose();
                        document.Creuse.level_up.dispose?.();
                    }

                    if (this.autoDismissPetLevelUp && document.Creuse?.pet_lvl_up?._btnClose) {
                        document.Creuse.pet_lvl_up.handleClickClose();
                        document.Creuse.pet_lvl_up.dispose?.();
                    }

                    this.refreshActionButtons();
                } catch (e) {
                    console.error('[Creuse] Error during UI sync loop', e);
                }
            }, 500);
        }
    }

    ns.classes.EquiCreuse = EquiCreuse;
})();

// ===== ui.js =====

﻿(function () {
    'use strict';

    const ns = window.EquiCreuseNS;
    const EquiCreuse = ns.classes.EquiCreuse;
    const keys = ns.keys;

    /**
     * Normalizes a unix timestamp to seconds.
     * Accepts strings, numbers, and millisecond timestamps.
     */
    EquiCreuse.prototype.normalizeUnixTime = function (value) {
        const parsed = Number(value);

        if (!Number.isFinite(parsed) || parsed <= 0) {
            return 0;
        }

        // If value looks like milliseconds, convert to seconds
        return parsed > 9999999999 ? Math.floor(parsed / 1000) : Math.floor(parsed);
    };

    /**
     * Returns the current effective server time in seconds.
     * Based on the last known server time plus real elapsed local time.
     */
    EquiCreuse.prototype.getCurrentServerTime = function () {
        const baseServerTime = this.normalizeUnixTime(this.serverTime);

        if (!baseServerTime) {
            return 0;
        }

        const syncedAt = Number(this.serverTimeSyncedAt || 0);

        if (!syncedAt) {
            return baseServerTime;
        }

        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - syncedAt) / 1000));

        return baseServerTime + elapsedSeconds;
    };

    /**
     * Updates the current server time reference.
     */
    EquiCreuse.prototype.updateServerTime = function (time) {
        const normalized = this.normalizeUnixTime(time);

        if (!normalized) {
            return;
        }

        this.serverTime = normalized;
        this.serverTimeSyncedAt = Date.now();
    };

    /**
     * Returns the remaining quest timer in seconds.
     * The timer ends at questCompleteTimer.
     */
    EquiCreuse.prototype.getQuestTimerRemaining = function () {
        const questCompleteTimer = this.normalizeUnixTime(this.questCompleteTimer);
        const now = this.getCurrentServerTime();

        if (!questCompleteTimer || !now) {
            return 0;
        }

        return Math.max(0, questCompleteTimer - now);
    };

    /**
     * Formats a number of seconds as XmYs or Xs.
     */
    EquiCreuse.prototype.formatCooldownSeconds = function (seconds) {
        const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));

        const minutes = Math.floor(safeSeconds / 60);
        const remainingSeconds = safeSeconds % 60;

        if (minutes <= 0) {
            return `${remainingSeconds}s`;
        }

        return `${minutes}m${remainingSeconds}s`;
    };

    /**
     * Returns the remaining training cooldown in seconds.
     * - Normal case: cooldown ends 10 minutes after lastTrainingFinished.
     * - If motivationCount is 0: cooldown ends at next midnight.
     */
    EquiCreuse.prototype.getTrainingCooldownRemaining = function () {
        const now = this.getCurrentServerTime();

        if (!now) {
            return 0;
        }

        if (Number(this.motivationCount ?? 0) === 0) {
            const nowDate = new Date(now * 1000);
            const nextMidnight = new Date(nowDate);
            nextMidnight.setHours(24, 0, 0, 0);

            return Math.max(0, Math.floor(nextMidnight.getTime() / 1000) - now);
        }

        const lastTrainingFinished = this.normalizeUnixTime(this.lastTrainingFinished);

        if (!lastTrainingFinished) {
            return 0;
        }

        const cooldownEnd = lastTrainingFinished + 600;

        return Math.max(0, cooldownEnd - now);
    };

    /**
     * Starts the HUD timer refresh for the buttons.
     */
    EquiCreuse.prototype.startTrainingButtonTimer = function () {
        if (this._trainingButtonTimerInterval) {
            clearInterval(this._trainingButtonTimerInterval);
        }

        this._trainingButtonTimerInterval = setInterval(() => {
            this.refreshActionButtons();
        }, 1000);
    };

    /**
     * Stops the HUD timer refresh for the training button.
     */
    EquiCreuse.prototype.stopTrainingButtonTimer = function () {
        if (this._trainingButtonTimerInterval) {
            clearInterval(this._trainingButtonTimerInterval);
            this._trainingButtonTimerInterval = null;
        }
    };

    /**
     * Creates and inserts the custom UI into the page.
     */
    EquiCreuse.prototype.createUI = function () {
        const spDi = document.createElement('div');
        spDi.id = 'Creuse';
        spDi.className = 'fixed-top';
        spDi.innerHTML = `
            <div style="z-index: 1050">
                <button
                    class="btn btn-secondary position-absolute d-flex align-items-center"
                    style="z-index: 1050;"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#missioner-cont"
                    aria-expanded="false"
                    aria-controls="missioner-cont"
                >
                    <img
                        src="https://safirmes.fr/WebRoot/Store20/Shops/4d8e603d-e647-490d-a807-948e5655f141/61CA/11FA/3F4D/AE0D/84C8/0A48/3566/8CB5/CREUSE.jpg"
                        alt="M"
                        style="width: 32px;"
                    >
                    <p class="mx-2 my-0">L'outil de la Creuse</p>
                </button>

                <div class="position-absolute top-0" style="height: 100vh; background: #262626cc; overflow-y: auto">
                    <div class="collapse collapse-horizontal" id="missioner-cont">
                        <div class="pt-5 px-3" style="width: 300px;">

                            <div class="card text-bg-dark mb-2">
                                <div class="card-body">
                                    <h5 class="card-title">Missions</h5>
                                    <p id="m-city" class="mb-0 card-text text-center">City</p>
                                    <p class="mb-0 card-text">XP : <span id="m-xp"></span></p>
                                    <p class="mb-0 card-text">Argent : <span id="m-coins"></span></p>
                                    <p class="mb-0 card-text">Coût : <span id="m-cost"></span></p>
                                    <p class="mb-2 card-text">Durée : <span id="m-duration"></span></p>

                                    <label class="form-label">Energie max :</label>
                                    <input
                                        type="number"
                                        class="form-control mb-2"
                                        id="max-energy-quest"
                                        min="1"
                                        max="50"
                                        value="${this.maxEnergyPerQuest}"
                                    >

                                    <label class="form-label">Quest Focus:</label>
                                    <select class="form-select mb-2" id="quest-focus">
                                        <option value="XP">XP / Energie</option>
                                        <option value="COINS">Argent / Energie</option>
                                        <option value="COMBAT">Quêtes de combat</option>
                                        <option value="TIME">Quêtes chronométrées</option>
                                        <option value="MIN_ENERGY">Le moins d'énergie</option>
                                        <option value="HC">Items HeroCon</option>
                                        <option value="HEROBOOK_ITEM">Item HeroBook</option>
                                        <option value="EVENT_ITEM">Items d'Event</option>
                                        <option value="SLOTMACHINE">Jetons de Casino</option>
                                    </select>

                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="quest-auto-start">
                                        <label class="form-check-label" for="quest-auto-start">
                                            Démarrer la quête automatiquement
                                        </label>
                                    </div>

                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="quest-auto-claim">
                                        <label class="form-check-label" for="quest-auto-claim">
                                            Accepter les récompenses automatiquement
                                        </label>
                                    </div>

                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="quest-auto-next">
                                        <label class="form-check-label" for="quest-auto-next">
                                            Prochaine quête automatiquement
                                        </label>
                                    </div>

                                    <button
                                        id="creuse-msn"
                                        class="btn btn-success w-100"
                                        style="padding: var(--bs-btn-padding-y) var(--bs-btn-padding-x) !important;"
                                        type="button"
                                    >
                                        Go
                                    </button>
                                </div>
                            </div>

                            <div class="card text-bg-dark mb-2">
                                <div class="card-body">
                                    <h5 class="card-title">Senses</h5>

                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="quest-sense-booster">
                                        <label class="form-check-label" for="quest-sense-booster">
                                            Quest Sense Booster
                                        </label>
                                    </div>

                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="train-sense-booster">
                                        <label class="form-check-label" for="train-sense-booster">
                                            Train Sense Booster
                                        </label>
                                    </div>

                                    <button
                                        id="buy-energy"
                                        class="btn btn-primary w-100"
                                        style="padding: var(--bs-btn-padding-y) var(--bs-btn-padding-x) !important;"
                                        type="button"
                                    >
                                        Buy Energy
                                    </button>
                                </div>
                            </div>

                            <div class="card text-bg-dark mb-2">
                                <div class="card-body">
                                    <h5 class="card-title">Coupons</h5>
                                    <div class="mb-3 form-check">
                                        <input
                                            type="checkbox"
                                            class="form-check-input"
                                            id="auto-redeem-voucher-later"
                                        >
                                        <label class="form-check-label" for="auto-redeem-voucher-later">
                                            Enlever popup
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div class="card text-bg-dark mb-2">
                                <div class="card-body">
                                    <h5 class="card-title">Entraînement</h5>
                                    <p class="mb-0 card-text text-center">
                                        Motivation maximum / entraînement
                                    </p>

                                    <input
                                        type="number"
                                        class="form-control mb-2"
                                        id="max-motivation-train"
                                        min="1"
                                        max="50"
                                        value="${this.maxMotivationPerTrain}"
                                    >

                                    <label class="form-label">Priorité entraînement :</label>
                                    <ul class="list-group mb-2" id="quest-focus-sortable">
                                        <li
                                            class="list-group-item d-flex justify-content-between align-items-center"
                                            draggable="true"
                                            data-value="strength"
                                        >
                                            <span>Force</span>
                                            <span style="cursor: grab;">☰</span>
                                        </li>
                                        <li
                                            class="list-group-item d-flex justify-content-between align-items-center"
                                            draggable="true"
                                            data-value="intuition"
                                        >
                                            <span>Intuition</span>
                                            <span style="cursor: grab;">☰</span>
                                        </li>
                                        <li
                                            class="list-group-item d-flex justify-content-between align-items-center"
                                            draggable="true"
                                            data-value="brain"
                                        >
                                            <span>Cerveau</span>
                                            <span style="cursor: grab;">☰</span>
                                        </li>
                                        <li
                                            class="list-group-item d-flex justify-content-between align-items-center"
                                            draggable="true"
                                            data-value="constitution"
                                        >
                                            <span>Constitution</span>
                                            <span style="cursor: grab;">☰</span>
                                        </li>
                                    </ul>

                                    <input type="hidden" id="quest-focus-order">

                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="train-auto-start">
                                        <label class="form-check-label" for="train-auto-start">
                                            Démarrer l'entraînement automatiquement
                                        </label>
                                    </div>

                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="train-auto-claim">
                                        <label class="form-check-label" for="train-auto-claim">
                                            Accepter les récompenses automatiquement
                                        </label>
                                    </div>

                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="train-auto-next">
                                        <label class="form-check-label" for="train-auto-next">
                                            Prochain entraînement automatiquement
                                        </label>
                                    </div>

                                    <button
                                        id="creuse-train"
                                        class="btn btn-success w-100"
                                        style="padding: var(--bs-btn-padding-y) var(--bs-btn-padding-x) !important;"
                                        type="button"
                                    >
                                        Go
                                    </button>
                                </div>
                            </div>

                            <div class="card text-bg-dark mb-2">
                                <div class="card-body">
                                    <h5 class="card-title">Level Up</h5>

                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="auto-dismiss-level-up">
                                        <label class="form-check-label" for="auto-dismiss-level-up">
                                            Enlever popup lvl up
                                        </label>
                                    </div>

                                    <div class="mb-3 form-check">
                                        <input
                                            type="checkbox"
                                            class="form-check-input"
                                            id="auto-dismiss-pet-level-up"
                                        >
                                        <label class="form-check-label" for="auto-dismiss-pet-level-up">
                                            Enlever popup lvl up
                                        </label>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(spDi);
        this.initializeSortableTrainingFocus();
        this.initializeUIElements();
        this.startTrainingButtonTimer();
    };

    /**
     * Initializes the sortable training priority list and persists its order.
     */
    EquiCreuse.prototype.initializeSortableTrainingFocus = function () {
        const sortableList = document.getElementById('quest-focus-sortable');
        const hiddenOrderInput = document.getElementById('quest-focus-order');

        if (!sortableList || !hiddenOrderInput) return;

        const defaultOrder = ['strength', 'intuition', 'brain', 'constitution'];

        let savedOrder = defaultOrder;
        try {
            const storedOrder = GM_getValue(keys.trainFocusOrder, defaultOrder);
            if (Array.isArray(storedOrder) && storedOrder.length) {
                savedOrder = storedOrder;
            }
        } catch (e) {
            console.warn('[Creuse] Failed to load saved train focus order, using default.', e);
        }

        const itemsByValue = new Map(
            [...sortableList.querySelectorAll('li')].map((li) => [li.dataset.value, li])
        );

        savedOrder.forEach((value) => {
            const item = itemsByValue.get(value);
            if (item) {
                sortableList.appendChild(item);
            }
        });

        let draggedItem = null;

        const updateFocusOrder = () => {
            const order = [...sortableList.querySelectorAll('li')].map((li) => li.dataset.value);
            hiddenOrderInput.value = JSON.stringify(order);
            GM_setValue(keys.trainFocusOrder, order);
            console.log('[Creuse] Training focus order updated:', order);
        };

        sortableList.querySelectorAll('li').forEach((item) => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');

                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', item.dataset.value || '');
                }
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                sortableList.querySelectorAll('li').forEach((li) => li.classList.remove('over'));
                updateFocusOrder();
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
            });

            item.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (item !== draggedItem) {
                    item.classList.add('over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('over');

                if (!draggedItem || item === draggedItem) return;

                const rect = item.getBoundingClientRect();
                const offset = e.clientY - rect.top;
                const insertAfter = offset > rect.height / 2;

                if (insertAfter) {
                    item.insertAdjacentElement('afterend', draggedItem);
                } else {
                    item.insertAdjacentElement('beforebegin', draggedItem);
                }

                updateFocusOrder();
            });
        });

        updateFocusOrder();
    };

    /**
     * Restores saved values into the UI and attaches all event listeners.
     */
    EquiCreuse.prototype.initializeUIElements = function () {
        const questFocusSelect = document.getElementById('quest-focus');
        const questSenseBoosterCheckbox = document.getElementById('quest-sense-booster');
        const trainSenseBoosterCheckbox = document.getElementById('train-sense-booster');
        const questAutoStartCheckbox = document.getElementById('quest-auto-start');
        const questAutoClaimCheckbox = document.getElementById('quest-auto-claim');
        const questAutoNextCheckbox = document.getElementById('quest-auto-next');
        const voucherAutoRedeemLaterCheckbox = document.getElementById('auto-redeem-voucher-later');
        const autoDismissLevelUpCheckbox = document.getElementById('auto-dismiss-level-up');
        const autoDismissPetLevelUpCheckbox = document.getElementById('auto-dismiss-pet-level-up');
        const missionGoButton = document.getElementById('creuse-msn');
        const trainingGoButton = document.getElementById('creuse-train');
        const buyEnergyButton = document.getElementById('buy-energy');
        const maxEnergyQuestInput = document.getElementById('max-energy-quest');
        const maxMotivationTrainInput = document.getElementById('max-motivation-train');
        const trainAutoStartCheckbox = document.getElementById('train-auto-start');
        const trainAutoClaimCheckbox = document.getElementById('train-auto-claim');
        const trainAutoNextCheckbox = document.getElementById('train-auto-next');

        questFocusSelect.value = this.currentMissionFocus;
        questSenseBoosterCheckbox.checked = this.questSenseBoosterActive;
        trainSenseBoosterCheckbox.checked = this.trainSenseBoosterActive;
        questAutoStartCheckbox.checked = this.autoStartQuest;
        questAutoClaimCheckbox.checked = this.autoClaimQuest;
        questAutoNextCheckbox.checked = this.autoNextQuest;
        voucherAutoRedeemLaterCheckbox.checked = this.autoRedeemVoucherLater;
        autoDismissLevelUpCheckbox.checked = this.autoDismissLevelUp;
        autoDismissPetLevelUpCheckbox.checked = this.autoDismissPetLevelUp;
        trainAutoStartCheckbox.checked = this.autoStartTrain;
        trainAutoClaimCheckbox.checked = this.autoClaimTrain;
        trainAutoNextCheckbox.checked = this.autoNextTrain;

        missionGoButton.addEventListener('click', this.toggleMissionExecution.bind(this));
        trainingGoButton.addEventListener('click', this.toggleTrainingExecution.bind(this));
        buyEnergyButton.addEventListener('click', this.buyMoreEnergy.bind(this));

        questFocusSelect.addEventListener('change', this.updateMissionFocus.bind(this));
        maxEnergyQuestInput.addEventListener('change', this.updateMaxEnergyQuest.bind(this));
        maxMotivationTrainInput.addEventListener('change', this.updateMaxMotivationTrain.bind(this));

        questSenseBoosterCheckbox.addEventListener('change', this.updateQuestSenseBooster.bind(this));
        trainSenseBoosterCheckbox.addEventListener('change', this.updateTrainSenseBooster.bind(this));

        questAutoStartCheckbox.addEventListener('change', this.updateAutoStartQuest.bind(this));
        questAutoClaimCheckbox.addEventListener('change', this.updateAutoClaimQuest.bind(this));
        questAutoNextCheckbox.addEventListener('change', this.updateAutoNextQuest.bind(this));

        trainAutoStartCheckbox.addEventListener('change', this.updateAutoStartTrain.bind(this));
        trainAutoClaimCheckbox.addEventListener('change', this.updateAutoClaimTrain.bind(this));
        trainAutoNextCheckbox.addEventListener('change', this.updateAutoNextTrain.bind(this));

        voucherAutoRedeemLaterCheckbox.addEventListener('change', this.updateAutoRedeemVoucherLater.bind(this));
        autoDismissLevelUpCheckbox.addEventListener('change', this.updateAutoDismissLevelUp.bind(this));
        autoDismissPetLevelUpCheckbox.addEventListener('change', this.updateAutoDismissPetLevelUp.bind(this));

        this.refreshActionButtons();
    };

    /**
     * Updates the quest and training action buttons to show Go or Stop.
     */
    EquiCreuse.prototype.refreshActionButtons = function () {
        const missionButton = document.getElementById('creuse-msn');
        const trainingButton = document.getElementById('creuse-train');

        if (missionButton) {
            const questRemaining = this.getQuestTimerRemaining();
            const missionBaseLabel = this.isMissionRunning ? 'Stop' : 'Go';

            missionButton.textContent =
                questRemaining > 0
                    ? `${missionBaseLabel} (${this.formatCooldownSeconds(questRemaining)})`
                    : missionBaseLabel;

            missionButton.classList.toggle('btn-success', !this.isMissionRunning);
            missionButton.classList.toggle('btn-danger', this.isMissionRunning);

        }

        if (trainingButton) {
            const cooldownRemaining = this.getTrainingCooldownRemaining();
            const trainingBaseLabel = this.isTrainingRunning ? 'Stop' : 'Go';

            trainingButton.textContent =
                cooldownRemaining > 0
                    ? `${trainingBaseLabel} (${this.formatCooldownSeconds(cooldownRemaining)})`
                    : trainingBaseLabel;

            trainingButton.classList.toggle('btn-success', !this.isTrainingRunning);
            trainingButton.classList.toggle('btn-danger', this.isTrainingRunning);
        }
    };
})();

// ===== settings.js =====

(function () {
    'use strict';

    const ns = window.EquiCreuseNS;
    const EquiCreuse = ns.classes.EquiCreuse;
    const keys = ns.keys;


    /**
     * Updates the selected mission focus.
     */
    EquiCreuse.prototype.updateMissionFocus = function (event) {
        this.currentMissionFocus = event.target.value;
        GM_setValue(keys.missionFocus, this.currentMissionFocus);
        this.updateUIWithBestQuest(this.getBestQuest());
    };

    /**
     * Updates the auto-redeem voucher-later setting.
     */
    EquiCreuse.prototype.updateAutoRedeemVoucherLater = function (event) {
        this.autoRedeemVoucherLater = event.target.checked;
        GM_setValue(keys.autoRedeemVoucherLater, this.autoRedeemVoucherLater);
    };

    /**
     * Updates the auto-dismiss pet level-up setting.
     */
    EquiCreuse.prototype.updateAutoDismissPetLevelUp = function (event) {
        this.autoDismissPetLevelUp = event.target.checked;
        GM_setValue(keys.autoDismissPetLevelUp, this.autoDismissPetLevelUp);
    };

    /**
     * Updates the auto-dismiss level-up setting.
     */
    EquiCreuse.prototype.updateAutoDismissLevelUp = function (event) {
        this.autoDismissLevelUp = event.target.checked;
        GM_setValue(keys.autoDismissLevelUp, this.autoDismissLevelUp);
    };

    /**
     * Updates the maximum energy per quest.
     */
    EquiCreuse.prototype.updateMaxEnergyQuest = function (event) {
        const value = Number.parseInt(event.target.value, 10);
        this.maxEnergyPerQuest = Number.isNaN(value) ? 20 : Math.min(Math.max(value, 1), 50);
        event.target.value = this.maxEnergyPerQuest;
        GM_setValue(keys.maxEnergyQuest, this.maxEnergyPerQuest);
        this.updateUIWithBestQuest(this.getBestQuest());
    };

    /**
     * Updates the maximum motivation per training.
     */
    EquiCreuse.prototype.updateMaxMotivationTrain = function (event) {
        const value = Number.parseInt(event.target.value, 10);
        this.maxMotivationPerTrain = Number.isNaN(value) ? 20 : Math.min(Math.max(value, 1), 50);
        event.target.value = this.maxMotivationPerTrain;
        GM_setValue(keys.maxMotivationTrain, this.maxMotivationPerTrain);
    };

    /**
     * Updates the quest sense booster setting.
     */
    EquiCreuse.prototype.updateQuestSenseBooster = function (event) {
        this.questSenseBoosterActive = event.target.checked;
        GM_setValue(keys.questSenseBooster, this.questSenseBoosterActive);
    };

    /**
     * Updates the training sense booster setting.
     */
    EquiCreuse.prototype.updateTrainSenseBooster = function (event) {
        this.trainSenseBoosterActive = event.target.checked;
        GM_setValue(keys.trainSenseBooster, this.trainSenseBoosterActive);
    };

    /**
     * Updates the auto-start quest setting.
     */
    EquiCreuse.prototype.updateAutoStartQuest = function (event) {
        this.autoStartQuest = event.target.checked;
        GM_setValue(keys.autoStartQuest, this.autoStartQuest);
    };

    /**
     * Updates the auto-claim quest setting.
     */
    EquiCreuse.prototype.updateAutoClaimQuest = function (event) {
        this.autoClaimQuest = event.target.checked;
        GM_setValue(keys.autoClaimQuest, this.autoClaimQuest);
    };

    /**
     * Updates the auto-next quest setting.
     */
    EquiCreuse.prototype.updateAutoNextQuest = function (event) {
        this.autoNextQuest = event.target.checked;
        GM_setValue(keys.autoNextQuest, this.autoNextQuest);
    };

    /**
     * Updates the auto-start training setting.
     */
    EquiCreuse.prototype.updateAutoStartTrain = function (event) {
        this.autoStartTrain = event.target.checked;
        GM_setValue(keys.autoStartTrain, this.autoStartTrain);
    };

    /**
     * Updates the auto-claim training setting.
     */
    EquiCreuse.prototype.updateAutoClaimTrain = function (event) {
        this.autoClaimTrain = event.target.checked;
        GM_setValue(keys.autoClaimTrain, this.autoClaimTrain);
    };

    /**
     * Updates the auto-next training setting.
     */
    EquiCreuse.prototype.updateAutoNextTrain = function (event) {
        this.autoNextTrain = event.target.checked;
        GM_setValue(keys.autoNextTrain, this.autoNextTrain);
    };

    /**
     * Opens the in-game dialog to buy more energy.
     */
    EquiCreuse.prototype.buyMoreEnergy = function () {
        if (document?.Creuse?.quest?._energypanel) {
            document.Creuse.quest._energypanel.onClickBuyEnergy();
        }
    };
})();

// ===== quests.js =====

(function () {
    'use strict';

    const ns = window.EquiCreuseNS;
    const EquiCreuse = ns.classes.EquiCreuse;
    const {MISSION_FOCUS, QUEST_STAGES} = ns.constants;
    
    /**
     * Updates the current status of the quest
     */
    EquiCreuse.prototype.updateQuestStatus = function (status) {
        this.questStatus = status;
        console.log("[Creuse] New quest status found : " + status);
    };
    /**
     * Updates the current timer of the quest
     */
    EquiCreuse.prototype.updateQuestCompleteTimer = function (time) {
        this.questCompleteTimer = time;
    };

    /**
     * Starts or stops mission automation.
     */
    EquiCreuse.prototype.toggleMissionExecution = function () {
        if (this.isMissionRunning) {
            this.stopMissionExecution();
            return;
        }

        this.isMissionRunning = true;
        this.refreshActionButtons();
        this.executeBestMission();
    };

    /**
     * Stops mission automation and updates the UI.
     */
    EquiCreuse.prototype.stopMissionExecution = function () {
        this.isMissionRunning = false;
        this.refreshActionButtons();
        console.log('[Creuse] Mission automation stopped');
    };

    /**
     * Handles quest-complete checks and auto-closes the quest dialog when enabled.
     */
    EquiCreuse.prototype.handleCheckForQuestComplete = function () {
        setTimeout(() => {
            if (!this.autoClaimQuest) {
                console.log('No autoClaimQuest');
                return;
            }

            setTimeout(() => {
                if (!document.Creuse?.quest_complete) {
                    console.log('No quest_complete in Creuse');
                    return;
                }

                if (!document.Creuse?.quest_complete?._btnClose) {
                    console.log('No Close Button');
                    return;
                }

                console.log('[DEBUG] Closing quest complete dialog');
                document.Creuse?.quest_complete.handleClickClose();
            }, 500);
        }, 500);
    };

    /**
     * Handles quest reward claim events and continues or stops automation.
     */
    EquiCreuse.prototype.handleClaimQuestRewards = function () {
        if (!document.Creuse?.quest_complete) {
            return;
        }

        if (!this.autoNextQuest || !this.isMissionRunning) {
            this.stopMissionExecution();
            return;
        }


        setTimeout(() => {
            if (!this.isMissionRunning) {
                return;
            }

            this.executeBestMission();
        }, 500);
    };

    /**
     * Parses quest data and updates the best quest UI.
     */
    EquiCreuse.prototype.handleQuestChange = function (quests) {
        this.currentQuests = quests
            .map((quest) => {
                let parsedRewards = {};

                try {
                    parsedRewards =
                        typeof quest.rewards === 'string'
                            ? JSON.parse(quest.rewards)
                            : (quest.rewards || {});
                } catch (e) {
                    console.warn('[Creuse] Failed to parse quest rewards', {
                        questId: quest?.id ?? null,
                        rewards: quest?.rewards,
                        error: e
                    });
                    parsedRewards = {};
                }

                return {
                    ...quest,
                    rewards: parsedRewards
                };
            })
            .filter(Boolean);

        this.updateUIWithBestQuest(this.getBestQuest());
    };

    /**
     * Updates the quest information shown in the UI.
     */
    EquiCreuse.prototype.updateUIWithBestQuest = function (quest) {
        if (!quest) return;

        const cityEl = document.getElementById('m-city');
        const xpEl = document.getElementById('m-xp');
        const coinsEl = document.getElementById('m-coins');
        const costEl = document.getElementById('m-cost');
        const durationEl = document.getElementById('m-duration');

        if (!cityEl || !xpEl || !coinsEl || !costEl || !durationEl) {
            console.warn('[Creuse] Quest UI elements are missing');
            return;
        }

        const durationMinutes = Number(quest.duration || 0) / 60;
        const roundedDuration =
            Number.isInteger(durationMinutes) ? durationMinutes : durationMinutes.toFixed(1);

        cityEl.textContent = QUEST_STAGES[String(quest.stage)] || `Stage ${quest.stage}`;
        xpEl.textContent = numeral(quest.rewards?.xp || 0).format('0,0');
        coinsEl.textContent = numeral(quest.rewards?.coins || 0).format('0,0');
        costEl.textContent = numeral(Number(quest.energy_cost) || 0).format('0,0');
        durationEl.textContent = `${roundedDuration} minute${Number(roundedDuration) > 1 ? 's' : ''}`;
    };

    /**
     * Returns the best available quest based on the active settings.
     */
    EquiCreuse.prototype.getBestQuest = function () {
        if (!this.currentQuests.length) return null;

        let availableQuests = this.currentQuests.filter(
            (q) => Number(q.energy_cost) <= this.maxEnergyPerQuest
        );

        if (!availableQuests.length) {
            return [...this.currentQuests].sort((a, b) => a.energy_cost - b.energy_cost)[0] ?? null;
        }

        return this.sortQuestsByFocus(availableQuests)[0] ?? null;
    };

    /**
     * Sorts quests according to the selected mission focus.
     */
    EquiCreuse.prototype.sortQuestsByFocus = function (quests) {
        const hasReward = (quest, key) =>
            Object.prototype.hasOwnProperty.call(quest?.rewards || {}, key);

        const safeQuests = [...quests];

        switch (this.currentMissionFocus) {
            case MISSION_FOCUS.XP:
                return safeQuests.sort(
                    (a, b) =>
                        ((b.rewards?.xp || 0) / Math.max(Number(b.energy_cost) || 1, 1)) -
                        ((a.rewards?.xp || 0) / Math.max(Number(a.energy_cost) || 1, 1))
                );

            case MISSION_FOCUS.COINS:
                return safeQuests.sort(
                    (a, b) =>
                        ((b.rewards?.coins || 0) / Math.max(Number(b.energy_cost) || 1, 1)) -
                        ((a.rewards?.coins || 0) / Math.max(Number(a.energy_cost) || 1, 1))
                );

            case MISSION_FOCUS.COMBAT:
                return safeQuests
                    .filter((q) => Number(q.fight_difficulty) !== 0)
                    .sort((a, b) => Number(a.energy_cost) - Number(b.energy_cost));

            case MISSION_FOCUS.TIME:
                return safeQuests
                    .filter((q) => Number(q.fight_difficulty) === 0)
                    .sort((a, b) => Number(a.energy_cost) - Number(b.energy_cost));

            case MISSION_FOCUS.MIN_ENERGY:
                return safeQuests.sort((a, b) => Number(a.energy_cost) - Number(b.energy_cost));

            case MISSION_FOCUS.HEROBOOK_ITEM:
                return safeQuests.sort(
                    (a, b) =>
                        Number(hasReward(b, 'herobook_item_epic')) -
                        Number(hasReward(a, 'herobook_item_epic')) ||
                        Number(a.energy_cost) - Number(b.energy_cost)
                );

            case MISSION_FOCUS.HC:
                return safeQuests.sort(
                    (a, b) =>
                        Number(hasReward(b, 'guild_competition_item')) -
                        Number(hasReward(a, 'guild_competition_item')) ||
                        Number(a.energy_cost) - Number(b.energy_cost)
                );

            case MISSION_FOCUS.EVENT_ITEM:
                return safeQuests.sort(
                    (a, b) =>
                        Number(hasReward(b, 'event_item')) -
                        Number(hasReward(a, 'event_item')) ||
                        Number(a.energy_cost) - Number(b.energy_cost)
                );

            case MISSION_FOCUS.SLOTMACHINE:
                return safeQuests.sort(
                    (a, b) =>
                        Number(hasReward(b, 'slotmachine_jetons')) -
                        Number(hasReward(a, 'slotmachine_jetons')) ||
                        Number(a.energy_cost) - Number(b.energy_cost)
                );

            default:
                return safeQuests;
        }
    };

    /**
     * Opens the best quest in the game and optionally starts it.
     */
    EquiCreuse.prototype.executeBestMission = function () {
        if (!this.isMissionRunning) {
            return;
        }

        if (this.questStatus !== 0) {
            console.log('[Creuse] Quest already ongoing');
            return;
        }

        if (!document.Creuse?.stage || !document.Creuse?.quest) {
            console.log('[Creuse] Stage or quest panel not available');
            this.stopMissionExecution();
            return;
        }

        const bestQuest = this.getBestQuest();
        if (!bestQuest) {
            console.log('[Creuse] No best quest found');
            this.stopMissionExecution();
            return;
        }

        try {
            document.Creuse.stage.setStage(bestQuest.stage);
            console.log('[Creuse] Switched stage to', bestQuest.stage);
        } catch (e) {
            console.error('[Creuse] Failed to switch to quest stage', bestQuest.stage, e);
            this.stopMissionExecution();
            return;
        }

        const waitForQuestButtons = (attempt = 0) => {
            if (!this.isMissionRunning) {
                return;
            }

            const questButtons = [
                document.Creuse?.quest?._btnQuest1,
                document.Creuse?.quest?._btnQuest2,
                document.Creuse?.quest?._btnQuest3
            ].filter(Boolean);

            const targetButton = questButtons.find((button) => {
                try {
                    return button?.get_tag?.()?._data?.id === bestQuest.id;
                } catch (e) {
                    return false;
                }
            });

            if (targetButton) {
                console.log('[Creuse] Found target quest button', bestQuest.id);

                try {
                    document.Creuse.quest.clickQuest(targetButton);
                } catch (e) {
                    console.error('[Creuse] Failed to open selected quest', e);
                    this.stopMissionExecution();
                    return;
                }

                if (!this.autoStartQuest) {
                    if (!this.autoNextQuest) {
                        this.stopMissionExecution();
                    }
                    return;
                }

                const waitForQuestDialog = (dialogAttempt = 0) => {
                    if (!this.isMissionRunning) {
                        return;
                    }

                    const questDialog = document.Creuse?.dialog_quest;

                    if (questDialog && typeof questDialog.onClickStartQuest === 'function') {
                        try {
                            console.log('[Creuse] Starting selected quest');
                            questDialog.onClickStartQuest();
                        } catch (e) {
                            console.error('[Creuse] Failed to auto-start quest', e);
                            this.stopMissionExecution();
                            return;
                        }

                        if (!this.autoNextQuest) {
                            this.stopMissionExecution();
                        }

                        return;
                    }

                    if (dialogAttempt >= 20) {
                        console.error('[Creuse] Quest dialog did not appear in time');
                        this.stopMissionExecution();
                        return;
                    }

                    setTimeout(() => waitForQuestDialog(dialogAttempt + 1), 200);
                };

                waitForQuestDialog();
                return;
            }

            if (attempt >= 20) {
                console.error('[Creuse] Failed to find quest button for selected quest', {
                    bestQuest,
                    availableQuestIds: questButtons.map((button) => {
                        try {
                            return button?.get_tag?.()?._data?.id ?? null;
                        } catch (e) {
                            return null;
                        }
                    })
                });
                this.stopMissionExecution();
                return;
            }

            setTimeout(() => waitForQuestButtons(attempt + 1), 200);
        };

        waitForQuestButtons();
    };
})();

// ===== training.js =====

(function () {
    'use strict';

    const ns = window.EquiCreuseNS;
    const EquiCreuse = ns.classes.EquiCreuse;
    const keys = ns.keys;

    /**
     * Updates the current motivation amount.
     */
    EquiCreuse.prototype.updateTrainingCount = function (amount) {
        this.motivationCount = Number(amount || 0);
    };

    /**
     * Updates the current training status.
     */
    EquiCreuse.prototype.updateTrainingStatus = function (status) {
        this.trainStatus = Number(status || 0);
    };

    /**
     * Updates the training cooldown anchor.
     */
    EquiCreuse.prototype.updateTrainingEndedTimer = function (time) {
        this.lastTrainingFinished =
            typeof this.normalizeUnixTime === 'function'
                ? this.normalizeUnixTime(time)
                : Number(time || 0);
    };

    /**
     * Updates stored training energy from intercepted game data.
     */
    EquiCreuse.prototype.handleTrainEnergyChange = function (trainEnergy) {
        this.trainingEnergy = Number(trainEnergy || 0);
    };

    /**
     * Updates the cached list of training offers.
     */
    EquiCreuse.prototype.handleTrainChange = function (trains) {
        this.currentTrains = Array.isArray(trains) ? trains : [];
    };

    /**
     * Returns the total energy that can still be spent before training ends.
     * One energy regenerates every 60 seconds.
     */
    EquiCreuse.prototype.getProjectedTrainingEnergy = function (currentEnergy, remainingSeconds) {
        const regen = Math.max(0, Math.floor(Number(remainingSeconds || 0) / 60));
        return Math.max(0, Number(currentEnergy || 0)) + regen;
    };

    /**
     * Returns the remaining seconds for the current training session.
     * Multiple field names are checked because the game internals may vary.
     */
    EquiCreuse.prototype.getRemainingTrainingSeconds = function () {
        const progress = document.Creuse?.train?._trainingProgress;
        const direct = Number(
            progress?._remainingSeconds ??
            progress?._remaining_time ??
            progress?._secondsLeft ??
            progress?._timeLeft ??
            progress?.remaining_seconds ??
            0
        );

        return Number.isFinite(direct) && direct > 0 ? direct : 0;
    };

    /**
     * Chooses the best visible training candidate according to the real objective:
     * maximize total points by the end of training.
     *
     * Rules:
     * 1. Highest ratio always wins first.
     * 2. If ratios are equal, prefer the quest that wastes less projected total usable energy.
     * 3. If still tied, prefer lower cost.
     * 4. If still tied, prefer higher raw reward.
     */
    EquiCreuse.prototype.selectBestTrainingCandidate = function (
        candidates,
        trainingEnergyLeft,
        remainingSeconds
    ) {
        if (!candidates.length) {
            return null;
        }

        const projectedEnergy = this.getProjectedTrainingEnergy(trainingEnergyLeft, remainingSeconds);

        return [...candidates].sort((a, b) => {
            if (b.ratio !== a.ratio) {
                return b.ratio - a.ratio;
            }

            const wasteA = Math.max(0, projectedEnergy - a.energyCost);
            const wasteB = Math.max(0, projectedEnergy - b.energyCost);

            if (wasteA !== wasteB) {
                return wasteA - wasteB;
            }

            if (a.energyCost !== b.energyCost) {
                return a.energyCost - b.energyCost;
            }

            return b.trainingProgress - a.trainingProgress;
        })[0];
    };

    /**
     * Starts or stops training automation.
     */
    EquiCreuse.prototype.toggleTrainingExecution = function () {
        if (this.isTrainingRunning) {
            this.stopTrainingExecution();
            return;
        }

        this.isTrainingRunning = true;
        this.refreshActionButtons();
        this.executeBestTrain();
    };

    /**
     * Stops training automation, clears retries, and updates the UI.
     */
    EquiCreuse.prototype.stopTrainingExecution = function () {
        this.isTrainingRunning = false;
        this.clearAutoTrainingRetry();
        this.refreshActionButtons();
        console.log('[Creuse] Training automation stopped');
    };

    /**
     * Handles training reward claims and continues or stops automation.
     */
    EquiCreuse.prototype.handleClaimTrainRewards = function () {
        if (!document.Creuse?.training_complete) {
            return;
        }

        if (!this.autoNextTrain || !this.isTrainingRunning) {
            this.stopTrainingExecution();
            return;
        }

        setTimeout(() => {
            if (!this.isTrainingRunning) {
                return;
            }

            this.executeBestTrain();
        }, 500);
    };

    /**
     * Returns the best training offer according to the current settings.
     */
    EquiCreuse.prototype.getBestTrain = function () {
        const allTrains = [...this.currentTrains];

        if (!allTrains.length) {
            console.log('[Creuse] No available trains');
            return null;
        }

        const cappedTrains = allTrains.filter(
            (train) => Number(train.training_cost) <= Number(this.maxMotivationPerTrain)
        );

        if (!cappedTrains.length) {
            const fallbackTrain =
                [...allTrains].sort(
                    (a, b) => Number(a.training_cost || 999999) - Number(b.training_cost || 999999)
                )[0] ?? null;

            console.log('[Creuse] No train within motivation cap, using cheapest fallback', fallbackTrain);
            return fallbackTrain;
        }

        const sortedTrains = this.sortTrainsByFocus(cappedTrains);
        return sortedTrains[0] ?? null;
    };

    /**
     * Sorts training offers according to the saved priority order.
     */
    EquiCreuse.prototype.sortTrainsByFocus = function (trains) {
        const defaultOrder = ['strength', 'intuition', 'brain', 'constitution'];
        let focusOrder = defaultOrder;

        try {
            const storedOrder = GM_getValue(keys.trainFocusOrder, defaultOrder);
            if (Array.isArray(storedOrder) && storedOrder.length) {
                focusOrder = storedOrder;
            }
        } catch (e) {
            console.warn('[Creuse] Failed to load stored train focus order, trying DOM fallback.', e);

            const hiddenInput = document.getElementById('quest-focus-order');
            if (hiddenInput?.value) {
                try {
                    const parsed = JSON.parse(hiddenInput.value);
                    if (Array.isArray(parsed) && parsed.length) {
                        focusOrder = parsed;
                    }
                } catch (parseError) {
                    console.warn('[Creuse] Invalid train focus order in DOM fallback, using default.', parseError);
                }
            }
        }

        const focusToStatType = {
            strength: 2,
            intuition: 4,
            brain: 3,
            constitution: 1
        };

        const priorityMap = {};
        focusOrder.forEach((focus, index) => {
            const statType = focusToStatType[focus];
            if (statType !== undefined) {
                priorityMap[statType] = index;
            }
        });

        return [...trains].sort((a, b) => {
            const priorityA = priorityMap[Number(a.stat_type)] ?? 999;
            const priorityB = priorityMap[Number(b.stat_type)] ?? 999;

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            return Number(a.training_cost ?? 999999) - Number(b.training_cost ?? 999999);
        });
    };

    /**
     * Opens the best training offer and optionally starts it.
     */
    EquiCreuse.prototype.executeBestTrain = function () {
        if (!this.isTrainingRunning) {
            return;
        }

        const trainPanel = document.Creuse?.train;
        const viewManager = document.Creuse?.view_manager;

        if (!trainPanel || !viewManager) {
            console.log('[Creuse] Training panel or view manager not available');
            this.scheduleAutoTrainingRetry();
            return;
        }

        if (this.trainStatus === 0) {
            try {
                viewManager.showPanel('training_offers');
            } catch (e) {
                console.error('[Creuse] Failed to open training offers panel', e);
                this.scheduleAutoTrainingRetry();
                return;
            }

            const bestTrain = this.getBestTrain();
            if (!bestTrain) {
                console.log('[Creuse] No best train');
                this.stopTrainingExecution();
                return;
            }

            this.clearAutoTrainingRetry();

            setTimeout(() => {
                if (!this.isTrainingRunning) {
                    return;
                }

                const currentTrainingPanel = document.Creuse?.training_panel;
                const trainOffers = [
                    currentTrainingPanel?._offer1,
                    currentTrainingPanel?._offer2,
                    currentTrainingPanel?._offer3,
                    currentTrainingPanel?._offer4
                ].filter(Boolean);

                if (!trainOffers.length) {
                    console.error('[Creuse] No train offers found');
                    this.scheduleAutoTrainingRetry();
                    return;
                }

                const targetOffer = trainOffers.find(
                    (offer) => offer?._training?._data?.id === bestTrain.id
                );

                if (!targetOffer) {
                    console.error('[Creuse] Failed to find matching train offer', {
                        bestTrain,
                        offers: trainOffers.map((offer, index) => ({
                            index,
                            id: offer?._training?._data?.id ?? null,
                            setting: offer?._training?._data?.setting ?? null,
                            cost: offer?._training?._data?.training_cost ?? null
                        }))
                    });
                    this.scheduleAutoTrainingRetry();
                    return;
                }

                if (this.autoStartTrain) {
                    try {
                        currentTrainingPanel.onStartTrainingClicked(targetOffer._training);
                    } catch (e) {
                        console.error('[Creuse] Failed to start selected training', e);
                        this.scheduleAutoTrainingRetry();
                        return;
                    }

                    console.log('[Creuse] Found a training, waiting for session to initialize');

                    const waitForTrainingSession = (attempt = 0) => {
                        if (!this.isTrainingRunning) {
                            return;
                        }

                        const currentTrainPanel = document.Creuse?.train;
                        const neededValue = currentTrainPanel?._trainingProgress?._neededValue;

                        if (neededValue !== undefined && neededValue !== null && neededValue !== -1) {
                            console.log('[Creuse] Training session initialized, continuing automation');
                            this.executeAutoTraining();
                            return;
                        }

                        if (attempt >= 20) {
                            console.error('[Creuse] Training session did not initialize in time');
                            this.scheduleAutoTrainingRetry();
                            return;
                        }

                        setTimeout(() => waitForTrainingSession(attempt + 1), 250);
                    };

                    waitForTrainingSession();
                    return;
                }

                this.stopTrainingExecution();
            }, 400);

            return;
        }

        console.log('[Creuse] Training already in session, continuing automation');
        this.executeAutoTraining();
    };

    /**
     * Executes the training quest loop while automation is enabled.
     */
    EquiCreuse.prototype.executeAutoTraining = function () {
        if (!this.isTrainingRunning) {
            return;
        }

        const trainPanel = document.Creuse?.train;

        if (!trainPanel?._trainingProgress) {
            console.warn('[Creuse] Training progress is unavailable');
            this.scheduleAutoTrainingRetry();
            return;
        }

        if (trainPanel._trainingProgress._neededValue !== -1) {
            this.clearAutoTrainingRetry();

            const trainingCompleteDialog = document.Creuse?.training_complete;
            if (trainingCompleteDialog?._btnClose) {
                setTimeout(() => {
                    if (!this.isTrainingRunning) {
                        return;
                    }

                    const currentDialog = document.Creuse?.training_complete;
                    if (!currentDialog || typeof currentDialog.handleClickClose !== 'function') {
                        return;
                    }

                    try {
                        console.log('[Creuse] Training ended, closing the dialog.');
                        currentDialog.handleClickClose();
                    } catch (e) {
                        console.error('[Creuse] Error while closing training complete dialog', e);
                    }
                }, 200);
            }

            const trainingEnergyLeft = Number(this.trainingEnergy ?? 0);
            const remainingSeconds = this.getRemainingTrainingSeconds();
            const projectedEnergy = this.getProjectedTrainingEnergy(trainingEnergyLeft, remainingSeconds);

            const trainButtons = [
                trainPanel._btnQuest1,
                trainPanel._btnQuest2,
                trainPanel._btnQuest3
            ].filter(Boolean);

            if (!trainButtons.length) {
                console.error('[Creuse] No train buttons found');
                this.scheduleAutoTrainingRetry();
                return;
            }

            const visibleTrainCandidates = trainButtons
                .map((btn, index) => {
                    const tag = typeof btn?.get_tag === 'function' ? btn.get_tag() : btn?._tag;
                    const data = tag?._data ?? null;

                    if (!data) {
                        return null;
                    }

                    let rewards = null;
                    try {
                        rewards =
                            typeof data.rewards === 'string'
                                ? JSON.parse(data.rewards)
                                : (data.rewards || {});
                    } catch (e) {
                        console.warn('[Creuse] Failed to parse training quest rewards', {
                            questId: data?.id ?? null,
                            trainingId: data?.training_id ?? null,
                            rewards: data?.rewards,
                            error: e
                        });
                        return null;
                    }

                    const energyCost = Number(data.energy_cost ?? 999999);
                    const fightDifficulty = Number(data.fight_difficulty ?? 999999);
                    const trainingProgress = Number(rewards?.training_progress ?? 0);
                    const type = Number(data.type ?? 999999);

                    return {
                        index,
                        btn,
                        tag,
                        data,
                        rewards,
                        energyCost,
                        fightDifficulty,
                        type,
                        trainingProgress,
                        ratio: energyCost > 0 ? trainingProgress / energyCost : 0
                    };
                })
                .filter(Boolean)
                .filter((q) => (q.type === 3 ? q.fightDifficulty < 3 : true))
                .filter((q) => q.trainingProgress > 0)
                .filter((q) => q.energyCost <= projectedEnergy);

            if (!visibleTrainCandidates.length) {
                console.error('[Creuse] No valid reachable training quests found', {
                    trainingEnergyLeft,
                    projectedEnergy,
                    remainingSeconds
                });
                this.scheduleAutoTrainingRetry();
                return;
            }

            const bestQuest = this.selectBestTrainingCandidate(
                visibleTrainCandidates,
                trainingEnergyLeft,
                remainingSeconds
            );

            if (!bestQuest) {
                console.log('[Creuse] No visible training quest selected, waiting', {
                    trainingEnergyLeft,
                    projectedEnergy,
                    remainingSeconds
                });
                this.scheduleAutoTrainingRetry();
                return;
            }

            if (bestQuest.energyCost > trainingEnergyLeft) {
                console.log('[Creuse] Best training quest selected but not affordable yet, waiting', {
                    trainingEnergyLeft,
                    projectedEnergy,
                    remainingSeconds,
                    bestQuest: {
                        energyCost: bestQuest.energyCost,
                        trainingProgress: bestQuest.trainingProgress,
                        ratio: bestQuest.ratio
                    }
                });
                this.scheduleAutoTrainingRetry(bestQuest.energyCost);
                return;
            }

            try {
                trainPanel.openTrainingQuest(bestQuest.tag);
            } catch (e) {
                console.error('[Creuse] Failed to open training quest', e);
                this.scheduleAutoTrainingRetry();
                return;
            }

            setTimeout(() => {
                if (!this.isTrainingRunning) {
                    return;
                }

                try {
                    document.Creuse?.training_dialog?.startTrainingQuest();
                } catch (e) {
                    console.error('[Creuse] Failed to start training quest', e);
                    this.scheduleAutoTrainingRetry();
                    return;
                }

                if (!document.Creuse?.training_quest_panel) {
                    this.scheduleAutoTrainingRetry();
                    return;
                }

                setTimeout(() => {
                    if (!this.isTrainingRunning) {
                        return;
                    }

                    setTimeout(() => {
                        if (!this.isTrainingRunning) {
                            return;
                        }

                        const doneDialog = document.Creuse?.training_done_dialog;
                        if (doneDialog && typeof doneDialog.handleClickClose === 'function') {
                            try {
                                console.log('[Creuse] Closing end dialog of training quest.');
                                doneDialog.handleClickClose();
                            } catch (e) {
                                console.error('[Creuse] Error while closing training done dialog', e);
                            }
                        }

                        this.executeBestTrain();
                    }, 4200);
                }, 2100);
            }, 250);

            return;
        }

        const trainingDoneDialog = document.Creuse?.training_done_dialog;
        if (trainingDoneDialog) {
            setTimeout(() => {
                if (!this.isTrainingRunning) {
                    return;
                }

                const currentDialog = document.Creuse?.training_done_dialog;
                if (!currentDialog || typeof currentDialog.handleClickClose !== 'function') {
                    return;
                }

                try {
                    console.log('[Creuse] Closing lingering end dialog of training quest.');
                    currentDialog.handleClickClose();
                } catch (e) {
                    console.error('[Creuse] Error while closing lingering training dialog', e);
                }

                this.executeAutoTraining();
            }, 4200);
        }
    };

    /**
     * Schedules a delayed retry for training automation.
     * If a target energy cost is provided, the retry is aligned with expected regeneration.
     */
    EquiCreuse.prototype.scheduleAutoTrainingRetry = function (targetEnergyCost = null) {
        if (!this.isTrainingRunning) {
            return;
        }

        if (this.autoTrainingRetryTimeout) {
            return;
        }

        const remainingSeconds =
            typeof this.getRemainingTrainingSeconds === 'function'
                ? this.getRemainingTrainingSeconds()
                : 0;

        const currentEnergy = Number(this.trainingEnergy ?? 0);

        let retryDelay = 5000;

        if (targetEnergyCost !== null && targetEnergyCost > currentEnergy) {
            const missingEnergy = targetEnergyCost - currentEnergy;
            retryDelay = Math.max(1000, (missingEnergy * 60 * 1000) - 500);

            if (remainingSeconds > 0) {
                retryDelay = Math.min(retryDelay, Math.max(1000, remainingSeconds * 1000));
            }
        } else if (remainingSeconds > 0 && remainingSeconds <= 300) {
            retryDelay = 1000;
        } else if (currentEnergy < 5) {
            retryDelay = 1000;
        }

        this.autoTrainingRetryTimeout = setTimeout(() => {
            this.autoTrainingRetryTimeout = null;

            if (!this.isTrainingRunning) {
                return;
            }

            console.log('[Creuse] Retrying executeBestTrain...');
            this.executeBestTrain();
        }, retryDelay);
    };

    /**
     * Clears the pending training retry timer.
     */
    EquiCreuse.prototype.clearAutoTrainingRetry = function () {
        if (!this.autoTrainingRetryTimeout) {
            return;
        }

        clearTimeout(this.autoTrainingRetryTimeout);
        this.autoTrainingRetryTimeout = null;
    };
})();

// ===== proxy.js =====

(function () {
    'use strict';

    const ns = window.EquiCreuseNS;
    const EquiCreuse = ns.classes.EquiCreuse;

    /**
     * Proxies XMLHttpRequest to intercept game API responses and trigger internal handlers.
     */
    EquiCreuse.prototype.setupRequestProxy = function () {
        const self = this;
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            this._method = method;
            this._url = url;
            return originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function (data) {
            const xhr = this;
            const originalOnReadyStateChange = xhr.onreadystatechange;

            xhr.onreadystatechange = function () {
                try {
                    if (
                        xhr.readyState === XMLHttpRequest.DONE &&
                        xhr._method === 'POST' &&
                        typeof xhr._url === 'string' &&
                        xhr._url.includes('request.php')
                    ) {
                        const requestData =
                            typeof data === 'string'
                                ? data
                                : data instanceof URLSearchParams
                                    ? data.toString()
                                    : '';

                        let jsonResponse = null;
                        try {
                            jsonResponse = xhr.responseText ? JSON.parse(xhr.responseText) : null;
                        } catch (parseError) {
                            console.warn('[Creuse] Failed to parse XHR response as JSON', {
                                url: xhr._url,
                                responseText: xhr.responseText,
                                error: parseError
                            });
                        }

                        if (jsonResponse) {
                            console.groupCollapsed('XHR Response:', xhr._url);
                            console.log('Method:', xhr._method);
                            console.log('URL:', xhr._url);
                            console.log('Response:', jsonResponse);
                            console.groupEnd();
                        }

                        if (jsonResponse?.data?.character?.training_energy !== undefined) {
                            self.handleTrainEnergyChange(jsonResponse.data.character.training_energy);
                        }

                        if (Array.isArray(jsonResponse?.data?.quests)) {
                            self.handleQuestChange(jsonResponse.data.quests);
                        }

                        if (jsonResponse?.data?.character?.active_quest_id !== undefined) {
                            console.log('[Creuse] calling updateQuestStatus with', jsonResponse?.data?.character?.active_quest_id);
                            self.updateQuestStatus(jsonResponse?.data?.character?.active_quest_id);
                        }

                        if (jsonResponse?.data?.character?.ts_last_training_finished !== undefined) {
                            self.updateTrainingEndedTimer(jsonResponse?.data?.character?.ts_last_training_finished);
                        }

                        if (jsonResponse?.data?.quest?.ts_complete !== undefined) {
                            self.updateQuestCompleteTimer(jsonResponse?.data?.quest?.ts_complete);
                        }
                        if (jsonResponse?.data?.character?.training_count !== undefined) {
                            self.updateTrainingCount(jsonResponse?.data?.character?.training_count);
                        }

                        if (jsonResponse?.data?.server_time !== undefined) {
                            self.updateServerTime(jsonResponse?.data?.server_time);
                        }

                        if (jsonResponse?.data?.character?.active_training_id !== undefined) {
                            console.log('[Creuse] calling updateTrainingStatus with', jsonResponse?.data?.character?.active_training_id);
                            self.updateTrainingStatus(jsonResponse?.data?.character?.active_training_id);
                        }

                        if (Array.isArray(jsonResponse?.data?.trainings)) {
                            self.handleTrainChange(jsonResponse.data.trainings);
                        }

                        if (requestData.includes('action=checkForQuestComplete')) {
                            self.handleCheckForQuestComplete();
                        }

                        if (requestData.includes('action=claimQuestRewards')) {
                            self.handleClaimQuestRewards();
                        }

                        if (requestData.includes('action=claimTrainingQuestRewards')) {
                            self.handleClaimTrainRewards();
                        }
                    }
                } catch (error) {
                    console.error('[Creuse] Error inside XHR proxy', error);
                }

                const requestData =
                    typeof data === 'string'
                        ? data
                        : data instanceof URLSearchParams
                            ? data.toString()
                            : '';

                const reportingError =
                    typeof requestData === 'string' && requestData.includes('gameReportError');

                if (!reportingError && originalOnReadyStateChange) {
                    originalOnReadyStateChange.apply(xhr, arguments);
                } else if (reportingError) {
                    console.error('[Creuse] Game error report prevented', requestData);
                }
            };

            return originalSend.apply(this, arguments);
        };
    };
})();

// ===== embed.js =====

(function () {
    'use strict';

    const ns = window.EquiCreuseNS;
    const EquiCreuse = ns.classes.EquiCreuse;

    /**
     * Finds a script tag containing the given code string.
     */
    EquiCreuse.prototype.findScriptWithCode = function (targetCode) {
        return (
            Array.from(document.querySelectorAll('script')).find((script) =>
                script.textContent.includes(targetCode)
            ) || null
        );
    };

    /**
     * Injects the modified game embed code and exposes internal game objects on document.Creuse.
     */
    EquiCreuse.prototype.injectFixedEmbedCode = function () {
        const fixedEmbedCode = `
        if (gameLoaded) {
            embedGame();
        }

        function embedGame() {
            let script = lime.$scripts["HeroZero.min"].toString();

            const replacements = [
                ['this.gameDeviceCache', 'document.Creuse.app=this;this.gameDeviceCache', 'APP'],
                ['._btnQuest2=this._btnQuest3=null;', '._btnQuest2=this._btnQuest3=null;document.Creuse.train=this;', 'TRAIN'],
                ['this.setCurrentData();var e=this;', 'this.setCurrentData();var e=this;document.Creuse.dialog_quest=this;', 'DIALOG_QUEST'],
                ['this._instantClose=this._isClaiming=!1;', 'document.Creuse.quest_complete=this;this._instantClose=this._isClaiming=!1;', 'QUEST_COMPLETE'],
                ['this._stageNameMaxWidth=this._stageNameX=0;', 'this._stageNameMaxWidth=this._stageNameX=0;document.Creuse.quest=this;', 'QUEST'],
                ['this._timer=this._currentTraining=null;', 'this._timer=this._currentTraining=null;document.Creuse.training_panel=this;', 'TRAINING_PANEL'],
                ['this._btnVideoAdvertisment=this._btnUseResource=this._dailyBonus=', 'document.Creuse.stage=this;this._btnVideoAdvertisment=this._btnUseResource=this._dailyBonus=', 'STAGE'],
                ['this._onLoadedCharacter=this', 'document.Creuse.view_manager=this;this._onLoadedCharacter=this', 'VIEW_MANAGER'],
                ['this._voucher=a', 'document.Creuse.new_voucher=this;this._voucher=a', 'NEW_VOUCHER'],
                ['Tb.prototype._hx_constructor=function(a,b,c,e){null==e&&(e=!0);', 'Tb.prototype._hx_constructor=function(a,b,c,e){null==e&&(e=!0);document.Creuse.level_up=this;', 'LEVEL_UP'],
                ['this._sidekick=this._rewardLine=null;', 'this._sidekick=this._rewardLine=null;document.Creuse.pet_lvl_up=this;', 'PET_LVL_UP'],
                ['this._btnCurrentDungeonQuest=this._btnBack', 'document.Creuse.dungeon=this;this._btnCurrentDungeonQuest=this._btnBack', 'DUNGEON'],
                ['{this._emblemA=this._emblemB=this', '{document.Creuse.fight_panel=this;this._emblemA=this._emblemB=this', 'FIGHT_PANEL'],
                ['this._instantClose=!1;this._rewardLine=this', 'document.Creuse.training_done_dialog=this;this._instantClose=!1;this._rewardLine=this', 'TRAINING_DONE_DIALOG'],
                ['this._btnStartQuest=this._btnPreviousQuest=t', 'document.Creuse.training_dialog=this;this._btnStartQuest=this._btnPreviousQuest=t', 'TRAINING_DIALOG'],
                ['){this._training=a;ev._isOpen=!0;', '){document.Creuse.training_complete=this;this._training=a;ev._isOpen=!0;', 'TRAINING_COMPLETE'],
                ['e,a)};Pi', 'e,a);document.Creuse.training_quest_ongoing=this;};Pi', 'TRAINING_QUEST_ONGOING'],
                [',.5)};fh.', ',.5);document.Creuse.training_quest_panel=this;};fh.', 'TRAINING_QUEST_PANEL']
            ];

            const missingHooks = [];

            replacements.forEach(([search, replacement, label]) => {
                if (script.includes(search)) {
                    script = script.replace(search, replacement);
                } else {
                    missingHooks.push(label);
                }
            });

            if (missingHooks.length) {
                console.warn('[Creuse] Some embed hooks were not injected:', missingHooks);
            } else {
                console.log('[Creuse] All embed hooks injected successfully');
            }

            eval("window.lime_script = " + script);
            lime.$scripts["HeroZero.min"] = window.lime_script;

            lime.embed("HeroZero.min", "appClient", appWidth, appHeight, {
                height: appHeight,
                rootPath: "https://hz-static-2.akamaized.net/assets/html5",
                parameters: clientVars
            });

            console.log("[Creuse] Game Fix Injected");
        }
    `;

        const fixScript = document.createElement('script');
        fixScript.textContent = fixedEmbedCode;
        document.head.appendChild(fixScript);
    };
})();

// ===== bootstrap.js =====

(function () {
    'use strict';

    const ns = window.EquiCreuseNS;
    new ns.classes.EquiCreuse();
})();
