(function () {
    'use strict';

    const ns = window.EquiCreuseNS;
    const EquiCreuse = ns.classes.EquiCreuse;
    const keys = ns.keys;

    /**
     * Base UI delay settings.
     * Increase slightly if the HUD still feels too fast.
     */
    EquiCreuse.prototype.uiDelayBase = 180;
    EquiCreuse.prototype.uiDelaySpread = 120;

    /**
     * Returns a small UI-friendly randomized delay.
     */
    EquiCreuse.prototype.getUiActionDelay = function (base = null, spread = null) {
        const finalBase = Number(base ?? this.uiDelayBase ?? 180);
        const finalSpread = Number(spread ?? this.uiDelaySpread ?? 120);

        return Math.max(0, finalBase + Math.floor(Math.random() * finalSpread));
    };

    /**
     * Executes a function after a small UI-friendly delay.
     */
    EquiCreuse.prototype.runWithUiDelay = function (fn, base = null, spread = null) {
        setTimeout(() => {
            try {
                fn();
            } catch (e) {
                console.error('[Creuse] Delayed UI action failed', e);
            }
        }, this.getUiActionDelay(base, spread));
    };

    /**
     * Automatically starts the next training when the cooldown ends,
     * if automation is enabled and auto-next is active.
     */
    EquiCreuse.prototype.handleTrainingCooldownFinished = function () {
        if (!this.isTrainingRunning || !this.autoNextTrain) {
            this.autoNextTrainCooldownTriggered = false;
            return;
        }

        const cooldownRemaining =
            typeof this.getTrainingCooldownRemaining === 'function'
                ? this.getTrainingCooldownRemaining()
                : 0;

        if (cooldownRemaining > 0) {
            this.autoNextTrainCooldownTriggered = false;
            return;
        }

        if (this.autoNextTrainCooldownTriggered) {
            return;
        }

        this.autoNextTrainCooldownTriggered = true;

        console.log('[Creuse] Training cooldown finished, starting next training');
        this.executeBestTrain();
    };

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

        this.autoNextTrainCooldownTriggered = false;
    };

    /**
     * Updates the absolute end timestamp of the current training session.
     */
    EquiCreuse.prototype.updateCurrentTrainingTimer = function (time) {
        this.currentTrainingTimer =
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
     * Returns the remaining seconds for the current training session,
     * based on the absolute training end timestamp.
     */
    EquiCreuse.prototype.getRemainingTrainingSeconds = function () {
        const endTime =
            typeof this.normalizeUnixTime === 'function'
                ? this.normalizeUnixTime(this.currentTrainingTimer)
                : Number(this.currentTrainingTimer || 0);

        const now =
            typeof this.getCurrentServerTime === 'function'
                ? this.getCurrentServerTime()
                : (
                    typeof this.normalizeUnixTime === 'function'
                        ? this.normalizeUnixTime(this.serverTime)
                        : Number(this.serverTime || 0)
                );

        if (!endTime || !now) {
            return 0;
        }

        return Math.max(0, endTime - now);
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

            if (remainingSeconds <= 0 || remainingSeconds > 40) {
                if (a.energyCost !== b.energyCost) {
                    return a.energyCost - b.energyCost;
                }

                return b.trainingProgress - a.trainingProgress;
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
            this.runWithUiDelay(() => {
                if (!this.isTrainingRunning) {
                    return;
                }

                try {
                    viewManager.showPanel('training_offers');
                } catch (e) {
                    console.error('[Creuse] Failed to open training offers panel', e);
                    this.scheduleAutoTrainingRetry();
                }
            }, 220, 120);

            setTimeout(() => {
                if (!this.isTrainingRunning) {
                    return;
                }

                const bestTrain = this.getBestTrain();
                if (!bestTrain) {
                    console.log('[Creuse] No best train');
                    this.stopTrainingExecution();
                    return;
                }

                this.clearAutoTrainingRetry();

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
                    this.runWithUiDelay(() => {
                        if (!this.isTrainingRunning) {
                            return;
                        }

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

                            setTimeout(() => waitForTrainingSession(attempt + 1), 300);
                        };

                        waitForTrainingSession();
                    }, 260, 140);

                    return;
                }

                this.stopTrainingExecution();
            }, 520);

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

                    this.runWithUiDelay(() => {
                        if (!this.isTrainingRunning) {
                            return;
                        }

                        try {
                            console.log('[Creuse] Training ended, closing the dialog.');
                            currentDialog.handleClickClose();
                        } catch (e) {
                            console.error('[Creuse] Error while closing training complete dialog', e);
                        }
                    }, 200, 100);
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
                    remainingSeconds,
                    currentTrainingTimer: this.currentTrainingTimer
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
                    remainingSeconds,
                    currentTrainingTimer: this.currentTrainingTimer
                });
                this.scheduleAutoTrainingRetry();
                return;
            }

            if (bestQuest.energyCost > trainingEnergyLeft) {
                console.log('[Creuse] Best training quest selected but not affordable yet, waiting', {
                    trainingEnergyLeft,
                    projectedEnergy,
                    remainingSeconds,
                    currentTrainingTimer: this.currentTrainingTimer,
                    bestQuest: {
                        energyCost: bestQuest.energyCost,
                        trainingProgress: bestQuest.trainingProgress,
                        ratio: bestQuest.ratio
                    }
                });
                this.scheduleAutoTrainingRetry(bestQuest.energyCost);
                return;
            }

            this.runWithUiDelay(() => {
                if (!this.isTrainingRunning) {
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

                    this.runWithUiDelay(() => {
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

                            const doneDialog = document.Creuse?.training_done_dialog;
                            if (doneDialog && typeof doneDialog.handleClickClose === 'function') {
                                this.runWithUiDelay(() => {
                                    if (!this.isTrainingRunning) {
                                        return;
                                    }

                                    try {
                                        console.log('[Creuse] Closing end dialog of training quest.');
                                        doneDialog.handleClickClose();
                                    } catch (e) {
                                        console.error('[Creuse] Error while closing training done dialog', e);
                                    }

                                    this.executeBestTrain();
                                }, 220, 120);

                                return;
                            }

                            this.executeBestTrain();
                        }, 4200);
                    }, 220, 100);
                }, 350);
            }, 220, 120);

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

                this.runWithUiDelay(() => {
                    if (!this.isTrainingRunning) {
                        return;
                    }

                    try {
                        console.log('[Creuse] Closing lingering end dialog of training quest.');
                        currentDialog.handleClickClose();
                    } catch (e) {
                        console.error('[Creuse] Error while closing lingering training dialog', e);
                    }

                    this.executeAutoTraining();
                }, 220, 120);
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