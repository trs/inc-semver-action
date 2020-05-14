// Given a directory grab the name (version too maybe?) from the package.json inside
// Use info to find latest tag
// Tag format: @shift-code/get@0.0.0
// If none given, assume this is the first tag to be created
// Find all commits since that tag (or begining of repo) for that directory
// Determine next version based on commits

const path = require('path');
const fs = require('fs');
const {promisify} = require('util');

const accessAsync = promisify(fs.access);

const semver = require('semver');
const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');

const GIT_LOG_COMMIT_REGEX = /^([a-z0-9]+) (?:\(.+\) |)(.+)/i;
const COMMIT_TYPE_PREFIX = /^(\w+): /i;
const COMMIT_MESSAGE_BREAKING_CHANGE = /^BREAKING CHANGE: /m;

const RELEASE_TYPES = [
  'patch',
  'minor',
  'major'
];

async function fetchGitTags() {
  await exec.exec('git', ['fetch', '--depth=1', 'origin', '+refs/tags/*:refs/tags/*']);
}

async function fetchGitHistory() {
  await exec.exec('git', ['fetch', '--prune', '--unshallow']);
}

async function findLatestTag(octokit, tagPrefix) {
  async function listTags(tags = [], page = 0) {
    // TODO: change to graphql endpoint
    const response = await octokit.repos.listTags({
      ...github.context.repo,
      per_page: 100,
      page
    });
    // TODO: check for error in response

    const tagsList = response.data;
    if (tagsList.length === 0) return tags;

    tags.push(
      ...tagsList
        .map((tag) => tag.name)
        .filter((tag) => tag.startsWith(tagPrefix))
    );

    return listTags(tags, page + 1);
  }

  const tags = await listTags();
  if (tags.length === 0) return null;

  const getVersion = (tag) => tag.replace(tagPrefix, '');

  const latestTag = tags.sort((a, b) => semver.compare(getVersion(a), getVersion(b)))[tags.length -1];
  return latestTag;
}

async function getCommits(tag, directory) {
  let output = '';
  let error = '';

  try {
    await exec.exec('git', ['log', '--oneline', `${tag}..`, '--', directory], {
      listeners: {
        stdout: (data) => output += data.toString(),
        stderr: (data) => error += data.toString()
      }
    });
  } catch (err) {
    error = err.message;
  }

  if (error) {
    if (/does not have any commits yet/.test(error)) return [];
    else throw new Error(error);
  }

  const commits = output
    .split('\n')
    .map((commit) => commit.trim().match(GIT_LOG_COMMIT_REGEX))
    .filter((match) => match !== null)
    .map((match) => ({
      hash: match[1],
      message: match[2]
    }));

  return commits;
}

function determineReleaseType(commits) {
  const hasBreaking = commits.find((commit) => COMMIT_MESSAGE_BREAKING_CHANGE.test(commit.message));
  if (hasBreaking) return RELEASE_TYPES[2];

  const type = commits
    .map((commit) => commit.message.match(COMMIT_TYPE_PREFIX))
    .filter((match) => match !== null)
    .map((match) => match[1].toLocaleLowerCase())
    .reduce((type, prefix) => {
      switch (prefix) {
        case 'feat': return type < 1 ? 1 : type;
        case 'fix': return type < 0 ? 0 : type;
        default: type;
      }
    }, -1);

  if (type === -1) return null;
  return RELEASE_TYPES[type];
}

void async function () {
  try {
    const githubToken = core.getInput('token');
    const directory = core.getInput('directory');
    const packageJsonPath = path.resolve(directory, 'package.json');

    await accessAsync(packageJsonPath, fs.constants.R_OK);

    const packageJson = require(packageJsonPath);
    const packageName = packageJson.name;
    const packageVersion = packageJson.version;

    const tagPrefix = `${packageName}@`;

    const octokit = new github.GitHub(githubToken);

    const latestTag = await findLatestTag(octokit, tagPrefix);

    let nextVersion = packageVersion;

    if (latestTag) {
      await fetchGitTags();
      // await fetchGitHistory();
      const commits = await getCommits(latestTag, directory);

      const releaseType = determineReleaseType(commits);
      if (releaseType !== null) {
        const latestVersion = latestTag.replace(tagPrefix, '');
        nextVersion = semver.inc(latestVersion, releaseType);

        console.log({
          releaseType,
          latestVersion,
          nextVersion
        })
      }
    }

    const nextTag = `${tagPrefix}${nextVersion}`;

    core.setOutput('next-version', nextVersion);
    core.setOutput('next-tag', nextTag);

    console.log({
      latestTag,
      nextVersion,
      nextTag
    });
  } catch (err) {
    core.setFailed(err.message);
  }
}();
