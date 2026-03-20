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
        if (document?.Creuse?.quest) {
            document.Creuse.quest.onClickBuyEnergy();
        }
    };
})();