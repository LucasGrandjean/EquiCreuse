(function () {
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