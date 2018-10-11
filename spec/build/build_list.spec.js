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

require('jasmine-expect');
const config = require('../config');
const Shell = require('shelljs');
const ImptTestHelper = require('../ImptTestHelper');
const lodash = require('lodash');

const PRODUCT_NAME = '__impt_product';
const DEVICE_GROUP_NAME = '__impt_device_group';
const PRODUCT2_NAME = '__impt_product_2';
const DEVICE_GROUP2_NAME = '__impt_device_group_2';
const DEVICE_GROUP3_NAME = '__impt_device_group_3';

// Test suite for 'impt build list' command.
// Runs 'impt build list' command with different combinations of options,
describe('impt build list test suite >', () => {
    let dg_id = null;
    let product_id = null;
    let build_id = null;
    let build2_id = null;
    let build2_sha = null;
    let build3_id = null;

    beforeAll((done) => {
        ImptTestHelper.init().
            then(_testSuiteCleanUp).
            then(_testSuiteInit).
            then(() => jasmine.addMatchers(customMatcher)).
            then(done).
            catch(error => done.fail(error));
    }, ImptTestHelper.TIMEOUT);

    afterAll((done) => {
        _testSuiteCleanUp().
            then(ImptTestHelper.cleanUp).
            then(done).
            catch(error => done.fail(error));
    }, ImptTestHelper.TIMEOUT);

    // custom matcher for search Device with expected properties in Device array
    let customMatcher = {
        toContainsBuild: function (util, customEqualityTesters) {
            return {
                compare: function (commandOut, expected = {}) {
                    let result = { pass: false };
                    const BuildArray = JSON.parse(commandOut.output);
                    if (!Array.isArray(BuildArray)) return result;
                    lodash.map(BuildArray, function (DgItem) {
                        lodash.map(DgItem, function (DgProperties) {
                            let compareFlag = true;
                            lodash.map(DgProperties, function (value, key) {
                                if (typeof (value) === 'object' && typeof (expected[key]) === 'object') {
                                    lodash.map(value, function (subval, subkey) {
                                        compareFlag = compareFlag && (expected[key][subkey] === undefined ? true : util.equals(subval, expected[key][subkey], customEqualityTesters));
                                    });
                                }
                                else
                                    compareFlag = compareFlag && (expected[key] === undefined ? true : value == expected[key]);
                            });
                            // all properties matched
                            if (compareFlag) result.pass = true;
                        });
                    });
                    return result;
                }
            };
        },
        toBuildCountEqual: function () {
            return {
                compare: function (commandOut, expected) {
                    let result = { pass: false };
                    const BuildArray = JSON.parse(commandOut.output);
                    if (Array.isArray(BuildArray) && BuildArray.length === expected) result.pass = true;
                    return result;
                }
            };
        },
        toBuildCountMore: function () {
            return {
                compare: function (commandOut, expected) {
                    let result = { pass: false };
                    const BuildArray = JSON.parse(commandOut.output);
                    if (Array.isArray(BuildArray) && BuildArray.length > expected) result.pass = true;
                    return result;
                }
            };
        },
    };

    // prepare environment for build list command testing
    function _testSuiteInit() {
        return ImptTestHelper.runCommandEx(`impt product create -n ${PRODUCT_NAME}`, ImptTestHelper.emptyCheckEx).
            then(() => ImptTestHelper.runCommandEx(`impt dg create -n ${DEVICE_GROUP_NAME} -p ${PRODUCT_NAME}`, (commandOut) => {
                ImptTestHelper.emptyCheckEx(commandOut);
            })).
            then(() => ImptTestHelper.runCommandEx(`impt product create -n ${PRODUCT2_NAME}`, (commandOut) => {
                product_id = ImptTestHelper.parseId(commandOut);
                ImptTestHelper.emptyCheckEx(commandOut);
            })).
            then(() => ImptTestHelper.runCommandEx(`impt dg create -n ${DEVICE_GROUP2_NAME} -p ${PRODUCT2_NAME}`, (commandOut) => {
                dg_id = ImptTestHelper.parseId(commandOut);
                ImptTestHelper.emptyCheckEx(commandOut);
            })).
            then(() => ImptTestHelper.runCommandEx(`impt dg create -n ${DEVICE_GROUP3_NAME} -p ${PRODUCT2_NAME}`, (commandOut) => {
                ImptTestHelper.emptyCheckEx(commandOut);
            })).
            then(() => Shell.cp('-Rf', `${__dirname}/fixtures/device.nut`, ImptTestHelper.TESTS_EXECUTION_FOLDER)).
            then(() => ImptTestHelper.runCommandEx(`impt build deploy -g ${DEVICE_GROUP_NAME} -t build_tag`, (commandOut) => {
                build_id = ImptTestHelper.parseId(commandOut);
                ImptTestHelper.emptyCheckEx(commandOut);
            })).
            then(() => ImptTestHelper.runCommandEx(`impt build deploy -g ${DEVICE_GROUP2_NAME} -f -t build2_tag -x device.nut`, (commandOut) => {
                build2_id = ImptTestHelper.parseId(commandOut);
                build2_sha = ImptTestHelper.parseSha(commandOut);
                ImptTestHelper.emptyCheckEx(commandOut);
            })).
            then(() => ImptTestHelper.runCommandEx(`impt build deploy -g ${DEVICE_GROUP3_NAME} -t build3_tag`, (commandOut) => {
                build3_id = ImptTestHelper.parseId(commandOut);
                ImptTestHelper.emptyCheckEx(commandOut);
            })).
            then(() => ImptTestHelper.runCommandEx(`impt dg delete -g ${DEVICE_GROUP3_NAME} -q`, ImptTestHelper.emptyCheckEx));
    }

    // delete all entities using in impt build list test suite
    function _testSuiteCleanUp() {
        return ImptTestHelper.runCommandEx(`impt product delete -p ${PRODUCT_NAME} -f -b -q`, ImptTestHelper.emptyCheckEx).
            then(() => ImptTestHelper.runCommandEx(`impt product delete -p ${PRODUCT2_NAME} -f -b -q`, ImptTestHelper.emptyCheckEx));
    }

    // check 'no deployments found' output message 
    function _checkNoDeploymentsFoundMessage(commandOut) {
        ImptTestHelper.checkOutputMessageEx('', commandOut,
            'No Deployments are found.');
    }

    describe('build list positive tests >', () => {
        it('build list by owner me and dg type', (done) => {
            ImptTestHelper.runCommandEx(`impt build list --owner me --dg-type development -z json`, (commandOut) => {
                expect(commandOut).toContainsBuild({ id: build_id });
                expect(commandOut).toContainsBuild({ id: build2_id });
                expect(commandOut).toBuildCountMore(1);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });

        it('build list by owner id and product id', (done) => {
            ImptTestHelper.runCommandEx(`impt build list --owner ${config.accountid} --product ${product_id} -z json`, (commandOut) => {
                expect(commandOut).toContainsBuild({ id: build2_id });
                expect(commandOut).toContainsBuild({ id: build3_id });
                expect(commandOut).toBuildCountEqual(2);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });

        it('build list by owner name and product name', (done) => {
            ImptTestHelper.runCommandEx(`impt build list --owner ${config.username} --product ${PRODUCT2_NAME} -z json`, (commandOut) => {
                expect(commandOut).toContainsBuild({ id: build2_id });
                expect(commandOut).toContainsBuild({ id: build3_id });
                expect(commandOut).toBuildCountEqual(2);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });

        it('build list by owner email and dg id', (done) => {
            ImptTestHelper.runCommandEx(`impt build list --owner ${config.email} --dg ${dg_id} -z json`, (commandOut) => {
                expect(commandOut).toContainsBuild({ id: build2_id });
                expect(commandOut).toBuildCountEqual(1);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });

        it('build list by dg name and sha', (done) => {
            ImptTestHelper.runCommandEx(`impt build list --dg ${DEVICE_GROUP2_NAME} --sha ${build2_sha} -z json`, (commandOut) => {
                expect(commandOut).toContainsBuild({ id: build2_id });
                expect(commandOut).toBuildCountEqual(1);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });

        it('build list by sha and tag', (done) => {
            ImptTestHelper.runCommandEx(`impt build list --sha ${build2_sha} --tag build2_tag  -z json`, (commandOut) => {
                expect(commandOut).toContainsBuild({ id: build2_id });
                expect(commandOut).toBuildCountEqual(1);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });

        it('build list by several tags', (done) => {
            ImptTestHelper.runCommandEx(`impt build list -t build2_tag -t build_tag  -z json`, (commandOut) => {
                expect(commandOut).toContainsBuild({ id: build_id });
                expect(commandOut).toContainsBuild({ id: build2_id });
                expect(commandOut).toBuildCountEqual(2);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });

        it('build list by product id and flagged', (done) => {
            ImptTestHelper.runCommandEx(`impt build list -p ${product_id} --flagged -z json`, (commandOut) => {
                expect(commandOut).toContainsBuild({ id: build2_id });
                expect(commandOut).toBuildCountEqual(1);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });

        it('build list by product id and unflagged', (done) => {
            ImptTestHelper.runCommandEx(`impt build list -p ${product_id} --unflagged -z json`, (commandOut) => {
                expect(commandOut).toContainsBuild({ id: build3_id });
                expect(commandOut).toBuildCountEqual(1);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });

        it('build list by product id  and zombie', (done) => {
            ImptTestHelper.runCommandEx(`impt build list -p ${product_id} --zombie -z json`, (commandOut) => {
                expect(commandOut).toContainsBuild({ id: build3_id });
                expect(commandOut).toBuildCountEqual(1);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });

        it('build list by product id and not zombie', (done) => {
            ImptTestHelper.runCommandEx(`impt build list -p ${product_id} --non-zombie -z json`, (commandOut) => {
                expect(commandOut).toContainsBuild({ id: build2_id });
                expect(commandOut).toBuildCountEqual(1);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });

        it('build list by not exist owner', (done) => {
            ImptTestHelper.runCommandEx(`impt build list -o not-exist-owner`, (commandOut) => {
                _checkNoDeploymentsFoundMessage(commandOut);
                ImptTestHelper.checkSuccessStatusEx(commandOut);
            }).
                then(done).
                catch(error => done.fail(error));
        });
    });

    describe('build list negative tests >', () => {

    });
});
