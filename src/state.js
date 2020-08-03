const {getInput} = require('@actions/core');
const {getOctokit} = require('@actions/github');

module.exports.octokit = getOctokit(getInput('token'));
