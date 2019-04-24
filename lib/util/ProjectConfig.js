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
const Config = require('./Config');
const Options = require('./Options');
const Errors = require('./Errors');

const PROJECT_CONFIG_FILE_NAME = Util.format('.%s.project', Options.globalExecutableName);

// impt Project Config file representation
class ProjectConfig extends Config {

    static getEntity(options) {
        if (!ProjectConfig._config) {
            ProjectConfig._config = new ProjectConfig(options);
        }
        return ProjectConfig._config;
    }

    constructor(options) {
        super(Config.TYPE.PROJECT, PROJECT_CONFIG_FILE_NAME);

        this._parseSecrets(".impt.project.secrets");

        if(options && options.deviceGroupIdentifier) {
            this._deviceGroupId = options.deviceGroupIdentifier;
        } else {
            for (var deviceGroupId in this._json["deviceGroups"]) {
                if(this._json["deviceGroups"][deviceGroupId].isDefault) {
                    this._deviceGroupId = deviceGroupId;
                }
            }
        }

    }
    _getProjectJSON() {
        if (this._json["deviceGroups"] && this._json["deviceGroups"][this._deviceGroupId]) {
            return this._json["deviceGroups"][this._deviceGroupId]
        } else if (this._deviceGroupId){
            if(this._json["deviceGroups"]) {
                this._json["deviceGroups"][this._deviceGroupId] = {};
                return this._json["deviceGroups"][this._deviceGroupId]
            } else {
                this._json["deviceGroups"] = {};
                this._json["deviceGroups"][this._deviceGroupId] = {};
                return this._json["deviceGroups"][this._deviceGroupId]
            }
        } else {
            UserInteractor.processError(new Errors.NoConfigError(this));
        }        
    }

    _parseSecrets(filename) {
        const content = Utils.readFileSync(filename);
        if (content !== null) {
            try {
                this._projectSecrets = JSON.parse(content);
            } catch (error) {
                console.log(error);
            }
        }
    }

    get globalProjectSecrets() {
        if(this._projectSecrets) {
            return this._projectSecrets["builder"];
        } else {
            return null;
        }
    }

    get localProjectSecrets() {
        if(this._projectSecrets && this._projectSecrets["deviceGroups"] && this._projectSecrets["deviceGroups"][this._deviceGroupId]){
            return this._projectSecrets["deviceGroups"][this._deviceGroupId].builder;
        } else {
            return null;
        }
    }


    get deviceGroupId() {
        return this._deviceGroupId;
    }

    set deviceGroupId(deviceGroupId) {
        this._deviceGroupId = deviceGroupId;
    }

    get agentFile() {
        return this._getProjectJSON().agentFile;
    }

    set agentFile(agentFile) {
        this._getProjectJSON().agentFile = agentFile;
    }

    get deviceFile() {
        return this._getProjectJSON().deviceFile;
    }

    set deviceFile(deviceFile) {
        this._getProjectJSON().deviceFile = deviceFile;
    }

    get builderJSON() {
        return this._json["builder"];
    }

    get localBuilderJSON() {
        return this._getProjectJSON().builder;
    }


    set endpoint(endpoint) {
        this._getProjectJSON().endpoint = endpoint;
    }

    get accountID() {
        return this._getProjectJSON().accountID;
    }

    set accountID(accountID) {
        this._getProjectJSON().accountID = accountID;
    }

    get isDefault() {
        return this._getProjectJSON().isDefault;
    }

    set isDefault(isDefault) {
        this._getProjectJSON().isDefault = isDefault;
    }

    getProjectJSONInfo(deviceGroupId) {
        return this._json[deviceGroupId];
    }

    setProjectJSONInfo(deviceGroupId, obj) {
        this._json[deviceGroupId] = obj;
    }

    deleteProjectJSONInfo(deviceGroupId) {
        delete this._json[deviceGroupId];
    }


    getJSON() {
        return this._json;
    }

    setJSON(obj) {
        this._json = obj;
    }

    _checkConfig() {
        if (!this._json["deviceGroups"][this._deviceGroupId]) {
            return Promise.reject(new Errors.CorruptedConfigError(this));
        }
        return Promise.resolve();
    }
}

module.exports = ProjectConfig;
