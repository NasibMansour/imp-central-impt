// MIT License
//
// Copyright 2018 Electric Imp
//
// SPDX-License-Identifier: MIT
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
// EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
// OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

'use strict';

const Util = require('util');
const Utils = require('./Utils');
const Options = require('./Options');
const Config = require('./Config');
const Errors = require('./Errors');
const Osenv = require('osenv');
const UserInteractor = require('./UserInteractor');

const AUTH_CONFIG_FILE_NAME = Util.format('.%s.auth', Options.globalExecutableName);

const ENV_VAR_IMPT_AUTH_FILE_PATH = 'IMPT_AUTH_FILE_PATH';
const ENV_VAR_IMPT_LOGINKEY = 'IMPT_LOGINKEY';
const ENV_VAR_IMPT_USER = 'IMPT_USER';
const ENV_VAR_IMPT_PASSWORD = 'IMPT_PASSWORD';
const ENV_VAR_IMPT_ENDPOINT = 'IMPT_ENDPOINT';

const LOCATION = {
    GLOBAL : 'Global',
    LOCAL : 'Local',
    FILE_PATH : 'File path',
    ENV_VARS : 'Environment variables',
    ANY : 'Any'
}

// impt Auth Config file representation
class AuthConfig extends Config {

    static get LOCATION() {
        return LOCATION;
    }

    static getEntity(location = null, options) {
        if (!location) {
            location = AuthConfig.LOCATION.ANY;
        }
        switch (location) {
            case AuthConfig.LOCATION.LOCAL:
                return new AuthConfig(AuthConfig.LOCATION.LOCAL, options);
            case AuthConfig.LOCATION.GLOBAL:
                return new AuthConfig(AuthConfig.LOCATION.GLOBAL, options);
            default:
                // local auth config
                const localConfig = new AuthConfig(AuthConfig.LOCATION.LOCAL, options);
                if (localConfig.exists()) {
                    return localConfig;
                }
                // auth config in IMPT_AUTH_FILE_PATH directory
                const authFilePath = process.env[ENV_VAR_IMPT_AUTH_FILE_PATH];
                if (authFilePath) {
                    return new AuthConfig(AuthConfig.LOCATION.FILE_PATH, options, authFilePath);
                }
                // auth with IMPT_LOGINKEY or IMPT_USER env vars
                const loginKey = process.env[ENV_VAR_IMPT_LOGINKEY];
                const user = process.env[ENV_VAR_IMPT_USER];
                if (loginKey || user) {
                    const authConfig = new AuthConfig(AuthConfig.LOCATION.ENV_VARS, options);
                    authConfig.endpoint = process.env[ENV_VAR_IMPT_ENDPOINT];
                    authConfig.loginKey = loginKey;
                    return authConfig;
                }
                // global auth config
                const globalConfig = new AuthConfig(AuthConfig.LOCATION.GLOBAL, options);
                if (globalConfig.exists()) {
                    return globalConfig;
                }
        }
        return new AuthConfig(AuthConfig.LOCATION.ANY, options);
    }

    constructor(location, options, path = null) {
        const configPath = (location == AuthConfig.LOCATION.GLOBAL) ? Osenv.home() : path;

        super(Config.TYPE.AUTH, AUTH_CONFIG_FILE_NAME, configPath);

        this._location = location;
        this._path = path;

        if(options && options.account) {
            this._accountID = options.account;
        } else {
            for (var account in this._json) {
                if(this._json[account].isDefault) {
                    this._accountID = account;
                }
            }
        }
    }

    exists() {
        return super.exists() || this._location === AuthConfig.LOCATION.ENV_VARS;
    }

    save(temp = false) {
        if (this._location === AuthConfig.LOCATION.ENV_VARS) {
            return Promise.resolve();
        }
        if (temp) {
            this.loginKey = undefined;
            this.refreshToken = undefined;
        }

        return super.save();
    }

    _getAuthJSON() {
        if (this._json[this._accountID]) {
            return this._json[this._accountID]
        } else if (this._accountID == UserInteractor.MESSAGES.AUTH_LOGIN_PENDING) {
            this._json[UserInteractor.MESSAGES.AUTH_LOGIN_PENDING] = {};
            return this._json[this._accountID]
        } else {
            UserInteractor.processError(new Errors.NoConfigError(this));
        }        
    }

    getAuthJSONInfo(accountID) {
        return this._json[accountID];
    }

    setAuthJSONInfo(accountID, obj) {
        this._json[accountID] = obj;
    }

    deleteAuthJSONInfo(accountID) {
        delete this._json[accountID];
    }


    getJSON() {
        return this._json;
    }

    setJSON(obj) {
        this._json = obj;
    }

    get location() {
        return this._location;
    }

    set accountID(accountID) {
        this._accountID = accountID;
    }

    get accountID() {
        return this._accountID;
    }

    get info() {
        if (this._location === AuthConfig.LOCATION.LOCAL || this._location === AuthConfig.LOCATION.GLOBAL) {
            return Util.format('%s %s', this._location, this._type);
        }
        else {
            return this._type;
        }
    }

    get endpoint() {
        return this._getAuthJSON().endpoint;
    }

    set endpoint(endpoint) {
        this._getAuthJSON().endpoint = endpoint;
    }

    get isDefault() {
        return this._getAuthJSON().isDefault;
    }

    set isDefault(isDefault) {
        this._getAuthJSON().isDefault = isDefault;
    }

    get userName() {
        return this._getAuthJSON().userName;
    }

    set userName(userName) {
        this._getAuthJSON().userName = userName;
    }

    setAccessToken(accessToken, expiresAt) {
        this._getAuthJSON().accessToken = accessToken;
        this._getAuthJSON().expiresAt = expiresAt;
    }

    get accessToken() {
        return this._getAuthJSON().accessToken;
    }

    get expiresAt() {
        return this._getAuthJSON().expiresAt;
    }

    get refreshToken() {
        return this._getAuthJSON().refreshToken;
    }

    set refreshToken(refreshToken) {
        this._getAuthJSON().refreshToken = refreshToken;
    }

    get loginKey() {
        return this._getAuthJSON().loginKey;
    }

    set loginKey(loginKey) {
        this._getAuthJSON().loginKey = loginKey;
    }

    getAuthType() {
        switch (this._location) {
            case AuthConfig.LOCATION.FILE_PATH:
                return Util.format("%s: %s", UserInteractor.MESSAGES.AUTH_FILE_PATH, this._path);
            case AuthConfig.LOCATION.ENV_VARS:
                return this._location;
            default:
                return Util.format("%s %s", this._location, UserInteractor.MESSAGES.AUTH_FILE);
        }
    }

    setAuthInfo(accessToken, expiresAt, loginKey, refreshToken) {
        this.setAccessToken(accessToken, expiresAt);
        this.loginKey = loginKey;
        if (refreshToken) {
            this.refreshToken = refreshToken;
        }
    }

    canRefreshToken() {
        if (this._location === AuthConfig.LOCATION.ENV_VARS || this.loginKey || this.refreshToken) {
            return true;
        }
        return false;
    }

    _checkConfig() {
        if (this._location === AuthConfig.LOCATION.ENV_VARS) {
            const Auth = require('../Auth');
            const loginKey = process.env[ENV_VAR_IMPT_LOGINKEY];
            const options = new Options({
                [Options.LOGIN_KEY] : loginKey,
                [Options.USER] : process.env[ENV_VAR_IMPT_USER],
                [Options.PASSWORD] : process.env[ENV_VAR_IMPT_PASSWORD],
            });
            return new Auth()._login(options).
                then(result => {
                    this.setAuthInfo(result.access_token, result.expires_at, loginKey, result.refresh_token);
                });
        }

        try{
            if(this._getAuthJSON() !== undefined) {
                if (Object.keys(this._getAuthJSON()).length == 1){
                    if (!this._getAuthJSON().accessToken || !this._getAuthJSON().expiresAt) {
                        throw "No accessToken or Expiration" 
                    }
                }
            }
        } catch(ex){
            return Promise.reject(new Errors.CorruptedConfigError(this));
        }
        return Promise.resolve();
    }
}

module.exports = AuthConfig;
