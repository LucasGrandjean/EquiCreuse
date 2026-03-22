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

                        if (jsonResponse?.data?.training?.ts_end !== undefined) {
                            self.updateCurrentTrainingTimer(jsonResponse?.data?.training?.ts_end);
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