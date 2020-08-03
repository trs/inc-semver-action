const {setFailed, setOutput} = require('@actions/core');
const {context} = require('@actions/github');
const semver = require('semver');

const { getPackageInfo } = require('./pkg');
const { fetchLatestTag, fetchCommits } = require('./gh');
const { determineReleaseType, formatChangeLog } = require('./ver');

void async function () {
  try {
    // Default output
    setOutput('latestVersion', '');
    setOutput('latestTag', '');
    setOutput('nextVersion', '');
    setOutput('nextTag', '');

    const package = await getPackageInfo();
    console.log(`Using package: ${package.name}`)

    let latestTag = await fetchLatestTag(package.prefix);
    if (!latestTag) {
      console.log(`No previous tag found, defaulting to package version.`);

      latestTag = {
        tag: `${package.prefix}${package.version}`,
        version: package.version
      };
    }

    console.log(`Found tag: ${latestTag.tag} (${latestTag.version})`);

    // Set latest values
    setOutput('latestVersion', latestTag.version);
    setOutput('latestTag', latestTag.tag);

    // Find commits between latest tag and commit
    console.log(`Searching commits: ${latestTag.oid}..${context.sha}`);
    const commits = await fetchCommits(package.directory, latestTag.oid);
    console.log(`Found ${commits.length} commits`);

    // Build change log
    const changelog = formatChangeLog(commits);
    console.log(changelog);

    // Determine next release type based on commit messages
    let nextVersion = latestTag.version;
    if (latestTag.oid) {
      const releaseType = determineReleaseType(commits);
      if (!releaseType) {
        console.log('No commits trigger a release');
        return;
      }

      console.log(`Commits trigger a ${releaseType} release`);

      nextVersion = semver.inc(latestTag.version, releaseType);
    }

    setOutput('nextVersion', nextVersion);
    setOutput('nextTag', `${package.prefix}${nextVersion}`);
    setOutput('changelog', changelog);
  } catch (err) {
    setFailed(err.message);
  }
}();
