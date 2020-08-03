const {resolve} = require('path');
const {access, constants, readFile} = require('fs');
const {promisify} = require('util');

const {getInput} = require('@actions/core');

const accessAsync = promisify(access);
const readFileAsync = promisify(readFile);

module.exports.getPackageInfo = async function getPackageInfo() {
  const directory = getInput('directory');
  const prefix = getInput('prefix');
  const packageJsonPath = resolve(directory, 'package.json');

  await accessAsync(packageJsonPath, constants.R_OK);

  const {name, version} = await readFileAsync(packageJsonPath, {encoding: 'utf-8'})
    .then((content) => JSON.parse(content));

  return {
    name,
    version,
    prefix: prefix || `${name}@`,
    directory
  };
}
