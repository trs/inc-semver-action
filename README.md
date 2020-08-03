# inc-semver-action

![Release](https://github.com/trs/inc-semver-action/workflows/Release/badge.svg)

## About

Determine the next Semantic Version based on commits to a given path. 
This is useful for monorepos to create different tags based on each package.

Given a path, it will check commits from the latest tag and output the next version and tag.

Tags are prefixed with the package name determined from it's `package.json`.

If no previous tag is found, the current `version` inside `package.json` is output.

## Usage
