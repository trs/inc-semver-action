# inc-semver-action

![Release](https://github.com/trs/inc-semver-action/workflows/Release/badge.svg)

## About

Determine the next Semantic Version based on commits to a given path. 
This is useful for monorepos to create different tags based on each package.

Given a path, it will check commits from the latest tag and output the next version and tag.

Tags are prefixed with the package name determined from it's `package.json`.

If no previous tag is found, the current `version` inside `package.json` is output.

*Note* this action does not perform any releases or change the package in anyway.
It is meant to be used along side a release action of your choice.

## Usage

```yml
jobs:
  version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v1
      - name: Determine Version
        uses: trs/inc-semver-action@master
        id: semver
        with:
          token: "${{ secrets.GITHUB_TOKEN }}"
          directory: "packages/my-pkg" # Directory containing package.json
          prefix: "my-pkg@v"
      - run: |
          echo latestVersion: ${{ steps.semver.outputs.latestVersion }}
          echo latestTag: ${{ steps.semver.outputs.latestTag }}
          echo nextVersion: ${{ steps.semver.outputs.nextVersion }}
          echo nextTag: ${{ steps.semver.outputs.nextTag }}
```

## Inputs

- `token`
  - Must be `${{ secrets.GITHUB_TOKEN }}`
- `directory` (Default: `.`)
  - Directory containing a `package.json` file
- `prefix` (Default: `<package name>@v`)
  - Prefix for the next tag

## Outputs

- `latestVersion`
  - Latest version found before incrementing
- `latestTag`
  - Tag for the latest version found
- `nextVersion`
  - Next version after incrementing
- `nextTag`
  - Tag for the next version

## Example

See [this repository's workflow](.github/workflows/main.yml).
