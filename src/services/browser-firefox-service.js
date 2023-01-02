/* global chrome browser */
import { FF_STORE_URL } from '../constants/urls';
import BrowserBase from '../common/BrowserBase';

export default class FirefoxBrowserService extends BrowserBase {
    constructor() {
        super();
        this.chrome = chrome;
        this.browser = browser;
        //https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser?utm_medium=organic&utm_source=google_rich_qa&utm_campaign=google_rich_qa
    }

    getCurrentUrl() {
        return new Promise((resolve, reject) => {
            this.chrome.tabs.query({ 'active': true, 'lastFocusedWindow': true }, (tabs) => {
                if (tabs && tabs[0] && tabs[0].url) {
                    resolve(tabs[0].url);
                }
                else {
                    reject("Unable to fetch the url");
                }
            });
        });
    }

    getCurrentTab() {
        return new Promise((resolve, reject) => {
            this.chrome.tabs.query({ 'active': true, 'lastFocusedWindow': true }, (tabs) => {
                if (tabs && tabs[0]) {
                    resolve(tabs[0]);
                }
                else {
                    reject("Unable to fetch the tab");
                }
            });
        });
    }

    async registerContentScripts(id, js, matches) {
        return await this.browser.scripting.registerContentScripts([
            {
                id, js, matches,
                persistAcrossSessions: false,
                runAt: "document_end",
                allFrames: true
            }
        ]);
    }

    replaceTabUrl(url) {
        return this.getCurrentTab().then((tab) => this.chrome.tabs.update(tab.id, { url: url }))
            .catch(() => this.openTab(url));
    }

    openTab(url, name, opts) {
        if (!name) {
            this.browser.tabs.create({ url: url });
        } else {
            window.open(url, name, opts);
        }
    }

    getAuthToken(options) {
        const REDIRECT_URL = this.browser.identity.getRedirectURL();
        const CLIENT_ID = "692513716183-jm587gc534dvsere4qhnk5bj68pql3p9.apps.googleusercontent.com";
        const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
        const AUTH_URL = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URL)
            }&scope=${encodeURIComponent(SCOPES.join(" "))}`;
        //REVISIT: const VALIDATION_BASE_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo"; // ToDo: Check why this URL is used
        return this.browser.identity.launchWebAuthFlow({
            interactive: options.interactive,
            url: AUTH_URL
        }).then((tokken) => this.extractAccessToken(tokken));
    }

    getRedirectUrl(endpoint) { //ToDo: need to implement
        return this.chrome.identity.getRedirectURL(endpoint);
    }

    launchWebAuthFlow(options) {
        return new Promise((resolve) => {
            this.chrome.identity.launchWebAuthFlow(options, resolve);
        });
    }

    removeAuthTokken(authToken) {
        this.browser.identity.removeCachedAuthToken({ 'token': authToken }, () => { /* Nothing to implement */ });
    }

    getStoreUrl(forRating) {
        return FF_STORE_URL;
    }

    extractAccessToken(redirectUri) {
        const m = redirectUri.match(/[#?](.*)/);
        if (!m || m.length < 1) { return null; }
        const params = new URLSearchParams(m[1].split("#")[0]);
        return params.get("access_token");
    }

    getLaunchUrl(file) { return Promise.resolve(this.browser.runtime.getURL(file)); }

    /* Commented as no usage found
    getStorageInfo() {
        return navigator.storage.estimate().then((estimate) => {
            const usedSpace = estimate.usage;
            const totalSpace = estimate.quota;
            return {
                totalSpace: totalSpace,
                usedSpace: usedSpace,
                freeSpace: totalSpace - usedSpace,
                usedSpacePerc: Math.round(usedSpace * 100 / totalSpace)
            };
        });
    }

    getAppLongName() {
        return "Jira Assistant";
    }

    notify(id, title, message, ctxMsg, opts) {
        this.notSetting.init();
        this.notSetting.show(id, title, message, ctxMsg, opts);
    }

    addCmdListener(callback) { this.chrome.commands.onCommand.addListener(callback); }*/
}
