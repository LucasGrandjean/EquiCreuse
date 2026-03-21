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

                if (!document.Creuse?.quest_complete._btnClose) {
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

        if (this.questStatus !== 3) {
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
            console.log('Switched stage');
        } catch (e) {
            console.error('[Creuse] Failed to switch to quest stage', bestQuest.stage, e);
            this.stopMissionExecution();
            return;
        }

        setTimeout(() => {
            if (!this.isMissionRunning) {
                return;
            }

            const questButtons = [
                document.Creuse.quest._btnQuest1,
                document.Creuse.quest._btnQuest2,
                document.Creuse.quest._btnQuest3
            ].filter(Boolean);

            const targetButton = questButtons.find((button) => {
                try {
                    return button?.get_tag?.()?._data?.id === bestQuest.id;
                } catch (e) {
                    return false;
                }
            });

            if (!targetButton) {
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

            try {
                document.Creuse.quest.clickQuest(targetButton);
            } catch (e) {
                console.error('[Creuse] Failed to open selected quest', e);
                this.stopMissionExecution();
                return;
            }

            setTimeout(() => {
                if (!this.isMissionRunning) {
                    return;
                }

                if (this.autoStartQuest && document.Creuse?.dialog_quest) {
                    try {
                        document.Creuse.dialog_quest.onClickStartQuest();
                    } catch (e) {
                        console.error('[Creuse] Failed to auto-start quest', e);
                        this.stopMissionExecution();
                        return;
                    }
                }

                if (!this.autoNextQuest) {
                    this.stopMissionExecution();
                }
            }, 300);
        }, 400);
    };
})();