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
const ImpCentralApiHelper = require('./util/ImpCentralApiHelper');
const UserInteractor = require('./util/UserInteractor');
const TestConfig = require('./util/TestConfig');
const GithubConfig = require('./util/GithubConfig');
const BuilderConfig = require('./util/BuilderConfig');
const Errors = require('./util/Errors');
const Utils = require('./util/Utils');
const Options = require('./util/Options');
const TestHelper = require('./util/TestHelper');
const DeleteHelper = require('./util/DeleteHelper');
const Identifier = require('./util/Identifier');
const DeviceGroup = require('./DeviceGroup');
const Product = require('./Product');

const BUILDER_CACHE_DIR_NAME = '.builder-cache';
const DEBUG_MODE_DIR_NAME = '.build';

// Provides methods used by impt Test Manipulation Commands.
class Test {
    static get DEBUG_MODE_DIR_NAME() {
        return DEBUG_MODE_DIR_NAME;
    }

    constructor(options) {
        options = options || {};
        this._testConfig = TestConfig.getEntity();
        this._githubConfig = null;
        const accountId = options.account ? options.account : null;
        this._helper = ImpCentralApiHelper.getEntity(accountId);
        UserInteractor.setOutputFormat(options, this._helper);

        this._deviceGroup = null;
        this._devices = null;
    }

    get entityType() {
        return this._testConfig.type
    }

    create(options) {
        return this._create(options).
            then(() => this._info()).
            then((info) => {
                UserInteractor.printInfo(UserInteractor.MESSAGES.ENTITY_CREATED, this.entityType);
                UserInteractor.printResultWithStatus(info);
            }).
            catch(error => UserInteractor.processError(error));
    }

    _create(options) {
        var initialJSON = this._testConfig.getJSON();
        this._testConfig.clean();

        return this._initDeviceGroup(options).
            then(() => this._processBuilderCache(true)).
            then(() => this._setTestConfigOptions(options)).
            then(() => {
                var newJSONObj = this._testConfig.getJSON();
                newJSONObj["accountID"] = this._helper.authConfig.accountID
             
                if(!Array.isArray(initialJSON)) {
                    var JSONArr = [];
                    JSONArr.push(newJSONObj);
                } else {
                    JSONArr = initialJSON;
                    JSONArr.push(newJSONObj);                
                }

                this._testConfig.setJSON(JSONArr);

                this._saveTestConfig();

                // We need to set it back to the new object so that it can print the info when finished
                this._testConfig.setJSON(newJSONObj);

            });
    }

    update(options) {
        UserInteractor.processError({"message": "This command does NOT work currently"})
        // return this._checkTestConfig().
        //     then(() => this._initDeviceGroup(options)).
        //     then(() => this._processBuilderCache(options.builderCache === false)).
        //     then(() => this._setTestConfigOptions(options)).
        //     then(() => this._saveTestConfig()).
        //     then(() => this._info()).
        //     then((info) => {
        //         UserInteractor.printInfo(UserInteractor.MESSAGES.ENTITY_UPDATED, this.entityType);
        //         UserInteractor.printResultWithStatus(info);
        //     }).
        //     catch(error => UserInteractor.processError(error));
    }

    delete(options) {
        if (this._testConfig.exists()) {
            new DeleteHelper().processDelete(this, options).
                then(() => UserInteractor.printResultWithStatus()).
                catch(error => UserInteractor.processError(error));
        }
        else {
            UserInteractor.printInfo(UserInteractor.MESSAGES.NO_CONFIG_CURR_DIR_MSG, this.entityType);
            UserInteractor.printResultWithStatus();
        }
    }

    _processBuilderCache(cleanup) {
        if (cleanup) {
            return new DeleteHelper().cleanup(this);
        }
        return Promise.resolve();
    }

    _collectCleanupSummary(summary) {
        if (Utils.existsFileSync(BUILDER_CACHE_DIR_NAME)) {
            summary.dirs[UserInteractor.MESSAGES.TEST_BUILDER_CACHE] = BUILDER_CACHE_DIR_NAME;
        }
        return Promise.resolve();
    }

    _collectDeleteSummary(summary, options) {
        this._collectCleanupSummary(summary);
        if (Utils.existsFileSync(DEBUG_MODE_DIR_NAME)) {
            summary.dirs[UserInteractor.MESSAGES.TEST_DEBUG_MODE_TEMP_DIR] = DEBUG_MODE_DIR_NAME;
        }
        if ((options.githubConfig || options.all) && this._testConfig.githubConfig) {
            summary.configs.push(new GithubConfig(this._testConfig.githubConfig));
        }
        if ((options.builderConfig || options.all) && this._testConfig.builderConfig) {
            summary.configs.push(new BuilderConfig(this._testConfig.builderConfig));
        }
        summary.configs.push(this._testConfig);
        if ((options.entities || options.all) && this._testConfig.deviceGroupId) {
            return this._initDeviceGroup().
                then(() => {
                    const productId = this._deviceGroup.relatedProductId;
                    return new DeviceGroup().listByProduct(productId).
                        then(devGroups => {
                            if (devGroups.length === 1) {
                                return new Product().initById(productId)._collectDeleteSummary(summary, new Options());
                            }
                            return Promise.resolve();
                        });
                }).
                then(() => this._deviceGroup._collectDeleteSummary(summary, new Options({ [Options.FORCE] : true, [Options.BUILDS] : true }))).
                catch(error => {
                    if (error instanceof Errors.OutdatedConfigEntityError) {
                        // the test config Device Group doesn't already exist, no error needed
                    }
                    else {
                        throw error;
                    }
                });
        }
        else {
            return Promise.resolve();
        }
    }

    async run(options) {
        var successAll = true;
        var initialJSON = this._testConfig.getJSON();

        var runTest = function(options, deviceGroupConfig){
            this._testConfig.setJSON(deviceGroupConfig);
            return this._run(options)
                        .then(() => { /* We succeeded .. Do nothing */ })
                        .catch(error => {
                            successAll = false;
                            console.log(error.message, "For DG: ", this._testConfig.deviceGroupId);
                        });  

        }.bind(this)

        if(!Array.isArray(initialJSON)) {
            // support the old test file format (i.e. with one device group Configuration)
            await runTest(options, initialJSON);
        } else {
            // We have an array of device groups, run tests on all
            for (var deviceGroupConfig of initialJSON) {
                var authJSON = this._helper.authConfig.getJSON();
    
                // if the accountID in the test file is for a shared accountm we need to look that up in the auth file
                if(authJSON[deviceGroupConfig.accountID]) {
                    this._helper.authConfig.accountID = deviceGroupConfig.accountID
                } else {
                    for (var account in authJSON) {
                        if(authJSON[account].accounts.indexOf(deviceGroupConfig.accountID) != -1) {
                            this._helper.authConfig.accountID = account;
                            break;
                        }
                    }
                }
    
                if(!deviceGroupConfig.skip || !deviceGroupConfig.skip == true) {
                    ImpCentralApiHelper._entity =  new ImpCentralApiHelper(this._helper.authConfig.endpoint, this._helper.authConfig.location, deviceGroupConfig.accountID) // We want a new ImpCentralApiHelper._entity for every account
    
                    await runTest(options, deviceGroupConfig);
                }
            }
        }

        // Some test failed, we want to exit with exit code
        if(!successAll) {
            UserInteractor.processError(new Errors.ImptError(UserInteractor.ERRORS.TEST_FAILED));
        }

    }

    _run(options) {
        UserInteractor.enableSpinner(false);
        let testHelper = null;
        return this._checkTestConfig().
            then(() => this._initDeviceGroup(null)).
            then(() => this._processBuilderCache(options.clearCache)).
            then(() => {
                testHelper = new TestHelper(this._deviceGroup, options);
                return testHelper.runTests();
            }).
            then(() => {
                if (testHelper.success) {
                    UserInteractor.printResultWithStatus();
                    return Promise.resolve();
                }
                else {
                    throw new Errors.ImptError(UserInteractor.ERRORS.TEST_FAILED);
                }
            }).
            catch((error) => {
                return Promise.reject(error) 
            });
    }

    async info(options) {
        var initialJSON = this._testConfig.getJSON();

        var logTest = function(options, deviceGroupConfig) {

            this._testConfig.setJSON(deviceGroupConfig);

            return this._checkTestConfig().
                then(() => this._info()).
                then((info) => UserInteractor.printResultWithStatus(info)).
                catch(error => UserInteractor.processError(error))
        }.bind(this)

        if(!Array.isArray(initialJSON)) {
            // support the old test file format (i.e. with one device group Configuration)
            await logTest(options, initialJSON);
        } else {
            // We have an array of device groups, get info of all
            for (var deviceGroupConfig of initialJSON) {
                var authJSON = this._helper.authConfig.getJSON();
    
                // if the accountID in the test file is for a shared accountm we need to look that up in the auth file
                if(authJSON[deviceGroupConfig.accountID]) {
                    this._helper.authConfig.accountID = deviceGroupConfig.accountID
                } else {
                    for (var account in authJSON) {
                        if(authJSON[account].accounts.indexOf(deviceGroupConfig.accountID) != -1) {
                            this._helper.authConfig.accountID = account;
                            break;
                        }
                    }
                }
    
                if(!deviceGroupConfig.skip || !deviceGroupConfig.skip == true) {
                    ImpCentralApiHelper._entity =  new ImpCentralApiHelper(this._helper.authConfig.endpoint, this._helper.authConfig.location, deviceGroupConfig.accountID) // We want a new ImpCentralApiHelper._entity for every account
    
                    await logTest(options, deviceGroupConfig);
                }
            }
        }
    }

    _info(options) {
        return this._initDeviceGroup(null).
            then(() => this._deviceGroup._collectListData(true)).
            then(() => {
                const data = {
                    [UserInteractor.MESSAGES.TEST_FILES] : this._testConfig.testFiles,
                    [UserInteractor.MESSAGES.TEST_DEVICE_FILE] : this._testConfig.deviceFile,
                    [UserInteractor.MESSAGES.TEST_AGENT_FILE] : this._testConfig.agentFile,
                    [UserInteractor.MESSAGES.TEST_STOP_ON_FAILURE] : this._testConfig.stopOnFail,
                    [UserInteractor.MESSAGES.TEST_TIMEOUT] : this._testConfig.timeout,
                    [UserInteractor.MESSAGES.TEST_ALLOW_DISCONNECT] : this._testConfig.allowDisconnect,
                    [UserInteractor.MESSAGES.TEST_BUILDER_CACHE] : this._testConfig.builderCache,
                    [UserInteractor.MESSAGES.TEST_GITHUB_CONFIG] : this._testConfig.githubConfig,
                    [UserInteractor.MESSAGES.TEST_BUILDER_CONFIG] : this._testConfig.builderConfig
                };
                Object.assign(data, this._deviceGroup.displayData);
                return { [this.entityType] : data };
            });
    }

    github(options) {
        this._githubConfig = new GithubConfig(options.githubConfig);
        return UserInteractor.processCancelContinueChoice(
            Util.format(UserInteractor.MESSAGES.CONFIG_EXISTS, this._githubConfig.type, this._githubConfig.fileName),
            this._github.bind(this),
            options,
            !this._githubConfig.exists() || options.confirmed).
            then(() => UserInteractor.printResultWithStatus()).
            catch(error => UserInteractor.processError(error));
    }

    _github(options) {
        const exists = this._githubConfig.exists();
        this._githubConfig.clean();
        return this._setGithubConfigOptions(options).
            then(() => this._githubConfig.save()).
            then(() => {
                UserInteractor.printInfo(
                    exists ? UserInteractor.MESSAGES.ENTITY_UPDATED : UserInteractor.MESSAGES.ENTITY_CREATED,
                    this._githubConfig.type);
            });
    }

    _initDeviceGroup(options) {
        if (options && options.deviceGroupIdentifier) {
            this._deviceGroup = new DeviceGroup(options);
            return this._deviceGroup.getEntity().then(() => {
                this._testConfig.deviceGroupId = this._deviceGroup.id;
            });
        }
        else if (this._testConfig.deviceGroupId) {
            this._deviceGroup = new DeviceGroup().initByIdFromConfig(this._testConfig.deviceGroupId, this.entityType);
            return this._deviceGroup.getEntity();
        }
        return Promise.reject(new Errors.NoIdentifierError(Identifier.ENTITY_TYPE.TYPE_DEVICE_GROUP));
    }

    _processSourceFile(fileName, type) {
        if (fileName) {
            if (Utils.existsFileSync(fileName)) {
                return fileName;
            }
            else {
                throw new Errors.ImptError(
                    UserInteractor.ERRORS.ENTITY_NOT_FOUND, type, fileName);
            }
        }
        return undefined;
    }

    _setGithubConfigOptions(options) {
        return UserInteractor.requestOption(options.user, UserInteractor.MESSAGES.TEST_GITHUB_USER).
            then(user => {
                this._githubConfig.githubUser = user;
                return UserInteractor.requestOption(options.password, UserInteractor.MESSAGES.TEST_GITHUB_PASSWORD, true);
            }).
            then(password => {
                this._githubConfig.githubToken = password;
                return Promise.resolve();
            });
    }

    _setTestConfigOptions(options) {
        if (options.timeout !== undefined) {
            this._testConfig.timeout = options.timeout;
        }
        if (options.stopOnFail !== undefined) {
            this._testConfig.stopOnFail = options.stopOnFail;
        }
        if (options.allowDisconnect !== undefined) {
            this._testConfig.allowDisconnect = options.allowDisconnect;
        }
        if (options.builderCache !== undefined) {
            this._testConfig.builderCache = options.builderCache;
        }
        if (options.testFile !== undefined) {
            this._testConfig.testFiles = options.testFile;
        }
        if (options.deviceFile !== undefined) {
            this._testConfig.deviceFile = this._processSourceFile(options.deviceFile, UserInteractor.MESSAGES.TEST_DEVICE_FILE);
        }
        if (options.agentFile !== undefined) {
            this._testConfig.agentFile = this._processSourceFile(options.agentFile, UserInteractor.MESSAGES.TEST_AGENT_FILE);
        }
        if (options.githubConfig !== undefined) {
            this._testConfig.githubConfig = options.githubConfig ? options.githubConfig : undefined;
            this._checkConfig(new GithubConfig(this._testConfig.githubConfig));
        }
        if (options.builderConfig !== undefined) {
            this._testConfig.builderConfig = options.builderConfig ? options.builderConfig : undefined;
            this._checkConfig(new BuilderConfig(this._testConfig.builderConfig));
        }
        return Promise.resolve();
    }

    _checkConfig(config) {
        if (config.fileName !== undefined && !config.exists()) {
            UserInteractor.printInfo(UserInteractor.MESSAGES.NO_CONFIG_MSG, config.type, config.fileName);
        }
    }

    _saveTestConfig() {
        return this._testConfig.save();
    }

    _checkTestConfig() {
        return this._testConfig.checkConfig();
    }
}

module.exports = Test;
