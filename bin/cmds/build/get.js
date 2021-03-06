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
const Build = require('../../../lib/Build');
const Options = require('../../../lib/util/Options');

const COMMAND = 'get';
const COMMAND_SECTION = 'build';
const COMMAND_SHORT_DESCR = 'Downloads the source files of the specified build.';
const COMMAND_DESCRIPTION = 'Downloads the source files of the specified build (Deployment) and displays information about the build.';

exports.command = COMMAND;

exports.describe = COMMAND_SHORT_DESCR;

exports.builder = function (yargs) {
    const options = Options.getOptions({
        [Options.ACCOUNT] : false,
        [Options.BUILD_IDENTIFIER] : false,
        [Options.DEVICE_FILE] : {
            demandOption : false,
            describe : Util.format('The device source code file name.' +
                ' If not specified, the file referenced by the Project file in the current directory is used;' +
                ' if there is no Project file and the --%s option is not specified, the command fails.',
                Options.AGENT_ONLY)
        },
        [Options.AGENT_FILE] : {
            demandOption : false,
            describe : Util.format('The agent source code file name.' +
                ' If not specified, the file referenced by the Project file in the current directory is used;' +
                ' if there is no Project file and the --%s option is not specified, the command fails.',
                Options.DEVICE_ONLY)
        },
        [Options.DEVICE_ONLY] : false,
        [Options.AGENT_ONLY] : false,
        [Options.CONFIRMED] : false,
        [Options.OUTPUT] : false
    });
    return yargs
        .usage(Options.getUsage(COMMAND_SECTION, COMMAND, COMMAND_DESCRIPTION, Options.getCommandOptions(options)))
        .options(options)
        .check(function (argv) {
            return Options.checkOptions(argv, options);
        })
        .strict();
};

exports.handler = function (argv) {
    const options = new Options(argv);
    new Build(options).get(options);
};
