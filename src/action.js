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

const COMMIT_TYPE_PREFIX = /^(\w+): /i;
const COMMIT_MESSAGE_BREAKING_CHANGE = /^BREAKING CHANGE: /m;

const RELEASE_TYPES = [
  'patch',
  'minor',
  'major'
];

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
        .filter((tag) => tag.name.startsWith(tagPrefix))
    );

    return listTags(tags, page + 1);
  }

  const tags = await listTags();
  if (tags.length === 0) return null;

  const getVersion = (tag) => tag.replace(tagPrefix, '');

  const latestTag = tags.sort((a, b) => semver.compare(getVersion(a.name), getVersion(b.name)))[tags.length -1];
  return latestTag;
}

async function getCommits(octokit, latestTagSha, thisRef, directory) {
  console.log(`Searching commits between ${latestTagSha} -> ${thisRef}`);

  const data = await octokit.graphql(`query {
    repository(name:"${github.context.repo.repo}", owner:"${github.context.repo.owner}") {
      ref(qualifiedName:"${thisRef}") {
        target {
          ... on Commit {
            history(path:"${directory}") {
              edges {
                node {
                  id,
                  oid,
                  message
                }
              }
            }
          }
        }
      }
    }
  }`);

  const allCommits = data.repository.ref.target.history.edges.map((commit) => commit.node);
  const commits = [];

  for (const commit of allCommits) {
    if (commit.oid === latestTagSha) {
      break;
    }

    commits.push(commit);
  }

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
        default: return type;
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

    const latestTagProps = await findLatestTag(octokit, tagPrefix);
    const latestVersion = latestTagProps ? latestTagProps.name.replace(tagPrefix, '') : null;
    const latestTag = latestTagProps ? latestTagProps.name : null;

    let nextVersion = packageVersion;

    if (latestTagProps) {
      const commits = await getCommits(octokit, latestTagProps.commit.sha, github.context.ref, directory);

      console.log(`Found ${commits.length} commits`);
      console.log(commits);

      const releaseType = determineReleaseType(commits);
      if (releaseType !== null) {
        nextVersion = semver.inc(latestVersion, releaseType);

        console.log(`Commits trigger a ${releaseType} release`);
      } else {
        console.log('No commits trigger a release');
        return;
      }
    } else {
      console.log('No previous tag found');
    }

    const nextTag = `${tagPrefix}${nextVersion}`;

    console.log({
      latestVersion,
      latestTag,
      nextVersion,
      nextTag
    });

    core.setOutput('latestVersion', latestVersion);
    core.setOutput('latestTag', latestTag);
    core.setOutput('nextVersion', nextVersion);
    core.setOutput('nextTag', nextTag);
  } catch (err) {
    core.setFailed(err.message);
  }
}();
