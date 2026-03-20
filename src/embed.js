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