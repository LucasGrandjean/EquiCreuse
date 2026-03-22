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
            this.currentTrainingTimer = 0;
            this.questCompleteTimer = 0;
            this.serverTime = 0;
            this.motivationCount = 0;
            this.autoNextTrainCooldownTriggered = false;

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