(function () {
    'use strict';

    const ns = window.EquiCreuseNS;
    const EquiCreuse = ns.classes.EquiCreuse;
    const keys = ns.keys;

    /**
     * Updates stored training energy from intercepted game data.
     */
    EquiCreuse.prototype.handleTrainEnergyChange = function (trainEnergy) {
        this.trainingEnergy = trainEnergy;
    };

    /**
     * Updates the cached list of training offers.
     */
    EquiCreuse.prototype.handleTrainChange = function (trains) {
        this.currentTrains = trains;
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

        const trainingNeededValue = trainPanel?._trainingProgress?._neededValue;

        if (trainingNeededValue === -1) {
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

                    console.log('[Creuse] Found a training, starting automation');
                    this.executeAutoTraining();
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
        const trainingCompleteDialog = document.Creuse?.training_complete;
        const trainingDoneDialog = document.Creuse?.training_done_dialog;

        if (!trainPanel?._trainingProgress) {
            console.warn('[Creuse] Training progress is unavailable');
            this.scheduleAutoTrainingRetry();
            return;
        }

        if (trainPanel._trainingProgress._neededValue !== -1) {
            this.clearAutoTrainingRetry();

            if (trainingCompleteDialog?._btnClose) {
                setTimeout(() => {
                    if (!this.isTrainingRunning) {
                        return;
                    }

                    try {
                        console.log('[Creuse] Training ended, closing the dialog.');
                        trainingCompleteDialog.handleClickClose();
                    } catch (e) {
                        console.error('[Creuse] Error while closing training complete dialog', e);
                    }
                }, 200);
            }

            const trainingEnergyLeft = Number(this.trainingEnergy ?? 0);
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

            const trainCandidates = trainButtons
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

                    return {
                        index,
                        btn,
                        tag,
                        data,
                        rewards,
                        energyCost,
                        fightDifficulty,
                        trainingProgress,
                        ratio: energyCost > 0 ? trainingProgress / energyCost : 0
                    };
                })
                .filter(Boolean)
                .filter((q) => q.fightDifficulty < 3)
                .filter((q) => q.trainingProgress > 0)
                .filter((q) => q.energyCost <= trainingEnergyLeft);

            if (!trainCandidates.length) {
                console.error('[Creuse] No valid training quests found', {
                    trainingEnergyLeft
                });
                this.scheduleAutoTrainingRetry();
                return;
            }

            trainCandidates.sort((a, b) => {
                if (b.ratio !== a.ratio) {
                    return b.ratio - a.ratio;
                }

                if (a.energyCost !== b.energyCost) {
                    return a.energyCost - b.energyCost;
                }

                return b.trainingProgress - a.trainingProgress;
            });

            const bestQuest = trainCandidates[0];

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

                        if (document.Creuse?.training_done_dialog) {
                            try {
                                console.log('[Creuse] Closing end dialog of training quest.');
                                document.Creuse.training_done_dialog.handleClickClose();
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

        if (trainingDoneDialog) {
            setTimeout(() => {
                if (!this.isTrainingRunning) {
                    return;
                }

                try {
                    console.log('[Creuse] Closing lingering end dialog of training quest.');
                    trainingDoneDialog.handleClickClose();
                } catch (e) {
                    console.error('[Creuse] Error while closing lingering training dialog', e);
                }

                this.executeAutoTraining();
            }, 4200);
        }
    };

    /**
     * Schedules a delayed retry for training automation.
     */
    EquiCreuse.prototype.scheduleAutoTrainingRetry = function () {
        if (!this.isTrainingRunning) {
            return;
        }

        if (this.autoTrainingRetryTimeout) {
            return;
        }

        this.autoTrainingRetryTimeout = setTimeout(() => {
            this.autoTrainingRetryTimeout = null;

            if (!this.isTrainingRunning) {
                return;
            }

            console.log('[Creuse] Retrying executeBestTrain...');
            this.executeBestTrain();
        }, 5000);
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